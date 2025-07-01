import { Resend } from "resend";
import { kv } from "@vercel/kv";
import { User } from "./types/auth";
import { WatchlistService, WatchlistAlert } from "./watchlist";
import { Feedback } from "./feedback";

const resend = process.env.RESEND_API_KEY
	? new Resend(process.env.RESEND_API_KEY)
	: null;

export interface EmailTemplate {
	subject: string;
	html: string;
	text: string;
}

export interface EmailPreferences {
	policyChanges: boolean;
	weeklyDigest: boolean;
	monthlyDigest: boolean;
	urgentAlerts: boolean;
	marketingEmails: boolean;
	unsubscribed: boolean;
	frequency: "immediate" | "daily" | "weekly" | "monthly";
	timezone: string;
	language: string;
	categories: string[];
}

export class EmailService {
	static generateWatchlistAlertEmail(
		user: User,
		alert: WatchlistAlert,
		watchlistName: string
	): EmailTemplate {
		const changeTypeColors = {
			minor: "#3b82f6",
			significant: "#f59e0b",
			critical: "#ef4444",
		};

		const changeTypeLabels = {
			minor: "Minor Change",
			significant: "Significant Change",
			critical: "Critical Change",
		};

		const color = changeTypeColors[alert.changeType];
		const label = changeTypeLabels[alert.changeType];

		const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inplain.AI Alert</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #1a1a1a; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 40px 30px; }
    .alert-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; color: white; background: ${color}; margin-bottom: 20px; }
    .summary { font-size: 18px; margin: 20px 0; color: #1a1a1a; }
    .details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #2563eb; }
    .footer { padding: 30px; text-align: center; font-size: 14px; color: #666; background: #f8f9fa; }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Inplain.AI Alert</h1>
    </div>
    <div class="content">
      <div class="alert-badge">${label}</div>
      <h2>Privacy Policy Update Detected</h2>
      <p>A change has been detected in the privacy policy for <strong>${alert.companySlug}</strong> that you're monitoring in your watchlist "<strong>${watchlistName}</strong>".</p>
      
      <div class="summary">${alert.summary}</div>
      
      <div class="details">
        <h3>What changed?</h3>
        ${this.formatAlertDetails(alert.details)}
      </div>
      
      <div style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/${alert.companySlug}" class="button">View Full Analysis</a>
      </div>
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        This alert was triggered because you're monitoring ${alert.companySlug} in your watchlist with ${watchlistName} set to notify you of ${alert.changeType} changes.
      </p>
    </div>
    <div class="footer">
      <p>
        You're receiving this email because you have email alerts enabled for your watchlist.<br>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications">Manage your notification preferences</a>
      </p>
      <p style="margin-top: 20px;">
        © ${new Date().getFullYear()} Inplain.AI. Privacy policies made simple.
      </p>
    </div>
  </div>
</body>
</html>`;

		const text = `
Inplain.AI Alert: ${label}

Privacy Policy Update Detected

A change has been detected in the privacy policy for ${alert.companySlug} that you're monitoring in your watchlist "${watchlistName}".

${alert.summary}

What changed?
${this.formatAlertDetailsText(alert.details)}

View Full Analysis: ${process.env.NEXT_PUBLIC_APP_URL}/${alert.companySlug}

This alert was triggered because you're monitoring ${alert.companySlug} in your watchlist with ${watchlistName} set to notify you of ${alert.changeType} changes.

---
You're receiving this email because you have email alerts enabled for your watchlist.
Manage your notification preferences: ${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications

© ${new Date().getFullYear()} Inplain.AI. Privacy policies made simple.
`;

		return {
			subject: `[Inplain.AI Alert] ${label} detected for ${alert.companySlug}`,
			html,
			text,
		};
	}

	static formatAlertDetails(details: any): string {
		if (!details) {
			return "<p>No additional details available.</p>";
		}

		let html = "<ul>";

		if (details.dataTypesAdded?.length > 0) {
			html += `<li><strong>New data types collected:</strong> ${details.dataTypesAdded.join(", ")}</li>`;
		}

		if (details.dataTypesRemoved?.length > 0) {
			html += `<li><strong>Data types no longer collected:</strong> ${details.dataTypesRemoved.join(", ")}</li>`;
		}

		if (details.rightsAdded?.length > 0) {
			html += `<li><strong>New user rights:</strong> ${details.rightsAdded.join(", ")}</li>`;
		}

		if (details.rightsRemoved?.length > 0) {
			html += `<li><strong>Rights removed:</strong> ${details.rightsRemoved.join(", ")}</li>`;
		}

		if (details.scoreChanges) {
			html += `<li><strong>Privacy score change:</strong> ${details.scoreChanges.previous} → ${details.scoreChanges.current}</li>`;
		}

		html += "</ul>";
		return html;
	}

	static formatAlertDetailsText(details: any): string {
		if (!details) {
			return "No additional details available.";
		}

		let text = "";

		if (details.dataTypesAdded?.length > 0) {
			text += `- New data types collected: ${details.dataTypesAdded.join(", ")}\n`;
		}

		if (details.dataTypesRemoved?.length > 0) {
			text += `- Data types no longer collected: ${details.dataTypesRemoved.join(", ")}\n`;
		}

		if (details.rightsAdded?.length > 0) {
			text += `- New user rights: ${details.rightsAdded.join(", ")}\n`;
		}

		if (details.rightsRemoved?.length > 0) {
			text += `- Rights removed: ${details.rightsRemoved.join(", ")}\n`;
		}

		if (details.scoreChanges) {
			text += `- Privacy score change: ${details.scoreChanges.previous} → ${details.scoreChanges.current}\n`;
		}

		return text || "No additional details available.";
	}

	static async sendWatchlistAlert(alertId: string): Promise<boolean> {
		try {
			const alert = (await kv.hgetall(
				`alert:${alertId}`
			)) as WatchlistAlert | null;
			if (!alert || alert.emailSent) {
				return false;
			}

			const user = await AuthService.getUserById(alert.userId);
			if (!user || !user.emailAlerts) {
				return false;
			}

			const watchlist = await WatchlistService.getWatchlist(
				alert.watchlistId
			);
			if (!watchlist) {
				return false;
			}

			const email = this.generateWatchlistAlertEmail(
				user,
				alert,
				watchlist.name
			);

			if (!resend) {
				console.warn("Resend not configured - skipping email");
				return false;
			}

			const { data, error } = await resend.emails.send({
				from: "Inplain.AI Alerts <alerts@inplain.ai>",
				to: user.email,
				subject: email.subject,
				html: email.html,
				text: email.text,
				tags: [
					{ name: "alert_type", value: "watchlist" },
					{ name: "change_type", value: alert.changeType },
					{ name: "company", value: alert.companySlug },
				],
			});

			if (!error) {
				alert.emailSent = true;
				await kv.hset(
					`alert:${alertId}`,
					alert as unknown as { [field: string]: unknown }
				);
				return true;
			}

			console.error("Email send error:", error);
			return false;
		} catch (error) {
			console.error("Email service error:", error);
			return false;
		}
	}

	static async sendVerificationEmail(
		user: User,
		token: string
	): Promise<boolean> {
		if (!resend) {
			console.warn("Resend not configured - skipping email");
			return false;
		}

		const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;

		const { data, error } = await resend.emails.send({
			from: "Inplain.AI <noreply@inplain.ai>",
			to: user.email,
			subject: "Verify your Inplain.AI account",
			html: `
        <h1>Welcome to Inplain.AI!</h1>
        <p>Hi ${user.name},</p>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a>
        <p>Or copy and paste this URL into your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>Best regards,<br>The Inplain.AI Team</p>
      `,
			text: `
Welcome to Inplain.AI!

Hi ${user.name},

Please verify your email address by visiting:
${verificationUrl}

This link will expire in 24 hours.

Best regards,
The Inplain.AI Team
      `,
		});

		return !error;
	}

	static async sendPasswordResetEmail(
		user: User,
		token: string
	): Promise<boolean> {
		if (!resend) {
			console.warn("Resend not configured - skipping email");
			return false;
		}

		const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

		const { data, error } = await resend.emails.send({
			from: "Inplain.AI <noreply@inplain.ai>",
			to: user.email,
			subject: "Reset your Inplain.AI password",
			html: `
        <h1>Password Reset Request</h1>
        <p>Hi ${user.name},</p>
        <p>We received a request to reset your password. Click the link below to create a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a>
        <p>Or copy and paste this URL into your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>The Inplain.AI Team</p>
      `,
			text: `
Password Reset Request

Hi ${user.name},

We received a request to reset your password. Visit the link below to create a new password:
${resetUrl}

This link will expire in 1 hour. If you didn't request this, please ignore this email.

Best regards,
The Inplain.AI Team
      `,
		});

		return !error;
	}

	static async sendWeeklyDigest(userId: string): Promise<boolean> {
		if (!resend) {
			console.warn("Resend not configured - skipping email");
			return false;
		}

		const user = await AuthService.getUserById(userId);
		if (!user || !user.emailAlerts || user.alertFrequency !== "weekly") {
			return false;
		}

		const alerts = await WatchlistService.getUserAlerts(userId, 50);
		const unreadAlerts = alerts.filter((a) => !a.read);

		if (unreadAlerts.length === 0) {
			return true; // No alerts to send
		}

		const { data, error } = await resend.emails.send({
			from: "Inplain.AI <digest@inplain.ai>",
			to: user.email,
			subject: `Your Inplain.AI Weekly Digest - ${unreadAlerts.length} updates`,
			html: this.generateDigestEmail(user, unreadAlerts),
			text: this.generateDigestEmailText(user, unreadAlerts),
		});

		return !error;
	}

	static generateDigestEmail(user: User, alerts: WatchlistAlert[]): string {
		const criticalCount = alerts.filter(
			(a) => a.changeType === "critical"
		).length;
		const significantCount = alerts.filter(
			(a) => a.changeType === "significant"
		).length;
		const minorCount = alerts.filter(
			(a) => a.changeType === "minor"
		).length;

		return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .alert-item { border-bottom: 1px solid #e5e7eb; padding: 15px 0; }
    .alert-item:last-child { border-bottom: none; }
    .critical { color: #ef4444; }
    .significant { color: #f59e0b; }
    .minor { color: #3b82f6; }
  </style>
</head>
<body>
  <h1>Your Inplain.AI Weekly Digest</h1>
  <p>Hi ${user.name},</p>
  <p>Here's a summary of privacy policy changes detected this week:</p>
  
  <div class="summary-card">
    <h3>Summary</h3>
    <p>
      ${criticalCount > 0 ? `<span class="critical">${criticalCount} critical</span>, ` : ""}
      ${significantCount > 0 ? `<span class="significant">${significantCount} significant</span>, ` : ""}
      ${minorCount > 0 ? `<span class="minor">${minorCount} minor</span>` : ""}
      changes detected
    </p>
  </div>
  
  <h3>Recent Updates</h3>
  ${alerts
		.slice(0, 10)
		.map(
			(alert) => `
    <div class="alert-item">
      <strong>${alert.companySlug}</strong> - <span class="${alert.changeType}">${alert.changeType}</span>
      <p>${alert.summary}</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/${alert.companySlug}">View Details →</a>
    </div>
  `
		)
		.join("")}
  
  <p style="margin-top: 30px;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">View All Updates</a>
  </p>
</body>
</html>`;
	}

	static generateDigestEmailText(
		user: User,
		alerts: WatchlistAlert[]
	): string {
		return `Your Inplain.AI Weekly Digest

Hi ${user.name},

Here's a summary of privacy policy changes detected this week:

${alerts
	.slice(0, 10)
	.map(
		(alert) =>
			`${alert.companySlug} - ${alert.changeType.toUpperCase()}\n${alert.summary}\nView: ${process.env.NEXT_PUBLIC_APP_URL}/${alert.companySlug}\n`
	)
	.join("\n")}

View all updates: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;
	}

	static async sendFeedbackNotification(
		feedback: Feedback
	): Promise<boolean> {
		if (!resend) {
			console.warn("Resend not configured - skipping email");
			return false;
		}

		const feedbackTypeLabels = {
			bug: "Bug Report",
			feature: "Feature Request",
			general: "General Feedback",
			rating: "Rating",
		};

		const priorityColors = {
			low: "#6b7280",
			medium: "#3b82f6",
			high: "#f59e0b",
			urgent: "#ef4444",
		};

		const { data, error } = await resend.emails.send({
			from: "Inplain.AI Feedback <feedback@inplain.ai>",
			to: process.env.ADMIN_EMAIL || "admin@inplain.ai",
			subject: `[${feedback.priority?.toUpperCase() || "NEW"}] ${feedbackTypeLabels[feedback.type]}: ${feedback.title}`,
			html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #1a1a1a; color: white; padding: 20px; }
    .content { padding: 30px; }
    .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; color: white; background: ${priorityColors[feedback.priority || "medium"]}; }
    .metadata { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .metadata p { margin: 5px 0; font-size: 14px; }
    .description { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>New Feedback Received</h2>
    </div>
    <div class="content">
      <h3>${feedback.title}</h3>
      <p>
        <span class="priority-badge">${feedback.priority || "medium"}</span>
        <strong>Type:</strong> ${feedbackTypeLabels[feedback.type]}
        ${feedback.sentiment ? `<strong>Sentiment:</strong> ${feedback.sentiment}` : ""}
      </p>
      
      <div class="metadata">
        <p><strong>From:</strong> ${feedback.context.email || "Anonymous"}</p>
        <p><strong>User ID:</strong> ${feedback.context.userId || "Not logged in"}</p>
        <p><strong>Page:</strong> ${feedback.context.url}</p>
        <p><strong>Time:</strong> ${new Date(feedback.createdAt).toLocaleString()}</p>
        ${feedback.rating ? `<p><strong>Rating:</strong> ${feedback.rating}/5</p>` : ""}
      </div>
      
      <div class="description">
        <h4>Description</h4>
        <p>${feedback.description}</p>
      </div>
      
      ${
			feedback.tags && feedback.tags.length > 0
				? `
      <p><strong>Tags:</strong> ${feedback.tags.join(", ")}</p>
      `
				: ""
		}
      
      <p style="margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/feedback" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">View in Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>`,
			text: `
New Feedback Received

Type: ${feedbackTypeLabels[feedback.type]}
Priority: ${feedback.priority || "medium"}
Title: ${feedback.title}

From: ${feedback.context.email || "Anonymous"}
User ID: ${feedback.context.userId || "Not logged in"}
Page: ${feedback.context.url}
Time: ${new Date(feedback.createdAt).toLocaleString()}
${feedback.rating ? `Rating: ${feedback.rating}/5` : ""}

Description:
${feedback.description}

${feedback.tags && feedback.tags.length > 0 ? `Tags: ${feedback.tags.join(", ")}` : ""}

View in Dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/feedback
      `,
			tags: [
				{ name: "feedback_type", value: feedback.type },
				{ name: "priority", value: feedback.priority || "medium" },
			],
		});

		return !error;
	}

