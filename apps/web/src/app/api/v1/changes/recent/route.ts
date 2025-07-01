import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
	withErrorHandling,
	AuthenticationError,
	ValidationError,
} from "@/lib/errors/api-errors";
import { performanceMonitor } from "@/lib/monitoring/performance";
import { logger } from "@/lib/monitoring";
import { validateAPIKey } from "@/lib/security/validation-edge";
import { policyMonitor } from "@/lib/monitoring/policy-monitor";
import { kv } from "@vercel/kv";
import { WATCHED_COMPANIES } from "@inplain.ai/shared";

export const runtime = "edge";

// Query params schema
const querySchema = z.object({
	limit: z
		.string()
		.regex(/^\d+$/)
		.transform(Number)
		.pipe(z.number().min(1).max(100))
		.optional(),
	offset: z
		.string()
		.regex(/^\d+$/)
		.transform(Number)
		.pipe(z.number().min(0))
		.optional(),
	severity: z.enum(["all", "minor", "significant", "critical"]).optional(),
	companySlug: z.string().optional(),
	startDate: z.string().datetime().optional(),
	endDate: z.string().datetime().optional(),
});

// GET /api/v1/changes/recent
export const GET = withErrorHandling(async (request: NextRequest) => {
	const transactionId = performanceMonitor.startTransaction(
		"api.v1.changes.recent"
	);

	try {
		// Validate API key
		const apiKey = request.headers.get("x-api-key");
		if (!apiKey || !validateAPIKey(apiKey)) {
			throw new AuthenticationError("Invalid or missing API key");
		}

		// Track API usage
		await trackAPIUsage(apiKey, "changes.recent");

		// Parse query parameters
		const { searchParams } = new URL(request.url);
		const queryParams = Object.fromEntries(searchParams.entries());
		const validatedParams = querySchema.parse(queryParams);

		const {
			limit = 10,
			offset = 0,
			severity = "all",
			companySlug,
			startDate,
			endDate,
		} = validatedParams;

		// Get recent changes
		let changes = await policyMonitor.getRecentChanges(limit + offset + 50); // Get extra for filtering

		// Filter by company if specified
		if (companySlug) {
			changes = changes.filter(
				(change) => change.companySlug === companySlug
			);
		}

		// Filter by severity
		if (severity !== "all") {
			const severityMap = {
				minor: ["minor"],
				significant: ["content"],
				critical: ["structure"],
			};
			changes = changes.filter((change) =>
				severityMap[severity]?.includes(change.changeType)
			);
		}

		// Filter by date range
		if (startDate || endDate) {
			changes = changes.filter((change) => {
				const changeDate = new Date(change.timestamp);
				if (startDate && changeDate < new Date(startDate)) {
					return false;
				}
				if (endDate && changeDate > new Date(endDate)) {
					return false;
				}
				return true;
			});
		}

		// Apply pagination
		const paginatedChanges = changes.slice(offset, offset + limit);

		// Enhance changes with company information
		const enhancedChanges = await Promise.all(
			paginatedChanges.map(async (change) => {
				// Get company info
				const company =
					WATCHED_COMPANIES.find(
						(c) => c.slug === change.companySlug
					) || (await kv.get(`company:${change.companySlug}`));

				return {
					...change,
					company: company
						? {
								name: (company as any).name,
								slug: (company as any).slug,
								category: (company as any).category,
								logo: (company as any).logo,
							}
						: null,
					severity: mapChangeTypeToSeverity(change.changeType),
					diffUrl: `/api/v1/changes/${change.companySlug}/${change.timestamp}/diff`,
				};
			})
		);

		performanceMonitor.endTransaction(transactionId);

		return NextResponse.json({
			success: true,
			data: enhancedChanges,
			pagination: {
				limit,
				offset,
				total: changes.length,
				hasMore: offset + limit < changes.length,
			},
			metadata: {
				timestamp: new Date().toISOString(),
				version: "1.0",
			},
		});
	} catch (error) {
		performanceMonitor.endTransaction(transactionId);

		if (error instanceof z.ZodError) {
			throw new ValidationError("Invalid query parameters", error.errors);
		}

		throw error;
	}
});

function mapChangeTypeToSeverity(
	changeType: string
): "minor" | "significant" | "critical" {
	switch (changeType) {
		case "structure":
			return "critical";
		case "content":
			return "significant";
		default:
			return "minor";
	}
}

async function trackAPIUsage(apiKey: string, endpoint: string) {
	const date = new Date().toISOString().split("T")[0];
	const usageKey = `api:usage:${apiKey}:${date}`;

	await kv.hincrby(usageKey, endpoint, 1);
	await kv.hincrby(usageKey, "total", 1);
	await kv.expire(usageKey, 90 * 24 * 60 * 60); // 90 days

	const usage = await kv.hget(usageKey, "total");
	const limit = await getAPIKeyLimit(apiKey);

	if (usage && parseInt(usage as string) > limit) {
		throw new Error("API rate limit exceeded");
	}
}

async function getAPIKeyLimit(apiKey: string): Promise<number> {
	const config = await kv.get(`api:key:${apiKey}:config`);
	return (config as any)?.dailyLimit || 1000;
}
