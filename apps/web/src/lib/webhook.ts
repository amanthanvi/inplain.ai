import { kv } from '@vercel/kv';
import { AuthService, User } from './auth';
import { WatchlistService, WatchlistAlert, Watchlist } from './watchlist';

export interface WebhookEvent {
  id: string;
  type: 'watchlist.alert' | 'policy.change' | 'analysis.complete';
  userId: string;
  data: any;
  createdAt: Date;
}

export interface WebhookDelivery {
  id: string;
  webhookUrl: string;
  event: WebhookEvent;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  lastAttempt?: Date;
  response?: {
    status: number;
    body: string;
  };
  createdAt: Date;
}

export class WebhookService {
  static async createEvent(
    type: WebhookEvent['type'],
    userId: string,
    data: any
  ): Promise<WebhookEvent> {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const event: WebhookEvent = {
      id: eventId,
      type,
      userId,
      data,
      createdAt: new Date()
    };

    await kv.hset(`webhook:event:${eventId}`, event as unknown as { [field: string]: unknown });
    return event;
  }

  static async sendWebhook(
    webhookUrl: string,
    event: WebhookEvent,
    secret: string
  ): Promise<WebhookDelivery> {
    const deliveryId = `del_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const delivery: WebhookDelivery = {
      id: deliveryId,
      webhookUrl,
      event,
      status: 'pending',
      attempts: 0,
      createdAt: new Date()
    };

    await kv.hset(`webhook:delivery:${deliveryId}`, delivery as unknown as { [field: string]: unknown });

    // Attempt delivery
    for (let attempt = 1; attempt <= 3; attempt++) {
      delivery.attempts = attempt;
      delivery.lastAttempt = new Date();

      try {
        const payload = JSON.stringify({
          id: event.id,
          type: event.type,
          created: event.createdAt.toISOString(),
          data: event.data
        });

        // Generate signature using Web Crypto API
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        
        const signatureBuffer = await crypto.subtle.sign(
          'HMAC',
          key,
          encoder.encode(payload)
        );
        
        const signatureArray = new Uint8Array(signatureBuffer);
        const signature = Array.from(signatureArray)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Inplain-AI-Signature': `sha256=${signature}`,
            'X-Inplain-AI-Event': event.type,
            'X-Inplain-AI-Delivery': deliveryId
          },
          body: payload,
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        const responseBody = await response.text();

        delivery.response = {
          status: response.status,
          body: responseBody.substring(0, 1000) // Store first 1000 chars
        };

        if (response.ok) {
          delivery.status = 'success';
          await kv.hset(`webhook:delivery:${deliveryId}`, delivery as unknown as { [field: string]: unknown });
          return delivery;
        }

        // Retry on 5xx errors
        if (response.status >= 500 && attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }

        delivery.status = 'failed';
        await kv.hset(`webhook:delivery:${deliveryId}`, delivery as unknown as { [field: string]: unknown });
        return delivery;

      } catch (error) {
        delivery.response = {
          status: 0,
          body: error instanceof Error ? error.message : 'Unknown error'
        };

        if (attempt === 3) {
          delivery.status = 'failed';
          await kv.hset(`webhook:delivery:${deliveryId}`, delivery as unknown as { [field: string]: unknown });
          return delivery;
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }

    delivery.status = 'failed';
    await kv.hset(`webhook:delivery:${deliveryId}`, delivery as unknown as { [field: string]: unknown });
    return delivery;
  }

  static async sendWatchlistAlertWebhook(alertId: string): Promise<boolean> {
    try {
      const alert = await kv.hgetall(`alert:${alertId}`) as WatchlistAlert | null;
      if (!alert || alert.webhookSent) return false;

      const user = await AuthService.getUserById(alert.userId);
      if (!user || !user.webhookUrl) return false;

      const watchlist = await WatchlistService.getWatchlist(alert.watchlistId);
      if (!watchlist || !watchlist.webhookEnabled) return false;

      // Get additional context
      const site = watchlist.sites.find(s => s.companySlug === alert.companySlug);

      const event = await this.createEvent('watchlist.alert', user.id, {
        alert: {
          id: alert.id,
          changeType: alert.changeType,
          summary: alert.summary,
          details: alert.details,
          companySlug: alert.companySlug,
          companyName: site?.companyName || alert.companySlug,
          createdAt: alert.createdAt
        },
        watchlist: {
          id: watchlist.id,
          name: watchlist.name,
          alertThreshold: watchlist.alertThreshold
        }
      });

      const webhookSecret = await this.getWebhookSecret(user.id);
      const delivery = await this.sendWebhook(user.webhookUrl, event, webhookSecret);

      if (delivery.status === 'success') {
        alert.webhookSent = true;
        await kv.hset(`alert:${alertId}`, alert as unknown as { [field: string]: unknown });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Webhook service error:', error);
      return false;
    }
  }

  static async sendPolicyChangeWebhook(
    companySlug: string,
    changeData: any
  ): Promise<void> {
    // Get all users with webhooks enabled
    const users = await this.getUsersWithWebhooks();

    for (const user of users) {
      const event = await this.createEvent('policy.change', user.id, {
        company: companySlug,
        change: changeData
      });

      const webhookSecret = await this.getWebhookSecret(user.id);
      await this.sendWebhook(user.webhookUrl!, event, webhookSecret);
    }
  }

  static async sendAnalysisCompleteWebhook(
    userId: string,
    companySlug: string,
    analysis: any
  ): Promise<void> {
    const user = await AuthService.getUserById(userId);
    if (!user || !user.webhookUrl) return;

    const event = await this.createEvent('analysis.complete', userId, {
      company: companySlug,
      analysis: {
        scores: analysis.comprehensiveScores,
        summary: analysis.executiveSummary,
        timestamp: new Date().toISOString()
      }
    });

    const webhookSecret = await this.getWebhookSecret(userId);
    await this.sendWebhook(user.webhookUrl, event, webhookSecret);
  }

  static async getWebhookSecret(userId: string): Promise<string> {
    let secret = await kv.get<string>(`webhook:secret:${userId}`);
    
    if (!secret) {
      const secretArray = crypto.getRandomValues(new Uint8Array(32));
      secret = Array.from(secretArray).map(b => b.toString(16).padStart(2, '0')).join('');
      await kv.set(`webhook:secret:${userId}`, secret);
    }

    return secret;
  }

  static async regenerateWebhookSecret(userId: string): Promise<string> {
    const secretArray = crypto.getRandomValues(new Uint8Array(32));
    const secret = Array.from(secretArray).map(b => b.toString(16).padStart(2, '0')).join('');
    await kv.set(`webhook:secret:${userId}`, secret);
    return secret;
  }

  static async getUsersWithWebhooks(): Promise<User[]> {
    // This would need to be optimized with proper indexing in production
    // For now, we'll scan through users (not scalable)
    const userIds = await kv.smembers('users:webhook_enabled');
    const users = await Promise.all(
      userIds.map(id => AuthService.getUserById(id))
    );
    return users.filter(u => u !== null && u.webhookUrl) as User[];
  }

  static async getWebhookDeliveries(
    userId: string,
    limit: number = 50
  ): Promise<WebhookDelivery[]> {
    // In production, this would need proper indexing
    const deliveryKeys = await kv.keys(`webhook:delivery:*`);
    const deliveries: WebhookDelivery[] = [];

    for (const key of deliveryKeys.slice(0, limit)) {
      const delivery = await kv.hgetall(key) as WebhookDelivery | null;
      if (delivery && delivery.event.userId === userId) {
        deliveries.push(delivery);
      }
    }

    return deliveries.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  static validateWebhookUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Only allow HTTPS in production
      if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
        return false;
      }
      // Don't allow localhost in production
      if (process.env.NODE_ENV === 'production' && 
          (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  static async testWebhook(userId: string): Promise<boolean> {
    const user = await AuthService.getUserById(userId);
    if (!user || !user.webhookUrl) return false;

    const event = await this.createEvent('policy.change', userId, {
      test: true,
      message: 'This is a test webhook from Inplain.AI',
      timestamp: new Date().toISOString()
    });

    const webhookSecret = await this.getWebhookSecret(userId);
    const delivery = await this.sendWebhook(user.webhookUrl, event, webhookSecret);

    return delivery.status === 'success';
  }
}