	static async sendFeedbackFollowUp(feedback: Feedback): Promise<boolean> {
		if (!resend || !feedback.followUpEmail) {
			console.warn("Cannot send follow-up: no email configured");
			return false;
		}

		const { data, error } = await resend.emails.send({
			from: "Inplain.AI <noreply@inplain.ai>",
			to: feedback.followUpEmail,
			subject: `Re: Your feedback - ${feedback.title}`,
			html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; }
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 16px; font-size: 14px; font-weight: 600; background: #10b981; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Thank you for your feedback!</h2>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p>We wanted to let you know that we've reviewed your feedback and taken action.</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">${feedback.title}</h3>
        <p><span class="status-badge">Resolved</span></p>
        <p style="font-style: italic; color: #666;">"${feedback.description}"</p>
      </div>
      
      <p>Your feedback helps us improve Inplain.AI for everyone. We truly appreciate you taking the time to share your thoughts with us.</p>
      
      <p>If you have any other suggestions or concerns, please don't hesitate to reach out again.</p>
      
      <p>Best regards,<br>The Inplain.AI Team</p>
    </div>
  </div>
</body>
</html>`,
			text: `
Thank you for your feedback!

Hi there,

We wanted to let you know that we've reviewed your feedback and taken action.

Your feedback: "${feedback.title}"
Status: Resolved

"${feedback.description}"

Your feedback helps us improve Inplain.AI for everyone. We truly appreciate you taking the time to share your thoughts with us.

If you have any other suggestions or concerns, please don't hesitate to reach out again.

Best regards,
The Inplain.AI Team
      `,
		});

		return !error;
	}

	// Missing methods to fix build errors

	static async getEmailStats(days: number = 30): Promise<any> {
		try {
			const stats = (await kv.get("email:stats")) || {
				totalSent: 0,
				totalDelivered: 0,
				totalBounced: 0,
				totalComplaints: 0,
			};
			return stats;
		} catch (error) {
			console.error("Failed to get email stats:", error);
			return null;
		}
	}

	static async getQueueStats(): Promise<any> {
		try {
			const queueLength = (await kv.llen("email:queue")) || 0;
			const failedLength = (await kv.llen("email:failed")) || 0;
			return {
				pending: queueLength,
				failed: failedLength,
				processed: 0, // Could be tracked separately
			};
		} catch (error) {
			console.error("Failed to get queue stats:", error);
			return { pending: 0, failed: 0, processed: 0 };
		}
	}

	static async sendWelcomeEmail(userId: string): Promise<boolean> {
		try {
			const user = await AuthService.getUserById(userId);
			if (!user || !user.email) {
				return false;
			}

			const template = this.generateWelcomeEmail(user);
			return await this.sendEmail(
				user.email,
				template.subject,
				template.html,
				template.text
			);
		} catch (error) {
			console.error("Failed to send welcome email:", error);
			return false;
		}
	}

	static async processNotificationQueue(limit: number = 10): Promise<number> {
		try {
			let processed = 0;
			// Process up to specified limit from the queue
			for (let i = 0; i < limit; i++) {
				const item = await kv.lpop("email:queue");
				if (!item) {
					break;
				}

				try {
					const notification = JSON.parse(item as string);
					await this.sendEmail(
						notification.to,
						notification.subject,
						notification.html,
						notification.text
					);
					processed++;
				} catch (error) {
					console.error("Failed to process notification:", error);
					// Move to failed queue
					await kv.lpush("email:failed", item);
				}
			}
			return processed;
		} catch (error) {
			console.error("Failed to process notification queue:", error);
			return 0;
		}
	}

	static async getEmailPreferences(
		userId: string
	): Promise<EmailPreferences> {
		try {
			const prefs = (await kv.get(
				`user:email:${userId}`
			)) as EmailPreferences | null;
			return (
				prefs || {
					policyChanges: true,
					weeklyDigest: true,
					monthlyDigest: true,
					urgentAlerts: true,
					marketingEmails: false,
					unsubscribed: false,
					frequency: "immediate",
					timezone: "UTC",
					language: "en",
					categories: [],
				}
			);
		} catch (error) {
			console.error("Failed to get email preferences:", error);
			return {
				policyChanges: true,
				weeklyDigest: true,
				monthlyDigest: true,
				urgentAlerts: true,
				marketingEmails: false,
				unsubscribed: false,
				frequency: "immediate",
				timezone: "UTC",
				language: "en",
				categories: [],
			};
		}
	}

	static async updateEmailPreferences(
		userId: string,
		preferences: Partial<EmailPreferences>
	): Promise<void> {
		try {
			const current = await this.getEmailPreferences(userId);
			const updated = { ...current, ...preferences };
			await kv.set(`user:email:${userId}`, updated);
		} catch (error) {
			console.error("Failed to update email preferences:", error);
			throw error;
		}
	}

	static async sendMonthlyDigest(userId: string): Promise<boolean> {
		try {
			const user = await AuthService.getUserById(userId);
			if (!user || !user.email) {
				return false;
			}

			// Get user's watchlist alerts for the month
			const alerts = await WatchlistService.getUserAlerts(userId, 30);
			if (alerts.length === 0) {
				return true; // No alerts, no email needed
			}

			const template = this.generateMonthlyDigestEmail(user, alerts);
			return await this.sendEmail(
				user.email,
				template.subject,
				template.html,
				template.text
			);
		} catch (error) {
			console.error("Failed to send monthly digest:", error);
			return false;
		}
	}

	static async handleUnsubscribe(
		token: string,
		type?: string
	): Promise<boolean> {
		try {
			const data = await kv.get(`unsubscribe:${token}`);
			if (!data) {
				return false;
			}

			const { userId } = JSON.parse(data as string);
			const preferences = await this.getEmailPreferences(userId);

			if (type === "all") {
				// Unsubscribe from all emails
				await this.updateEmailPreferences(userId, {
					policyChanges: false,
					weeklyDigest: false,
					urgentAlerts: false,
					marketingEmails: false,
				});
			} else if (type) {
				// Unsubscribe from specific type
				await this.updateEmailPreferences(userId, {
					[type]: false,
				});
			}

			// Clean up token
			await kv.del(`unsubscribe:${token}`);
			return true;
		} catch (error) {
			console.error("Failed to handle unsubscribe:", error);
			return false;
		}
	}

	static async validateUnsubscribeToken(token: string): Promise<boolean> {
		try {
			const data = await kv.get(`unsubscribe:${token}`);
			return !!data;
		} catch (error) {
			console.error("Failed to validate unsubscribe token:", error);
			return false;
		}
	}

	private static generateWelcomeEmail(user: User): EmailTemplate {
		const subject = "Welcome to Inplain.ai!";
		const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h1 style="color: #1f2937;">Welcome to Inplain.ai!</h1>
        <p>Hi ${user.name || "there"},</p>
        <p>Welcome to Inplain.ai! We're excited to help you stay informed about privacy policy changes.</p>
        <p>Get started by:</p>
        <ul>
          <li>Adding companies to your watchlist</li>
          <li>Setting up notification preferences</li>
          <li>Exploring our AI-powered analysis tools</li>
        </ul>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The Inplain.ai Team</p>
      </div>
    `;
		const text = `Welcome to Inplain.ai! Hi ${user.name || "there"}, Welcome to Inplain.ai! We're excited to help you stay informed about privacy policy changes.`;

		return { subject, html, text };
	}

	private static generateMonthlyDigestEmail(
		user: User,
		alerts: WatchlistAlert[]
	): EmailTemplate {
		const subject = "Your Monthly Privacy Policy Digest";
		const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h1 style="color: #1f2937;">Monthly Privacy Policy Digest</h1>
        <p>Hi ${user.name || "there"},</p>
        <p>Here's your monthly summary of privacy policy changes:</p>
        <div>
          ${alerts
				.map(
					(alert) => `
            <div style="border: 1px solid #e5e7eb; padding: 16px; margin: 8px 0; border-radius: 8px;">
              <h3>${alert.companySlug}</h3>
              <p>${alert.summary}</p>
              <small>Changed on ${new Date(alert.createdAt).toLocaleDateString()}</small>
            </div>
          `
				)
				.join("")}
        </div>
        <p>View more details in your <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard">Inplain.ai dashboard</a>.</p>
      </div>
    `;
		const text = `Monthly Privacy Policy Digest. Hi ${user.name || "there"}, Here's your monthly summary of privacy policy changes...`;

		return { subject, html, text };
	}

	// Add missing sendEmail method
	static async sendEmail(
		to: string,
		subject: string,
		html: string,
		text: string
	): Promise<boolean> {
		if (!resend) {
			console.warn("Resend not configured - skipping email");
			return false;
		}

		try {
			const { data, error } = await resend.emails.send({
				from: "Inplain.AI <noreply@inplain.ai>",
				to,
				subject,
				html,
				text,
			});

			return !error;
		} catch (error) {
			console.error("Failed to send email:", error);
			return false;
		}
	}
}

// AuthService interface to fix missing import
interface AuthServiceInterface {
	getUserById(userId: string): Promise<User | null>;
}

// Mock AuthService for now - should be replaced with actual implementation
const AuthService: AuthServiceInterface = {
	async getUserById(userId: string): Promise<User | null> {
		// This should be replaced with actual user lookup logic
		const user = (await kv.get(`user:${userId}`)) as User | null;
		return user;
	},
};

// Export the AuthService mock for other files to use
export { AuthService };
