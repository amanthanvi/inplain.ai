import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-clerk';
import { WatchlistService } from '@/lib/watchlist';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  return withAuth(async (userId) => {
    try {
      const { id } = await params;
      
      const watchlist = await WatchlistService.getWatchlist(id);
      
      if (!watchlist) {
        return NextResponse.json(
          { error: 'Watchlist not found' },
          { status: 404 }
        );
      }

      // Check ownership
      if (watchlist.userId !== userId) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }

      return NextResponse.json({ watchlist });
    } catch (error) {
      console.error('Get watchlist error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch watchlist' },
        { status: 500 }
      );
    }
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  return withAuth(async (userId) => {
    try {
      const { id } = await params;
      const body = await request.json();
      
      const watchlist = await WatchlistService.getWatchlist(id);
      
      if (!watchlist) {
        return NextResponse.json(
          { error: 'Watchlist not found' },
          { status: 404 }
        );
      }

      // Check ownership
      if (watchlist.userId !== userId) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }

      const updatedWatchlist = await WatchlistService.updateWatchlist(id, body);

      return NextResponse.json({ watchlist: updatedWatchlist });
    } catch (error) {
      console.error('Update watchlist error:', error);
      return NextResponse.json(
        { error: 'Failed to update watchlist' },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(async (userId) => {
    try {
      const { id } = await params;
      
      const watchlist = await WatchlistService.getWatchlist(id);
      
      if (!watchlist) {
        return NextResponse.json(
          { error: 'Watchlist not found' },
          { status: 404 }
        );
      }

      // Check ownership
      if (watchlist.userId !== userId) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }

      await WatchlistService.deleteWatchlist(id);

      return NextResponse.json({ message: 'Watchlist deleted successfully' });
    } catch (error) {
      console.error('Delete watchlist error:', error);
      return NextResponse.json(
        { error: 'Failed to delete watchlist' },
        { status: 500 }
      );
    }
  });
}