import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from '../../../lib/storage-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const storage = getStorage()
    if (!storage) {
      // Return mock data if storage is not configured
      const mockDiffs = [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          slug,
          fromSnapshotId: 'snap-1',
          toSnapshotId: 'snap-2',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          additions: 150,
          deletions: 75,
          changeCount: 225,
          changeType: 'major',
          diffBlobKey: 'diff-1',
          _mock: true
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          slug,
          fromSnapshotId: 'snap-2',
          toSnapshotId: 'snap-3',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
          additions: 45,
          deletions: 20,
          changeCount: 65,
          changeType: 'moderate',
          diffBlobKey: 'diff-2',
          _mock: true
        },
        {
          id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          slug,
          fromSnapshotId: 'snap-3',
          toSnapshotId: 'snap-4',
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
          additions: 10,
          deletions: 5,
          changeCount: 15,
          changeType: 'minor',
          diffBlobKey: 'diff-3',
          _mock: true
        }
      ].slice(0, limit)
      
      return NextResponse.json({
        diffs: mockDiffs,
        count: mockDiffs.length,
        _mock: true
      }, {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
          'X-Mock-Data': 'true'
        }
      })
    }
    
    // Get the latest diffs for this company
    const diffs = await storage.getLatestDiffs(slug, limit)
    
    return NextResponse.json({
      diffs,
      count: diffs.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Diff history fetch error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}