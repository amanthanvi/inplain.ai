/**
 * Feedback system for InPlain.AI
 * Handles user feedback, bug reports, feature requests, and ratings
 */

import { kv } from "@/app/api/lib/kv-wrapper";
import { nanoid } from "nanoid";
import { z } from "zod";

// Feedback types and schemas
export const FeedbackTypeSchema = z.enum([
	"bug",
	"feature",
	"general",
	"rating",
]);
export type FeedbackType = z.infer<typeof FeedbackTypeSchema>;

export const FeedbackStatusSchema = z.enum([
	"new",
	"in_progress",
	"resolved",
	"closed",
	"wont_fix",
]);
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>;

export const FeedbackPrioritySchema = z.enum([
	"low",
	"medium",
	"high",
	"urgent",
]);
export type FeedbackPriority = z.infer<typeof FeedbackPrioritySchema>;

export const FeedbackSentimentSchema = z.enum([
	"positive",
	"neutral",
	"negative",
]);
export type FeedbackSentiment = z.infer<typeof FeedbackSentimentSchema>;

// Context information captured with feedback
export interface FeedbackContext {
	url: string;
	userAgent: string;
	viewport: {
		width: number;
		height: number;
	};
	timestamp: string;
	sessionId?: string;
	userId?: string;
	email?: string;
}

// Screenshot attachment
export interface FeedbackScreenshot {
	id: string;
	url: string;
	annotations?: Array<{
		x: number;
		y: number;
		width: number;
		height: number;
		text?: string;
		color?: string;
	}>;
}

// Main feedback interface
export interface Feedback {
	id: string;
	type: FeedbackType;
	title: string;
	description: string;
	rating?: number; // 1-5 for rating type
	context: FeedbackContext;
	screenshots?: FeedbackScreenshot[];
	status: FeedbackStatus;
	priority?: FeedbackPriority;
	sentiment?: FeedbackSentiment;
	tags?: string[];
	createdAt: string;
	updatedAt: string;
	resolvedAt?: string;
	assignedTo?: string;
	internalNotes?: string;
	followUpEmail?: string;
	followUpSent?: boolean;
}

// Feedback submission schema
export const FeedbackSubmissionSchema = z.object({
	type: FeedbackTypeSchema,
	title: z.string().min(1).max(200),
	description: z.string().min(10).max(5000),
	rating: z.number().min(1).max(5).optional(),
	email: z.string().email().optional(),
	screenshots: z
		.array(
			z.object({
				data: z.string(), // base64 image data
				annotations: z
					.array(
						z.object({
							x: z.number(),
							y: z.number(),
							width: z.number(),
							height: z.number(),
							text: z.string().optional(),
							color: z.string().optional(),
						})
					)
					.optional(),
			})
		)
		.optional(),
	context: z.object({
		url: z.string(),
		userAgent: z.string(),
		viewport: z.object({
			width: z.number(),
			height: z.number(),
		}),
	}),
});

export type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>;

// Feedback analytics
export interface FeedbackAnalytics {
	totalCount: number;
	byType: Record<FeedbackType, number>;
	byStatus: Record<FeedbackStatus, number>;
	byPriority: Record<FeedbackPriority, number>;
	bySentiment: Record<FeedbackSentiment, number>;
	averageRating?: number;
	recentTrends: {
		daily: number[];
		weekly: number[];
	};
	topTags: Array<{ tag: string; count: number }>;
	resolutionTime: {
		average: number;
		median: number;
	};
}

// Feedback service
export class FeedbackService {
	static readonly FEEDBACK_KEY_PREFIX = "feedback:";
	static readonly FEEDBACK_INDEX_KEY = "feedback:index";
	static readonly FEEDBACK_ANALYTICS_KEY = "feedback:analytics";
	static readonly RATE_LIMIT_KEY_PREFIX = "feedback:rate_limit:";
	static readonly MAX_SUBMISSIONS_PER_HOUR = 10;
	static readonly MAX_SCREENSHOTS_PER_FEEDBACK = 5;
	static readonly MAX_SCREENSHOT_SIZE_MB = 5;

