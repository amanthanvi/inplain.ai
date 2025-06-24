import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-clerk';
import { WatchlistService } from '@/lib/watchlist';

export async function GET(request: NextRequest) {
  return withAuth(async (userId) => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');
      const unreadOnly = searchParams.get('unread') === 'true';

      const alerts = await WatchlistService.getUserAlerts(userId, limit, offset);
      const filteredAlerts = unreadOnly ? alerts.filter(a => !a.read) : alerts;
      const unreadCount = await WatchlistService.getUnreadAlertCount(userId);

      return NextResponse.json({
        alerts: filteredAlerts,
        unreadCount,
        total: alerts.length,
        limit,
        offset
      });
    } catch (error) {
      console.error('Get alerts error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch alerts' },
        { status: 500 }
      );
    }
  });
}