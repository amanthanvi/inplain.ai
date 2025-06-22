import { NextRequest, NextResponse } from 'next/server';
import { CacheService, CacheTags } from '@/lib/cache';
import { AuthService } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication - only allow admins
    const sessionToken = request.cookies.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await AuthService.verifySession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await AuthService.getUserById(session.userId);
    if (!user || user.tier !== 'enterprise') {
      return NextResponse.json(
        { error: 'Cache management requires enterprise access' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');
    const tag = searchParams.get('tag');

    if (key) {
      // Clear specific cache key
      await CacheService.invalidate(key);
      return NextResponse.json({
        success: true,
        cleared: 'key',
        key
      });
    }

    if (tag) {
      // Clear all cache entries with tag
      await CacheService.invalidateTag(tag);
      return NextResponse.json({
        success: true,
        cleared: 'tag',
        tag
      });
    }

    // Clear specific tag groups
    const action = searchParams.get('action');
    switch (action) {
      case 'clear-company':
        const slug = searchParams.get('slug');
        if (slug) {
          await CacheService.invalidateTag(CacheTags.company(slug));
          return NextResponse.json({
            success: true,
            cleared: 'company',
            slug
          });
        }
        break;

      case 'clear-analysis':
        await CacheService.invalidateTag(CacheTags.analysis);
        return NextResponse.json({
          success: true,
          cleared: 'all-analysis'
        });
        break;

      case 'clear-api':
        await CacheService.invalidateTag(CacheTags.api);
        return NextResponse.json({
          success: true,
          cleared: 'api-responses'
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid cache clear action' },
          { status: 400 }
        );
    }

    return NextResponse.json(
      { error: 'No cache key or tag specified' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const sessionToken = request.cookies.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await AuthService.verifySession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await AuthService.getUserById(session.userId);
    if (!user || user.tier === 'free') {
      return NextResponse.json(
        { error: 'Cache stats require premium access' },
        { status: 403 }
      );
    }

    const stats = await CacheService.getStats();

    return NextResponse.json({
      cache: stats,
      tags: {
        company: 'Company-specific data',
        analysis: 'AI analysis results',
        snapshots: 'Policy snapshots',
        diffs: 'Policy diffs',
        api: 'API responses'
      }
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cache stats' },
      { status: 500 }
    );
  }
}