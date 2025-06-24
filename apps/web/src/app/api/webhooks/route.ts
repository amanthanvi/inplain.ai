import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getClerkUser } from '@/lib/auth-clerk';
import { clerkClient } from '@clerk/nextjs/server';
import { WebhookService } from '@/lib/webhook';
import { kv } from '@vercel/kv';

export async function GET(request: NextRequest) {
  return withAuth(async (userId) => {
    try {
      const user = await getClerkUser();
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      const metadata = user.publicMetadata as any || {};
      
      // Get webhook secret
      const webhookSecret = await WebhookService.getWebhookSecret(userId);
      
      // Get recent deliveries
      const deliveries = await WebhookService.getWebhookDeliveries(userId, 20);
      
      return NextResponse.json({
        webhookUrl: metadata.webhookUrl || null,
        webhookSecret: webhookSecret.substring(0, 8) + '...',
        enabled: !!metadata.webhookUrl,
        recentDeliveries: deliveries
      });
    } catch (error) {
      console.error('Get webhook config error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch webhook configuration' },
        { status: 500 }
      );
    }
  });
}

export async function PUT(request: NextRequest) {
  return withAuth(async (userId) => {
    try {
      const body = await request.json();
      const { webhookUrl } = body;
      
      const user = await getClerkUser();
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      const metadata = user.publicMetadata as any || {};

      // Premium feature check
      const tier = metadata.tier || 'free';
      if (tier === 'free') {
        return NextResponse.json(
          { error: 'Webhooks are only available for premium users' },
          { status: 403 }
        );
      }

      // Validate webhook URL if provided
      if (webhookUrl && !WebhookService.validateWebhookUrl(webhookUrl)) {
        return NextResponse.json(
          { error: 'Invalid webhook URL. HTTPS is required in production.' },
          { status: 400 }
        );
      }

      // Update user webhook configuration in Clerk metadata
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...metadata,
          webhookUrl
        }
      });

      // If webhookUrl is provided, add user to webhook-enabled index
      if (webhookUrl) {
        await kv.sadd('users:webhook_enabled', userId);
      } else {
        await kv.srem('users:webhook_enabled', userId);
      }

      return NextResponse.json({
        message: 'Webhook configuration updated',
        webhookUrl
      });
    } catch (error) {
      console.error('Update webhook config error:', error);
      return NextResponse.json(
        { error: 'Failed to update webhook configuration' },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async (userId) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');
      
      const user = await getClerkUser();
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      const metadata = user.publicMetadata as any || {};
      const tier = metadata.tier || 'free';

      if (tier === 'free') {
        return NextResponse.json(
          { error: 'Webhooks are only available for premium users' },
          { status: 403 }
        );
      }

      if (action === 'test') {
        // Send test webhook
        if (!metadata.webhookUrl) {
          return NextResponse.json(
            { error: 'No webhook URL configured' },
            { status: 400 }
          );
        }

        const success = await WebhookService.testWebhook(userId);
        
        return NextResponse.json({
          success,
          message: success ? 'Test webhook sent successfully' : 'Test webhook failed'
        });
      } else if (action === 'regenerate-secret') {
        // Regenerate webhook secret
        const newSecret = await WebhookService.regenerateWebhookSecret(userId);
        
        return NextResponse.json({
          message: 'Webhook secret regenerated',
          secretPreview: newSecret.substring(0, 8) + '...'
        });
      } else {
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Webhook action error:', error);
      return NextResponse.json(
        { error: 'Failed to perform webhook action' },
        { status: 500 }
      );
    }
  });
}