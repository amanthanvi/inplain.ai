import { NextRequest, NextResponse } from 'next/server';
import { ComplianceTracker } from '@/lib/analytics/compliance-tracker';
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

    const { slug, snapshotId, regulations } = await request.json();

    if (!slug || !snapshotId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get the snapshot content
    const snapshot = await storageClient.getSnapshot(slug, snapshotId);
    if (!snapshot || !snapshot.blobKey) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    const content = await storageClient.getSnapshotContent(snapshot.blobKey);
    if (!content) {
      return NextResponse.json({ error: 'Snapshot content not found' }, { status: 404 });
    }

    // Assess compliance
    const report = await ComplianceTracker.assessCompliance(
      content,
      regulations || ['GDPR', 'CCPA']
    );

    // Generate compliance matrix
    const matrix = ComplianceTracker.generateComplianceMatrix(report);

    return NextResponse.json({
      report,
      matrix,
      assessedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Compliance assessment error:', error);
    return NextResponse.json(
      { error: 'Failed to assess compliance' },
      { status: 500 }
    );
  }
}