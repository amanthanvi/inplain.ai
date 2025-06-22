import { NextRequest, NextResponse } from 'next/server';
import { OptimizedStorageClient } from '../lib/storage-optimized';
import { CacheService, CacheKeys } from '@/lib/cache';
import { PerformanceMonitor } from '@/lib/performance';
import { DatabaseOptimizer } from '@/lib/db-optimizer';

const storage = new OptimizedStorageClient();

export async function GET(request: NextRequest) {
  const end = PerformanceMonitor.startMeasure('api:feed:get');
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Get feed data with caching
    const feedData = await CacheService.wrap(
      CacheKeys.feedData(page),
      async () => {
        // Get all company slugs
        const slugs = await storage.getAllCompanySlugs();
        
        // Parallel fetch latest snapshots and diffs for each company
        const companiesData = await DatabaseOptimizer.parallelQueries(
          slugs.slice(offset, offset + limit).map(slug => async () => {
            const [snapshots, diffs] = await Promise.all([
              storage.getLatestSnapshots(slug, 1),
              storage.getLatestDiffs(slug, 1)
            ]);

            const latestSnapshot = snapshots[0];
            const latestDiff = diffs[0];

            if (!latestSnapshot) return null;

            return {
              slug,
              name: slug.charAt(0).toUpperCase() + slug.slice(1),
              lastUpdated: latestSnapshot.capturedAt,
              hasChanges: !!latestDiff,
              changeDate: latestDiff?.createdAt,
              changeType: latestDiff ? 'update' : null,
              snapshot: {
                id: latestSnapshot.id,
                capturedAt: latestSnapshot.capturedAt,
                url: latestSnapshot.url
              }
            };
          })
        );

        const validCompanies = companiesData.filter((c): c is NonNullable<typeof c> => c !== null);

        // Sort by most recent activity
        validCompanies.sort((a, b) => {
          const dateA = new Date(a.changeDate || a.lastUpdated).getTime();
          const dateB = new Date(b.changeDate || b.lastUpdated).getTime();
          return dateB - dateA;
        });

        return {
          companies: validCompanies,
          pagination: {
            page,
            limit,
            total: slugs.length,
            totalPages: Math.ceil(slugs.length / limit),
            hasMore: offset + limit < slugs.length
          }
        };
      },
      { 
        ttl: 300, // 5 minutes
        tags: ['feed'],
        revalidate: 60 // 1 minute stale-while-revalidate
      }
    );

    return NextResponse.json(feedData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Cache-Status': feedData ? 'HIT' : 'MISS'
      }
    });
  } catch (error) {
    console.error('Feed error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feed' },
      { status: 500 }
    );
  } finally {
    end();
  }
}