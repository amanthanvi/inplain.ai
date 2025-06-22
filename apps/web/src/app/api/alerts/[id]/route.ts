import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { WatchlistService } from '@/lib/watchlist';
import { kv } from '@vercel/kv';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: alertId } = await params;
    const body = await request.json();
    const { read } = body;

    if (typeof read !== 'boolean') {
      return NextResponse.json(
        { error: 'Read status must be a boolean' },
        { status: 400 }
      );
    }

    // Get alert to verify ownership
    const alert = await kv.hgetall<any>(`alert:${alertId}`);
    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    if (alert.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Update read status
    if (read) {
      await WatchlistService.markAlertAsRead(alertId);
    } else {
      // Mark as unread
      alert.read = false;
      await kv.hset(`alert:${alertId}`, alert);
    }

    return NextResponse.json({ 
      message: 'Alert updated',
      alert: { ...alert, read }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Update alert error:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}