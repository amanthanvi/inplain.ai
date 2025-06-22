import { NextRequest, NextResponse } from 'next/server';
import { RiskScorer } from '@/lib/analytics/risk-scorer';
import { OptimizedStorageClient } from '@/app/api/lib/storage-optimized';

const storageClient = new OptimizedStorageClient();
import { validateAnalyticsAccess } from '../auth-helper';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const { user, error } = await validateAnalyticsAccess(token || null);
    
    if (!user) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    const { slug, fromSnapshotId, toSnapshotId } = await request.json();

    if (!slug || !fromSnapshotId || !toSnapshotId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get the diff data
    const diffId = `diff:${slug}:${fromSnapshotId}:${toSnapshotId}`;
    const diffMeta = await storageClient.getDiff(diffId);
    
    if (!diffMeta || !diffMeta.diffBlobKey) {
      return NextResponse.json({ error: 'Diff not found' }, { status: 404 });
    }

    // Get the diff content
    const diffContent = await storageClient.getDiffContent(diffMeta.diffBlobKey);
    if (!diffContent) {
      return NextResponse.json({ error: 'Diff content not found' }, { status: 404 });
    }

    // Calculate risk score
    const riskScore = await RiskScorer.scoreChanges(diffContent);
    
    // Generate risk report
    const report = RiskScorer.generateRiskReport(riskScore);

    return NextResponse.json({
      riskScore,
      report,
      calculatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Risk score error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate risk score' },
      { status: 500 }
    );
  }
}