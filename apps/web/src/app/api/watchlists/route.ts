import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { WatchlistService } from '@/lib/watchlist';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const watchlists = await WatchlistService.getUserWatchlists(user.id);
    
    return NextResponse.json({ watchlists });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Get watchlists error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watchlists' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Watchlist name is required' },
        { status: 400 }
      );
    }

    // Check watchlist limits based on tier
    const existingWatchlists = await WatchlistService.getUserWatchlists(user.id);
    const limits = {
      free: 2,
      premium: 10,
      enterprise: -1 // Unlimited
    };

    const userLimit = limits[user.tier];
    if (userLimit !== -1 && existingWatchlists.length >= userLimit) {
      return NextResponse.json(
        { error: `Watchlist limit reached. Upgrade to ${user.tier === 'free' ? 'premium' : 'enterprise'} for more watchlists.` },
        { status: 403 }
      );
    }

    const watchlist = await WatchlistService.createWatchlist(
      user.id,
      name,
      description
    );

    return NextResponse.json({ watchlist }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Create watchlist error:', error);
    return NextResponse.json(
      { error: 'Failed to create watchlist' },
      { status: 500 }
    );
  }
}