import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthService } from '@/lib/auth';
import { WebhookService } from '@/lib/webhook';
import { kv } from '@vercel/kv';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    // Get webhook secret
    const webhookSecret = await WebhookService.getWebhookSecret(user.id);
    
    // Get recent deliveries
    const deliveries = await WebhookService.getWebhookDeliveries(user.id, 20);
    
    return NextResponse.json({
      webhookUrl: user.webhookUrl,
      webhookSecret: webhookSecret.substring(0, 8) + '...',
      enabled: !!user.webhookUrl,
      recentDeliveries: deliveries
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Get webhook config error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { webhookUrl } = body;

    // Premium feature check
    if (user.tier === 'free') {
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

    // Update user webhook configuration
    await AuthService.updateUser(user.id, { webhookUrl });

    // If webhookUrl is provided, add user to webhook-enabled index
    if (webhookUrl) {
      await kv.sadd('users:webhook_enabled', user.id);
    } else {
      await kv.srem('users:webhook_enabled', user.id);
    }

    return NextResponse.json({
      message: 'Webhook configuration updated',
      webhookUrl
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Update webhook config error:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (user.tier === 'free') {
      return NextResponse.json(
        { error: 'Webhooks are only available for premium users' },
        { status: 403 }
      );
    }

    if (action === 'test') {
      // Send test webhook
      if (!user.webhookUrl) {
        return NextResponse.json(
          { error: 'No webhook URL configured' },
          { status: 400 }
        );
      }

      const success = await WebhookService.testWebhook(user.id);
      
      return NextResponse.json({
        success,
        message: success ? 'Test webhook sent successfully' : 'Test webhook failed'
      });
    } else if (action === 'regenerate-secret') {
      // Regenerate webhook secret
      const newSecret = await WebhookService.regenerateWebhookSecret(user.id);
      
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Webhook action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform webhook action' },
      { status: 500 }
    );
  }
}