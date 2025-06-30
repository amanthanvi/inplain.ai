import { NextRequest, NextResponse } from 'next/server';
import { TrendAnalyzer, TrendData } from '@/lib/analytics/trend-analyzer';
import { OptimizedStorageClient } from '@/app/api/lib/storage-optimized';

const storageClient = new OptimizedStorageClient();
import { validateAnalyticsAccess } from '../auth-helper';
import { kv } from '@/app/api/lib/kv-wrapper';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const { user, error } = await validateAnalyticsAccess(token || null);
    
    if (!user) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const type = searchParams.get('type') || 'risk'; // risk, frequency, compliance
    const period = searchParams.get('period') as TrendData['period'] || 'monthly';

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
    }

    let trendData;

    switch (type) {
      case 'risk':
        // Get historical diffs
        const diffKeys = await kv.zrange(`diffs:${slug}`, 0, -1) as string[];
        if (!diffKeys || diffKeys.length === 0) {
          return NextResponse.json({ error: 'No historical data' }, { status: 404 });
        }

        const diffs = await Promise.all(
          diffKeys.map((diffId: string) => storageClient.getDiff(diffId))
        );
        
        trendData = await TrendAnalyzer.analyzeRiskTrends(
          diffs.filter(Boolean) as any[],
          period
        );
        break;

      case 'frequency':
        // Get historical snapshots
        const snapshotIds = await kv.zrange(`snapshots:${slug}`, 0, -1) as string[];
        if (!snapshotIds || snapshotIds.length === 0) {
          return NextResponse.json({ error: 'No snapshot history' }, { status: 404 });
        }

        const snapshots = await Promise.all(
          snapshotIds.map(id => storageClient.getSnapshot(slug, id))
        );
        
        trendData = await TrendAnalyzer.analyzeChangeFrequency(
          snapshots.filter(Boolean) as any[],
          period
        );
        break;

      case 'compliance':
        // Get compliance trends for multiple regulations
        const complianceDiffKeys = await kv.zrange(`diffs:${slug}`, 0, -1) as string[];
        if (!complianceDiffKeys || complianceDiffKeys.length === 0) {
          return NextResponse.json({ error: 'No historical data' }, { status: 404 });
        }

        const complianceDiffs = await Promise.all(
          complianceDiffKeys.map((diffId: string) => storageClient.getDiff(diffId))
        );
        
        const complianceTrends = await TrendAnalyzer.analyzeComplianceTrends(
          complianceDiffs.filter(Boolean) as any[]
        );
        
        return NextResponse.json({
          trends: complianceTrends,
          period,
          generatedAt: new Date().toISOString()
        });

      default:
        return NextResponse.json({ error: 'Invalid trend type' }, { status: 400 });
    }

    return NextResponse.json({
      ...trendData,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Trends analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze trends' },
      { status: 500 }
    );
  }
}