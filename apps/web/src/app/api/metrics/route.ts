import { NextRequest, NextResponse } from 'next/server';
import { PerformanceMonitor } from '@/lib/performance';
import { CacheService } from '@/lib/cache';
import { AuthService } from '@/lib/auth';

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
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow premium users or admins to view metrics
    if (user.tier === 'free') {
      return NextResponse.json(
        { error: 'Metrics access requires premium subscription' },
        { status: 403 }
      );
    }

    // Get performance stats
    const performanceStats = PerformanceMonitor.getAllStats();
    const cacheStats = await CacheService.getStats();

    // Get top slow operations
    const slowOperations = Object.entries(performanceStats)
      .filter(([_, stats]) => stats && stats.p95 > 1000)
      .sort((a, b) => (b[1]?.p95 || 0) - (a[1]?.p95 || 0))
      .slice(0, 10)
      .map(([label, stats]) => ({
        label,
        avgDuration: stats?.avgDuration || 0,
        p95: stats?.p95 || 0,
        count: stats?.count || 0
      }));

    // Get cache effectiveness
    const cacheEffectiveness = Object.entries(performanceStats)
      .filter(([_, stats]) => stats && stats.cacheHitRate > 0)
      .map(([label, stats]) => ({
        label,
        hitRate: stats?.cacheHitRate || 0,
        avgDuration: stats?.avgDuration || 0
      }));

    return NextResponse.json({
      performance: {
        stats: performanceStats,
        slowOperations,
        report: PerformanceMonitor.generateReport()
      },
      cache: {
        ...cacheStats,
        effectiveness: cacheEffectiveness
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'private, no-cache',
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}