import { NextRequest, NextResponse } from "next/server";
import {
	withErrorHandling,
	AuthenticationError,
} from "@/lib/errors/api-errors";
import { performanceMonitor } from "@/lib/monitoring/performance";
import { logger } from "@/lib/monitoring";
import { validateAPIKey } from "@/lib/security/validation-edge";
import { kv } from "@vercel/kv";
import type { NotificationPreferences } from "@/lib/notifications/notification-service";

export const runtime = "edge";

// GET /api/v1/notifications/settings
export const GET = withErrorHandling(async (request: NextRequest) => {
	const transactionId = performanceMonitor.startTransaction(
		"api.v1.notifications.settings.get"
	);

	try {
		// Validate API key
		const apiKey = request.headers.get("x-api-key");
		if (!apiKey || !validateAPIKey(apiKey)) {
			throw new AuthenticationError("Invalid or missing API key");
		}

		// Get user ID from API key
		const userId = await getUserIdFromAPIKey(apiKey);
		if (!userId) {
			throw new AuthenticationError("Invalid API key");
		}

		// Track API usage
		await trackAPIUsage(apiKey, "notifications.settings.get");

		// Get notification preferences
		const preferences = await getNotificationPreferences(userId);

		// Format response
		const formattedPreferences = {
			channels: {
				email: preferences.enableEmail,
				push: preferences.enableDesktop,
				inApp: preferences.enableToast,
				sound: preferences.enableSound,
			},
			quietHours: preferences.quietHours,
			subscriptions: preferences.subscriptions.map((sub) => ({
				companySlug: sub.companySlug,
				companyName: sub.companyName,
				notificationTypes: sub.types,
				severityLevels: sub.severity,
				deliveryChannels: sub.channels,
			})),
			defaults: {
				notificationTypes: ["policy-change", "risk-alert"],
				severityLevels: ["critical", "warning"],
				deliveryChannels: ["email", "in-app"],
			},
		};

		performanceMonitor.endTransaction(transactionId);

		return NextResponse.json({
			success: true,
			data: formattedPreferences,
			metadata: {
				timestamp: new Date().toISOString(),
				version: "1.0",
			},
		});
	} catch (error) {
		performanceMonitor.endTransaction(transactionId);
		throw error;
	}
});

async function getNotificationPreferences(
	userId: string
): Promise<NotificationPreferences> {
	const preferencesKey = `user:${userId}:notification:preferences`;
	const preferences = await kv.get(preferencesKey);

	if (preferences) {
		return preferences as NotificationPreferences;
	}

	// Return default preferences
	return {
		enableSound: true,
		enableDesktop: true,
		enableToast: true,
		enableEmail: true,
		quietHours: {
			enabled: false,
			start: "22:00",
			end: "08:00",
		},
		subscriptions: [],
	};
}

async function getUserIdFromAPIKey(apiKey: string): Promise<string | null> {
	const keyData = await kv.get(`api:key:${apiKey}`);
	return (keyData as any)?.userId || null;
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

// PUT /api/v1/notifications/settings
export const PUT = withErrorHandling(async (request: NextRequest) => {
	const transactionId = performanceMonitor.startTransaction(
		"api.v1.notifications.settings.put"
	);

	try {
		// Validate API key
		const apiKey = request.headers.get("x-api-key");
		if (!apiKey || !validateAPIKey(apiKey)) {
			throw new AuthenticationError("Invalid or missing API key");
		}

		// Get user ID from API key
		const userId = await getUserIdFromAPIKey(apiKey);
		if (!userId) {
			throw new AuthenticationError("Invalid API key");
		}

		// Track API usage
		await trackAPIUsage(apiKey, "notifications.settings.put");

		// Parse request body
		const body = await request.json();

		// Get current preferences
		const currentPreferences = await getNotificationPreferences(userId);

		// Update preferences
		const updatedPreferences: NotificationPreferences = {
			...currentPreferences,
			enableEmail: body.channels?.email ?? currentPreferences.enableEmail,
			enableDesktop:
				body.channels?.push ?? currentPreferences.enableDesktop,
			enableToast: body.channels?.inApp ?? currentPreferences.enableToast,
			enableSound: body.channels?.sound ?? currentPreferences.enableSound,
			quietHours: body.quietHours
				? {
						enabled:
							body.quietHours.enabled ??
							currentPreferences.quietHours.enabled,
						start:
							body.quietHours.start ??
							currentPreferences.quietHours.start,
						end:
							body.quietHours.end ??
							currentPreferences.quietHours.end,
					}
				: currentPreferences.quietHours,
			subscriptions: body.subscriptions
				? body.subscriptions.map((sub: any) => ({
						companySlug: sub.companySlug,
						companyName: sub.companyName,
						types: sub.notificationTypes || [
							"policy-change",
							"risk-alert",
						],
						severity: sub.severityLevels || ["critical", "warning"],
						channels: sub.deliveryChannels || ["email", "in-app"],
					}))
				: currentPreferences.subscriptions,
		};

		// Save updated preferences
		const preferencesKey = `user:${userId}:notification:preferences`;
		await kv.set(preferencesKey, updatedPreferences);

		// Log the update
		logger.info("Notification preferences updated via API", {
			userId,
			changes: {
				channels: body.channels ? Object.keys(body.channels) : [],
				quietHours: !!body.quietHours,
				subscriptions: body.subscriptions?.length,
			},
		});

		// Format response
		const formattedPreferences = {
			channels: {
				email: updatedPreferences.enableEmail,
				push: updatedPreferences.enableDesktop,
				inApp: updatedPreferences.enableToast,
				sound: updatedPreferences.enableSound,
			},
			quietHours: updatedPreferences.quietHours,
			subscriptions: updatedPreferences.subscriptions.map((sub) => ({
				companySlug: sub.companySlug,
				companyName: sub.companyName,
				notificationTypes: sub.types,
				severityLevels: sub.severity,
				deliveryChannels: sub.channels,
			})),
			defaults: {
				notificationTypes: ["policy-change", "risk-alert"],
				severityLevels: ["critical", "warning"],
				deliveryChannels: ["email", "in-app"],
			},
		};

		performanceMonitor.endTransaction(transactionId);

		return NextResponse.json({
			success: true,
			data: formattedPreferences,
			metadata: {
				timestamp: new Date().toISOString(),
				version: "1.0",
			},
		});
	} catch (error) {
		performanceMonitor.endTransaction(transactionId);
		throw error;
	}
});