	/**
	 * Submit new feedback
	 */
	static async submitFeedback(
		submission: FeedbackSubmission,
		userId?: string
	): Promise<Feedback> {
		// Rate limiting check
		const rateLimitKey = `${this.RATE_LIMIT_KEY_PREFIX}${submission.context.url}:${userId || "anonymous"}`;
		const currentCount = ((await kv.get(rateLimitKey)) as number) || 0;
		const submissions = currentCount + 1;
		await kv.set(rateLimitKey, submissions);

		if (submissions === 1) {
			await kv.expire(rateLimitKey, 3600); // 1 hour
		}

		if (submissions > this.MAX_SUBMISSIONS_PER_HOUR) {
			throw new Error("Rate limit exceeded. Please try again later.");
		}

		// Process screenshots
		const screenshots: FeedbackScreenshot[] = [];
		if (submission.screenshots && submission.screenshots.length > 0) {
			if (
				submission.screenshots.length >
				this.MAX_SCREENSHOTS_PER_FEEDBACK
			) {
				throw new Error(
					`Maximum ${this.MAX_SCREENSHOTS_PER_FEEDBACK} screenshots allowed`
				);
			}

			for (const screenshot of submission.screenshots) {
				const screenshotId = nanoid();
				// In production, upload to cloud storage and get URL
				// For now, we'll store a reference
				screenshots.push({
					id: screenshotId,
					url: `screenshots/${screenshotId}`, // Placeholder
					annotations: screenshot.annotations,
				});
			}
		}

		// Analyze sentiment
		const sentiment = await this.analyzeSentiment(submission.description);

		// Auto-assign priority based on type and sentiment
		const priority = this.determinePriority(
			submission.type,
			sentiment,
			submission.rating
		);

		// Create feedback object
		const feedback: Feedback = {
			id: nanoid(),
			type: submission.type,
			title: submission.title,
			description: submission.description,
			rating: submission.rating,
			context: {
				...submission.context,
				timestamp: new Date().toISOString(),
				userId,
				email: submission.email,
				sessionId: nanoid(), // Generate session ID
			},
			screenshots,
			status: "new",
			priority,
			sentiment,
			tags: await this.extractTags(
				submission.title + " " + submission.description
			),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			followUpEmail: submission.email,
		};

		// Store feedback
		await kv.set(
			`${this.FEEDBACK_KEY_PREFIX}${feedback.id}`,
			JSON.stringify(feedback)
		);

		// Add to sorted index (by timestamp)
		await kv.zadd(this.FEEDBACK_INDEX_KEY, {
			score: Date.now(),
			member: feedback.id,
		});

		// Update analytics
		await this.updateAnalytics(feedback);

		// Send notification if urgent
		if (priority === "urgent") {
			await this.sendUrgentNotification(feedback);
		}

		return feedback;
	}

	/**
	 * Get feedback by ID
	 */
	static async getFeedback(id: string): Promise<Feedback | null> {
		const data = await kv.get(`${this.FEEDBACK_KEY_PREFIX}${id}`);
		return data ? JSON.parse(data as string) : null;
	}

	/**
	 * List feedback with filters
	 */
	static async listFeedback(
		options: {
			type?: FeedbackType;
			status?: FeedbackStatus;
			priority?: FeedbackPriority;
			sentiment?: FeedbackSentiment;
			userId?: string;
			limit?: number;
			offset?: number;
		} = {}
	): Promise<{ items: Feedback[]; total: number }> {
		const { limit = 20, offset = 0 } = options;

		// Get all feedback IDs from index (sorted by timestamp)
		const allIds = await kv.zrange(this.FEEDBACK_INDEX_KEY, 0, -1);
		// Reverse to get newest first
		allIds.reverse();

		// Fetch and filter feedback
		const allFeedback: Feedback[] = [];
		for (const id of allIds) {
			const feedback = await this.getFeedback(id as string);
			if (feedback) {
				// Apply filters
				if (options.type && feedback.type !== options.type) {
					continue;
				}
				if (options.status && feedback.status !== options.status) {
					continue;
				}
				if (options.priority && feedback.priority !== options.priority) {
					continue;
				}
				if (
					options.sentiment &&
					feedback.sentiment !== options.sentiment
				) {
					continue;
				}
				if (
					options.userId &&
					feedback.context.userId !== options.userId
				) {
					continue;
				}

				allFeedback.push(feedback);
			}
		}

		// Paginate
		const items = allFeedback.slice(offset, offset + limit);

		return {
			items,
			total: allFeedback.length,
		};
	}

