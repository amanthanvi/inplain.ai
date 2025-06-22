import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { WatchlistService } from '@/lib/watchlist';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: watchlistId } = await params;
    const body = await request.json();
    const { companySlug, companyName, tags } = body;

    if (!companySlug || !companyName) {
      return NextResponse.json(
        { error: 'Company slug and name are required' },
        { status: 400 }
      );
    }

    const watchlist = await WatchlistService.getWatchlist(watchlistId);
    
    if (!watchlist) {
      return NextResponse.json(
        { error: 'Watchlist not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (watchlist.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check site limits based on tier
    const limits = {
      free: 10,
      premium: 100,
      enterprise: -1 // Unlimited
    };

    const userLimit = limits[user.tier];
    if (userLimit !== -1 && watchlist.sites.length >= userLimit) {
      return NextResponse.json(
        { error: `Site limit reached for this watchlist. Upgrade to ${user.tier === 'free' ? 'premium' : 'enterprise'} for more sites.` },
        { status: 403 }
      );
    }

    const success = await WatchlistService.addSiteToWatchlist(
      watchlistId,
      companySlug,
      companyName,
      tags || []
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Site already exists in watchlist' },
        { status: 409 }
      );
    }

    const updatedWatchlist = await WatchlistService.getWatchlist(watchlistId);

    return NextResponse.json({ watchlist: updatedWatchlist }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Add site to watchlist error:', error);
    return NextResponse.json(
      { error: 'Failed to add site to watchlist' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: watchlistId } = await params;
    const { searchParams } = new URL(request.url);
    const companySlug = searchParams.get('companySlug');

    if (!companySlug) {
      return NextResponse.json(
        { error: 'Company slug is required' },
        { status: 400 }
      );
    }

    const watchlist = await WatchlistService.getWatchlist(watchlistId);
    
    if (!watchlist) {
      return NextResponse.json(
        { error: 'Watchlist not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (watchlist.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const success = await WatchlistService.removeSiteFromWatchlist(
      watchlistId,
      companySlug
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Site not found in watchlist' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Site removed from watchlist' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Remove site from watchlist error:', error);
    return NextResponse.json(
      { error: 'Failed to remove site from watchlist' },
      { status: 500 }
    );
  }
}