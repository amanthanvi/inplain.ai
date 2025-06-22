import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { EmailService } from '@/lib/email';
import { WebhookService } from '@/lib/webhook';
import { WatchlistService } from '@/lib/watchlist';
import { AuthService } from '@/lib/auth';

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      emailsSent: 0,
      webhooksSent: 0,
      digestsSent: 0,
      errors: [] as Array<{ type: string; alertId?: string; userId?: string; error: string }>
    };

    // Process email queue
    let emailItem = await kv.lpop<any>('email:queue');
    while (emailItem && results.emailsSent < 100) { // Limit to 100 per run
      try {
        if (emailItem.type === 'watchlist_alert') {
          const success = await EmailService.sendWatchlistAlert(emailItem.alertId);
          if (success) results.emailsSent++;
        }
      } catch (error) {
        results.errors.push({
          type: 'email',
          alertId: emailItem.alertId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      emailItem = await kv.lpop<any>('email:queue');
    }

    // Process webhook queue
    let webhookItem = await kv.lpop<any>('webhook:queue');
    while (webhookItem && results.webhooksSent < 50) { // Limit to 50 per run
      try {
        const success = await WebhookService.sendWatchlistAlertWebhook(webhookItem.alertId);
        if (success) results.webhooksSent++;
      } catch (error) {
        results.errors.push({
          type: 'webhook',
          alertId: webhookItem.alertId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      webhookItem = await kv.lpop<any>('webhook:queue');
    }

    // Process weekly digests (only on Mondays)
    const now = new Date();
    if (now.getDay() === 1) { // Monday
      const userIds = await kv.smembers('users:weekly_digest');
      for (const userId of userIds.slice(0, 20)) { // Limit to 20 per run
        try {
          const success = await EmailService.sendWeeklyDigest(userId);
          if (success) results.digestsSent++;
        } catch (error) {
          results.errors.push({
            type: 'digest',
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Process alerts cron error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process alerts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}