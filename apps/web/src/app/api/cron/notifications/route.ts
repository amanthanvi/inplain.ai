import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { kv } from "@vercel/kv";
import { EmailService } from "@/lib/email";
import { logger } from "@/lib/monitoring";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

/**
 * Notification Cron Job
 * Runs every hour to:
 * 1. Process notification queue
 * 2. Send scheduled digest emails
 * 3. Clean up old notifications
 * 4. Update email statistics
 */
export async function GET(request: NextRequest) {
	try {
		// Verify cron secret
		const authHeader = (await headers()).get("authorization");
		if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		logger.info("Starting notification cron job");
		const startTime = Date.now();

		// Initialize results tracking
		const results = {
			queueProcessed: 0,
			weeklyDigestsSent: 0,
			monthlyDigestsSent: 0,
			welcomeEmailsSent: 0,
			failedNotifications: 0,
			errors: [] as string[],
		};

		// 1. Process notification queue
		try {
			logger.info("Processing notification queue");
			results.queueProcessed =
				await EmailService.processNotificationQueue(50); // Process up to 50 items
			logger.info(
				`Processed ${results.queueProcessed} notifications from queue`
			);
		} catch (error) {
			const errorMsg = `Failed to process notification queue: ${error}`;
			logger.error(errorMsg);
			results.errors.push(errorMsg);
		}

		// 2. Send weekly digests (run on Mondays at 9 AM UTC)
		const now = new Date();
		const isMonday = now.getUTCDay() === 1;
		const isDigestTime = now.getUTCHours() === 9;

		if (isMonday && isDigestTime) {
			try {
				logger.info("Sending weekly digests");
				results.weeklyDigestsSent = await sendWeeklyDigests();
				logger.info(`Sent ${results.weeklyDigestsSent} weekly digests`);
			} catch (error) {
				const errorMsg = `Failed to send weekly digests: ${error}`;
				logger.error(errorMsg);
				results.errors.push(errorMsg);
			}
		}

		// 3. Send monthly digests (run on 1st of month at 10 AM UTC)
		const isFirstOfMonth = now.getUTCDate() === 1;
		const isMonthlyDigestTime = now.getUTCHours() === 10;

		if (isFirstOfMonth && isMonthlyDigestTime) {
			try {
				logger.info("Sending monthly digests");
				results.monthlyDigestsSent = await sendMonthlyDigests();
				logger.info(
					`Sent ${results.monthlyDigestsSent} monthly digests`
				);
			} catch (error) {
				const errorMsg = `Failed to send monthly digests: ${error}`;
				logger.error(errorMsg);
				results.errors.push(errorMsg);
			}
		}

		// 4. Process welcome emails for new users
		try {
			logger.info("Processing welcome emails");
			results.welcomeEmailsSent = await processWelcomeEmails();
			logger.info(`Sent ${results.welcomeEmailsSent} welcome emails`);
		} catch (error) {
			const errorMsg = `Failed to process welcome emails: ${error}`;
			logger.error(errorMsg);
			results.errors.push(errorMsg);
		}

		// 5. Clean up old notifications (older than 30 days)
		try {
			logger.info("Cleaning up old notifications");
			await cleanupOldNotifications();
			logger.info("Completed notification cleanup");
		} catch (error) {
			const errorMsg = `Failed to cleanup old notifications: ${error}`;
			logger.error(errorMsg);
			results.errors.push(errorMsg);
		}

		// 6. Update queue statistics
		const queueStats = await EmailService.getQueueStats();

		// Store cron run statistics
		const cronStats = {
			timestamp: new Date().toISOString(),
			duration: Date.now() - startTime,
			results,
			queueStats,
		};

		await kv.set("notification:cron:last-run", cronStats, {
			ex: 86400 * 7,
		}); // Keep for 7 days

		logger.info("Notification cron job completed", cronStats);

		return NextResponse.json({
			success: true,
			duration: cronStats.duration,
			results,
			queueStats,
		});
	} catch (error) {
		logger.error("Notification cron job failed", { error });
		return NextResponse.json(
			{
				error: "Cron job failed",
				message:
					error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

/**
 * Send weekly digests to all eligible users
 */
async function sendWeeklyDigests(): Promise<number> {
	let sent = 0;

	try {
		// Get all user preference keys
		const userPrefKeys = await kv.keys("email:preferences:*");

		for (const key of userPrefKeys) {
			const userId = key.split(":")[2];
			if (!userId) {
				continue;
			}

			try {
				const preferences =
					await EmailService.getEmailPreferences(userId);

				// Check if user wants weekly digests and hasn't unsubscribed
				if (!preferences.unsubscribed && preferences.weeklyDigest) {
					// Check if we already sent a digest this week
					const lastSent = await kv.get(
						`email:digest:${userId}:weekly:last-sent`
					);
					const oneWeekAgo = new Date(
						Date.now() - 7 * 24 * 60 * 60 * 1000
					);

					if (
						!lastSent ||
						new Date(lastSent as string) < oneWeekAgo
					) {
						const success =
							await EmailService.sendWeeklyDigest(userId);
						if (success) {
							sent++;
						}
					}
				}
			} catch (error) {
				logger.error(
					`Failed to send weekly digest for user ${userId}`,
					{ error }
				);
			}
		}
	} catch (error) {
		logger.error("Failed to get user preferences for weekly digests", {
			error,
		});
	}

	return sent;
}

/**
 * Send monthly digests to all eligible users
 */
async function sendMonthlyDigests(): Promise<number> {
	let sent = 0;

	try {
		// Get all user preference keys
		const userPrefKeys = await kv.keys("email:preferences:*");

		for (const key of userPrefKeys) {
			const userId = key.split(":")[2];
			if (!userId) {
				continue;
			}

			try {
				const preferences =
					await EmailService.getEmailPreferences(userId);

				// Check if user wants monthly digests and hasn't unsubscribed
				if (!preferences.unsubscribed && preferences.monthlyDigest) {
					// Check if we already sent a digest this month
					const lastSent = await kv.get(
						`email:digest:${userId}:monthly:last-sent`
					);
					const oneMonthAgo = new Date(
						Date.now() - 30 * 24 * 60 * 60 * 1000
					);

					if (
						!lastSent ||
						new Date(lastSent as string) < oneMonthAgo
					) {
						const success =
							await EmailService.sendMonthlyDigest(userId);
						if (success) {
							sent++;
						}
					}
				}
			} catch (error) {
				logger.error(
					`Failed to send monthly digest for user ${userId}`,
					{ error }
				);
			}
		}
	} catch (error) {
		logger.error("Failed to get user preferences for monthly digests", {
			error,
		});
	}

	return sent;
}

/**
 * Process welcome emails for recently registered users
 */
async function processWelcomeEmails(): Promise<number> {
	let sent = 0;

	try {
		// Get list of users who need welcome emails
		const welcomeQueue = (await kv.lrange(
			"welcome-email:queue",
			0,
			49
		)) as string[]; // Process up to 50

		for (const userId of welcomeQueue) {
			try {
				// Check if welcome email was already sent
				const alreadySent = await kv.get(
					`welcome-email:sent:${userId}`
				);
				if (alreadySent) {
					// Remove from queue and continue
					await kv.lrem("welcome-email:queue", 1, userId);
					continue;
				}

				// Get user data
				const user = await kv.get(`user:${userId}`);
				if (!user) {
					// Remove invalid user from queue
					await kv.lrem("welcome-email:queue", 1, userId);
					continue;
				}

				// Send welcome email
				const success = await EmailService.sendWelcomeEmail(
					user as any
				);
				if (success) {
					sent++;
					// Mark as sent and remove from queue
					await kv.set(
						`welcome-email:sent:${userId}`,
						new Date().toISOString(),
						{ ex: 86400 * 365 }
					);
					await kv.lrem("welcome-email:queue", 1, userId);
				}
			} catch (error) {
				logger.error(
					`Failed to send welcome email for user ${userId}`,
					{ error }
				);
			}
		}
	} catch (error) {
		logger.error("Failed to process welcome email queue", { error });
	}

	return sent;
}

/**
 * Clean up old notifications and email data
 */
async function cleanupOldNotifications(): Promise<void> {
	const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

	try {
		// Clean up old notification queue items
		const queueKeys = await kv.keys("notification:queue:*");

		for (const key of queueKeys) {
			try {
				const item = await kv.get(key);
				if (
					item &&
					typeof item === "object" &&
					"scheduledFor" in item
				) {
					const scheduledDate = new Date(item.scheduledFor as string);
					if (scheduledDate < thirtyDaysAgo) {
						await kv.del(key);
					}
				}
			} catch (error) {
				// If we can't parse the item, delete it
				await kv.del(key);
			}
		}

		// Clean up old email statistics (keep last 90 days)
		const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
		const statsKeys = await kv.keys("email:stats:*");

		for (const key of statsKeys) {
			const keyParts = key.split(":");
			if (keyParts.length >= 4 && keyParts[3]) {
				const date = keyParts[3];
				try {
					const statsDate = new Date(date);
					if (statsDate < ninetyDaysAgo) {
						await kv.del(key);
					}
				} catch {
					// If we can't parse the date, delete it
					await kv.del(key);
				}
			}
		}

		logger.info("Completed cleanup of old notifications and statistics");
	} catch (error) {
		logger.error("Failed to cleanup old notifications", { error });
	}
}

/**
 * Helper function to add a user to the welcome email queue
 * Call this when a new user signs up
 */
export async function queueWelcomeEmail(userId: string): Promise<void> {
	await kv.lpush("welcome-email:queue", userId);
}

/**
 * Helper function to immediately send a critical alert
 * Bypasses the queue for urgent notifications
 */
export async function sendCriticalAlert(
	userId: string,
	alert: {
		companySlug: string;
		changeType: string;
		summary: string;
		details: any;
	}
): Promise<boolean> {
	try {
		// Create alert object
		const alertId = `alert:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		const alertData = {
			id: alertId,
			userId,
			companySlug: alert.companySlug,
			changeType: alert.changeType,
			summary: alert.summary,
			details: alert.details,
			timestamp: new Date().toISOString(),
			emailSent: false,
			watchlistId: "critical", // Special watchlist for critical alerts
			read: false,
		};

		// Store alert
		await kv.hset(`alert:${alertId}`, alertData as any);

		// Send immediately
		return await EmailService.sendWatchlistAlert(alertId);
	} catch (error) {
		logger.error("Failed to send critical alert", { error, userId, alert });
		return false;
	}
}
