import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getClerkUser } from '@/lib/auth-clerk';
import { WatchlistService } from '@/lib/watchlist';

export async function GET(request: NextRequest) {
  return withAuth(async (userId) => {
    try {
      const watchlists = await WatchlistService.getUserWatchlists(userId);
      
      return NextResponse.json({ watchlists });
    } catch (error) {
      console.error('Get watchlists error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch watchlists' },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async (userId) => {
    try {
      const body = await request.json();
      const { name, description } = body;

      if (!name) {
        return NextResponse.json(
          { error: 'Watchlist name is required' },
          { status: 400 }
        );
      }
      
      // Get user tier from Clerk metadata
      const user = await getClerkUser();
      const tier = (user?.publicMetadata as any)?.tier || 'free';

      // Check watchlist limits based on tier
      const existingWatchlists = await WatchlistService.getUserWatchlists(userId);
      const limits = {
        free: 2,
        premium: 10,
        enterprise: -1 // Unlimited
      };

      const userLimit = limits[tier as keyof typeof limits];
      if (userLimit !== -1 && existingWatchlists.length >= userLimit) {
        return NextResponse.json(
          { error: `Watchlist limit reached. Upgrade to ${tier === 'free' ? 'premium' : 'enterprise'} for more watchlists.` },
          { status: 403 }
        );
      }

      const watchlist = await WatchlistService.createWatchlist(
        userId,
        name,
        description
      );

      return NextResponse.json({ watchlist }, { status: 201 });
    } catch (error) {
      console.error('Create watchlist error:', error);
      return NextResponse.json(
        { error: 'Failed to create watchlist' },
        { status: 500 }
      );
    }
  });
}