	/**
	 * Update feedback status
	 */
	static async updateFeedbackStatus(
		id: string,
		status: FeedbackStatus,
		notes?: string,
		assignedTo?: string
	): Promise<Feedback | null> {
		const feedback = await this.getFeedback(id);
		if (!feedback) {
			return null;
		}

		feedback.status = status;
		feedback.updatedAt = new Date().toISOString();

		if (status === "resolved" || status === "closed") {
			feedback.resolvedAt = new Date().toISOString();
		}

		if (notes) {
			feedback.internalNotes =
				(feedback.internalNotes || "") + "\n" + notes;
		}

		if (assignedTo) {
			feedback.assignedTo = assignedTo;
		}

		await kv.set(
			`${this.FEEDBACK_KEY_PREFIX}${id}`,
			JSON.stringify(feedback)
		);

		// Send follow-up email if resolved and email provided
		if (
			status === "resolved" &&
			feedback.followUpEmail &&
			!feedback.followUpSent
		) {
			await this.sendFollowUpEmail(feedback);
			feedback.followUpSent = true;
			await kv.set(
				`${this.FEEDBACK_KEY_PREFIX}${id}`,
				JSON.stringify(feedback)
			);
		}

		return feedback;
	}

	/**
	 * Get feedback analytics
	 */
	static async getAnalytics(): Promise<FeedbackAnalytics> {
		const cached = await kv.get(this.FEEDBACK_ANALYTICS_KEY);
		if (cached) {
			return JSON.parse(cached as string);
		}

		// Calculate analytics
		const { items: allFeedback } = await this.listFeedback({ limit: 1000 });

		const analytics: FeedbackAnalytics = {
			totalCount: allFeedback.length,
			byType: { bug: 0, feature: 0, general: 0, rating: 0 },
			byStatus: {
				new: 0,
				in_progress: 0,
				resolved: 0,
				closed: 0,
				wont_fix: 0,
			},
			byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
			bySentiment: { positive: 0, neutral: 0, negative: 0 },
			recentTrends: {
				daily: [],
				weekly: [],
			},
			topTags: [],
			resolutionTime: {
				average: 0,
				median: 0,
			},
		};

		// Process feedback
		let totalRating = 0;
		let ratingCount = 0;
		const resolutionTimes: number[] = [];
		const tagCounts: Record<string, number> = {};

		for (const feedback of allFeedback) {
			// Count by type
			analytics.byType[feedback.type]++;

			// Count by status
			analytics.byStatus[feedback.status]++;

			// Count by priority
			if (feedback.priority) {
				analytics.byPriority[feedback.priority]++;
			}

			// Count by sentiment
			if (feedback.sentiment) {
				analytics.bySentiment[feedback.sentiment]++;
			}

			// Calculate average rating
			if (feedback.rating) {
				totalRating += feedback.rating;
				ratingCount++;
			}

			// Calculate resolution time
			if (feedback.resolvedAt) {
				const resolutionTime =
					new Date(feedback.resolvedAt).getTime() -
					new Date(feedback.createdAt).getTime();
				resolutionTimes.push(resolutionTime);
			}

			// Count tags
			if (feedback.tags) {
				for (const tag of feedback.tags) {
					tagCounts[tag] = (tagCounts[tag] || 0) + 1;
				}
			}
		}

		// Calculate averages
		if (ratingCount > 0) {
			analytics.averageRating = totalRating / ratingCount;
		}

		if (resolutionTimes.length > 0) {
			analytics.resolutionTime.average =
				resolutionTimes.reduce((a, b) => a + b, 0) /
				resolutionTimes.length;
			resolutionTimes.sort((a, b) => a - b);
			const medianIndex = Math.floor(resolutionTimes.length / 2);
			analytics.resolutionTime.median = resolutionTimes[medianIndex] || 0;
		}

		// Get top tags
		analytics.topTags = Object.entries(tagCounts)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 10)
			.map(([tag, count]) => ({ tag, count }));

