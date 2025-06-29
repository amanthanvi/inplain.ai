import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
	withErrorHandling,
	AuthenticationError,
	ValidationError,
	RateLimitError,
} from "@/lib/errors/api-errors";
import { performanceMonitor } from "@/lib/monitoring/performance";
import { logger } from "@/lib/monitoring";
import { validateAPIKey } from "@/lib/security/validation-edge";
import { policySummarizer } from "@/lib/ai/policy-summarizer";
import { kv } from "@vercel/kv";

export const runtime = "edge";

// Request schema
const summarizeRequestSchema = z.object({
	policyText: z.string().min(100).max(100000),
	options: z
		.object({
			companyName: z.string().optional(),
			industry: z.string().optional(),
			targetAudience: z
				.enum(["general", "technical", "legal"])
				.optional(),
			language: z.string().optional(),
		})
		.optional(),
});

// POST /api/v1/policies/summarize
export const POST = withErrorHandling(async (request: NextRequest) => {
	const transactionId = performanceMonitor.startTransaction(
		"api.v1.policies.summarize"
	);

	try {
		// Validate API key
		const apiKey = request.headers.get("x-api-key");
		if (!apiKey || !validateAPIKey(apiKey)) {
			throw new AuthenticationError("Invalid or missing API key");
		}

		// Check rate limits
		await checkRateLimit(apiKey);

		// Track API usage
		await trackAPIUsage(apiKey, "policies.summarize");

		// Parse and validate request body
		const body = await request.json();
		const validatedData = summarizeRequestSchema.parse(body);

		// Generate summary
		const summary = await policySummarizer.summarizePolicy(
			validatedData.policyText,
			validatedData.options
		);

		performanceMonitor.endTransaction(transactionId);

		return NextResponse.json({
			success: true,
			data: summary,
			metadata: {
				timestamp: new Date().toISOString(),
				version: "1.0",
			},
		});
	} catch (error) {
		performanceMonitor.endTransaction(transactionId);

		if (error instanceof z.ZodError) {
			throw new ValidationError("Invalid request data", error.errors);
		}

		throw error;
	}
});

// Rate limiting helper
async function checkRateLimit(apiKey: string) {
	const date = new Date().toISOString().split("T")[0];
	const hourKey = `api:rate:${apiKey}:${date}:${new Date().getHours()}`;

	// Check hourly rate limit (100 requests per hour for summarization)
	const hourlyCount = await kv.incr(hourKey);
	await kv.expire(hourKey, 3600); // 1 hour

	if (hourlyCount > 100) {
		const retryAfter =
			3600 - (new Date().getMinutes() * 60 + new Date().getSeconds());
		throw new RateLimitError(retryAfter);
	}
}

// Usage tracking helper
async function trackAPIUsage(apiKey: string, endpoint: string) {
	const date = new Date().toISOString().split("T")[0];
	const usageKey = `api:usage:${apiKey}:${date}`;

	await kv.hincrby(usageKey, endpoint, 1);
	await kv.hincrby(usageKey, "total", 1);
	await kv.expire(usageKey, 90 * 24 * 60 * 60); // 90 days

	// Check daily limits
	const usage = await kv.hget(usageKey, "total");
	const limit = await getAPIKeyLimit(apiKey);

	if (usage && parseInt(usage as string) > limit) {
		throw new RateLimitError(86400); // Retry after 24 hours
	}

	// Log usage for analytics
	logger.info("API usage tracked", {
		apiKey: apiKey.substring(0, 8) + "...",
		endpoint,
		date,
		count: usage,
	});
}

async function getAPIKeyLimit(apiKey: string): Promise<number> {
	const config = await kv.get(`api:key:${apiKey}:config`);
	return (config as any)?.dailyLimit || 1000;
}
