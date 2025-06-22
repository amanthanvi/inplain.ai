import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { WatchlistService } from '@/lib/watchlist';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unread') === 'true';

    const alerts = await WatchlistService.getUserAlerts(user.id, limit, offset);
    const filteredAlerts = unreadOnly ? alerts.filter(a => !a.read) : alerts;
    const unreadCount = await WatchlistService.getUnreadAlertCount(user.id);

    return NextResponse.json({
      alerts: filteredAlerts,
      unreadCount,
      total: alerts.length,
      limit,
      offset
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Get alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}