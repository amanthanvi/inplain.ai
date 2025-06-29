import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { kv } from "@vercel/kv";
import { EmailService, EmailPreferences } from "@/lib/email";

export const runtime = "edge";

/**
 * Enhanced Email Preferences API
 * Handles comprehensive email notification settings including:
 * - Policy change notifications
 * - Digest frequency settings
 * - Critical alert preferences
 * - Product update notifications
 * - Unsubscribe management
 */

// GET /api/email/preferences - Get user email preferences
export async function GET(request: NextRequest) {
	try {
		const { userId } = await auth();

		if (!userId) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		// Get email preferences
		const emailPreferences = await EmailService.getEmailPreferences(userId);

		// Get additional user settings
		const userSettings =
			((await kv.get(`user:settings:${userId}`)) as any) || {};

		// Get notification history stats
		const emailStats = await EmailService.getEmailStats(30);

		// Get last digest dates
		const lastWeeklyDigest = await kv.get(
			`email:digest:${userId}:weekly:last-sent`
		);
		const lastMonthlyDigest = await kv.get(
			`email:digest:${userId}:monthly:last-sent`
		);

		return NextResponse.json({
			emailPreferences,
			userSettings: {
				timezone: userSettings.timezone || "UTC",
				language: userSettings.language || "en",
				dateFormat: userSettings.dateFormat || "MM/dd/yyyy",
			},
			stats: {
				emailsSentLast30Days: emailStats.sent,
				emailsFailedLast30Days: emailStats.failed,
				lastWeeklyDigest,
				lastMonthlyDigest,
			},
		});
	} catch (error) {
		console.error("Failed to get email preferences:", error);
		return NextResponse.json(
			{ error: "Failed to get preferences" },
			{ status: 500 }
		);
	}
}

// POST /api/email/preferences - Update user email preferences
export async function POST(request: NextRequest) {
	try {
		const { userId } = await auth();

		if (!userId) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const body = await request.json();
		const { emailPreferences, userSettings } = body as {
			emailPreferences?: Partial<EmailPreferences>;
			userSettings?: {
				timezone?: string;
				language?: string;
				dateFormat?: string;
			};
		};

		// Update email preferences if provided
		if (emailPreferences) {
			// Validate preferences
			const validatedPreferences =
				await validateEmailPreferences(emailPreferences);
			if (!validatedPreferences.valid) {
				return NextResponse.json(
					{
						error: "Invalid preferences",
						details: validatedPreferences.errors,
					},
					{ status: 400 }
				);
			}

			await EmailService.updateEmailPreferences(userId, emailPreferences);

			// Log preference changes for analytics
			await logPreferenceChange(userId, emailPreferences);
		}

		// Update user settings if provided
		if (userSettings) {
			const currentSettings =
				((await kv.get(`user:settings:${userId}`)) as any) || {};
			const updatedSettings = { ...currentSettings, ...userSettings };
			await kv.set(`user:settings:${userId}`, updatedSettings);
		}

		// Get updated preferences
		const updatedEmailPreferences =
			await EmailService.getEmailPreferences(userId);
		const updatedUserSettings =
			((await kv.get(`user:settings:${userId}`)) as any) || {};

		return NextResponse.json({
			success: true,
			emailPreferences: updatedEmailPreferences,
			userSettings: updatedUserSettings,
		});
	} catch (error) {
		console.error("Failed to update email preferences:", error);
		return NextResponse.json(
			{ error: "Failed to update preferences" },
			{ status: 500 }
		);
	}
}

// PUT /api/email/preferences - Reset preferences to defaults
export async function PUT(request: NextRequest) {
	try {
		const { userId } = await auth();

		if (!userId) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const body = await request.json();
		const { resetType } = body as { resetType: "email" | "all" };

		if (resetType === "email" || resetType === "all") {
			// Reset to default email preferences
			const defaultPreferences: EmailPreferences = {
				policyChanges: true,
				weeklyDigest: true,
				monthlyDigest: false,
				urgentAlerts: true,
				marketingEmails: true,
				frequency: "immediate",
				unsubscribed: false,
				timezone: "UTC",
				language: "en",
				categories: [],
			};

			await EmailService.updateEmailPreferences(
				userId,
				defaultPreferences
			);

			// Log reset action
			await kv.lpush(`user:activity:${userId}`, {
				type: "preferences_reset",
				resetType: "email",
				timestamp: new Date().toISOString(),
			});
		}

		if (resetType === "all") {
			// Reset user settings
			const defaultSettings = {
				timezone: "UTC",
				language: "en",
				dateFormat: "MM/dd/yyyy",
			};

			await kv.set(`user:settings:${userId}`, defaultSettings);
		}

		// Get updated preferences
		const emailPreferences = await EmailService.getEmailPreferences(userId);
		const userSettings =
			((await kv.get(`user:settings:${userId}`)) as any) || {};

		return NextResponse.json({
			success: true,
			emailPreferences,
			userSettings,
		});
	} catch (error) {
		console.error("Failed to reset email preferences:", error);
		return NextResponse.json(
			{ error: "Failed to reset preferences" },
			{ status: 500 }
		);
	}
}

/**
 * Validate email preferences
 */
async function validateEmailPreferences(
	preferences: Partial<EmailPreferences>
): Promise<{
	valid: boolean;
	errors: string[];
}> {
	const errors: string[] = [];

	// Validate frequency
	if (
		preferences.frequency &&
		!["immediate", "daily", "weekly", "monthly"].includes(
			preferences.frequency
		)
	) {
		errors.push("Invalid frequency value");
	}

	// Validate boolean values
	const booleanFields = [
		"policyChanges",
		"weeklyDigest",
		"monthlyDigest",
		"urgentAlerts",
		"marketingEmails",
		"unsubscribed",
	];
	for (const field of booleanFields) {
		if (
			preferences[field as keyof EmailPreferences] !== undefined &&
			typeof preferences[field as keyof EmailPreferences] !== "boolean"
		) {
			errors.push(`${field} must be a boolean value`);
		}
	}

	// Business logic validation
	if (preferences.weeklyDigest && preferences.monthlyDigest) {
		// Both weekly and monthly enabled - suggest one or the other
		errors.push(
			"Consider enabling either weekly OR monthly digest for better experience"
		);
	}

	if (
		preferences.unsubscribed &&
		(preferences.policyChanges ||
			preferences.weeklyDigest ||
			preferences.monthlyDigest)
	) {
		errors.push("Cannot enable notifications while unsubscribed");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Log preference changes for analytics
 */
async function logPreferenceChange(
	userId: string,
	changes: Partial<EmailPreferences>
): Promise<void> {
	try {
		const changeLog = {
			userId,
			changes,
			timestamp: new Date().toISOString(),
			ip: "", // Could add IP tracking if needed
			userAgent: "", // Could add user agent if needed
		};

		// Store individual change
		await kv.lpush(`preference:changes:${userId}`, changeLog);

		// Keep only last 50 changes per user
		await kv.ltrim(`preference:changes:${userId}`, 0, 49);

		// Store aggregated analytics
		const today = new Date().toISOString().split("T")[0];

		for (const [key, value] of Object.entries(changes)) {
			if (typeof value === "boolean") {
				const action = value ? "enabled" : "disabled";
				await kv.incr(
					`analytics:preferences:${key}:${action}:${today}`
				);
			}
		}
	} catch (error) {
		console.error("Failed to log preference change:", error);
	}
}

// Export helper function for other modules
async function getUserEmailPreferences(
	userId: string
): Promise<EmailPreferences> {
	return EmailService.getEmailPreferences(userId);
}