		// Cache analytics for 1 hour
		await kv.set(this.FEEDBACK_ANALYTICS_KEY, JSON.stringify(analytics), {
			ex: 3600,
		});

		return analytics;
	}

	/**
	 * Analyze sentiment using simple keyword analysis
	 * In production, use AI service for better accuracy
	 */
	private static async analyzeSentiment(
		text: string
	): Promise<FeedbackSentiment> {
		const positiveKeywords = [
			"great",
			"excellent",
			"love",
			"amazing",
			"perfect",
			"thank",
			"helpful",
			"awesome",
		];
		const negativeKeywords = [
			"bad",
			"terrible",
			"hate",
			"awful",
			"broken",
			"frustrated",
			"annoying",
			"useless",
		];

		const lowerText = text.toLowerCase();
		const positiveScore = positiveKeywords.filter((word) =>
			lowerText.includes(word)
		).length;
		const negativeScore = negativeKeywords.filter((word) =>
			lowerText.includes(word)
		).length;

		if (positiveScore > negativeScore) {
			return "positive";
		}
		if (negativeScore > positiveScore) {
			return "negative";
		}
		return "neutral";
	}

	/**
	 * Determine priority based on type, sentiment, and rating
	 */
	private static determinePriority(
		type: FeedbackType,
		sentiment: FeedbackSentiment,
		rating?: number
	): FeedbackPriority {
		if (type === "bug" && sentiment === "negative") {
			return "urgent";
		}
		if (type === "bug") {
			return "high";
		}
		if (rating && rating <= 2) {
			return "high";
		}
		if (type === "feature" && sentiment === "positive") {
			return "medium";
		}
		if (sentiment === "negative") {
			return "medium";
		}
		return "low";
	}

	/**
	 * Extract tags from text
	 */
	private static async extractTags(text: string): Promise<string[]> {
		// Simple tag extraction based on common keywords
		const keywords = [
			"performance",
			"security",
			"privacy",
			"ui",
			"ux",
			"mobile",
			"desktop",
			"api",
			"integration",
			"data",
			"export",
			"import",
			"notification",
			"email",
			"login",
			"auth",
			"payment",
			"subscription",
			"dashboard",
			"analytics",
		];

		const lowerText = text.toLowerCase();
		return keywords.filter((keyword) => lowerText.includes(keyword));
	}

	/**
	 * Update analytics cache
	 */
	private static async updateAnalytics(feedback: Feedback): Promise<void> {
		// Invalidate analytics cache
		await kv.del(this.FEEDBACK_ANALYTICS_KEY);
	}

	/**
	 * Send urgent notification
	 */
	private static async sendUrgentNotification(
		feedback: Feedback
	): Promise<void> {
		try {
			const { EmailService } = await import("@/lib/email");
			await EmailService.sendFeedbackNotification(feedback);
		} catch (error) {
			console.error("Failed to send urgent notification:", error);
		}
	}

	/**
	 * Send follow-up email
	 */
	private static async sendFollowUpEmail(feedback: Feedback): Promise<void> {
		try {
			const { EmailService } = await import("@/lib/email");
			await EmailService.sendFeedbackFollowUp(feedback);
		} catch (error) {
			console.error("Failed to send follow-up email:", error);
		}
	}
}
