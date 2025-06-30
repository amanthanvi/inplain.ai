import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getStorage } from '../../lib/storage-utils'
import { DiffEngine } from '../../lib/diff-engine'
import { SmartDiffEngine } from '@/lib/change-detection/smart-diff'
import { DiffMetaSchema } from '@inplain.ai/shared'
import { formatTimestamp } from '@inplain.ai/shared'

// Initialize diff engine
let diffEngine: DiffEngine | null = null

function getDiffEngine(): DiffEngine {
  if (!diffEngine) {
    diffEngine = new DiffEngine()
  }
  return diffEngine
}

const querySchema = z.object({
  from: z.string().uuid().optional().nullable(),
  to: z.string().uuid().optional().nullable()
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    
    const query = querySchema.parse({
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined
    })

    // Get storage client
    const storageClient = getStorage()
    
    // If storage is not configured, return mock data
    if (!storageClient) {
      const mockDiff = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // Valid UUID for mock diff
        slug,
        fromSnapshotId: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
        toSnapshotId: 'b47ac10b-58cc-4372-a567-0e02b2c3d479',
        createdAt: formatTimestamp(),
        changeCount: 5,
        changeType: 'moderate' as const,
        additions: 3,
        deletions: 2,
        diffBlobKey: `diffs/${slug}/mock.json`
      }
      
      return NextResponse.json({
        diff: mockDiff,
        htmlDiff: '<div class="diff"><p>This is a mock diff. In production with proper storage configuration, this would show actual privacy policy changes.</p><p class="added">+ Added: Enhanced user privacy controls</p><p class="removed">- Removed: Outdated data collection practices</p></div>',
        fromSnapshot: {
          id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
          capturedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        toSnapshot: {
          id: 'b47ac10b-58cc-4372-a567-0e02b2c3d479',
          capturedAt: new Date().toISOString()
        },
        _mock: true
      }, {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
          'X-Mock-Data': 'true'
        }
      })
    }

    const snapshots = await storageClient.getLatestSnapshots(slug, 2)
    
    if (snapshots.length < 2) {
      return NextResponse.json(
        { error: 'Not enough snapshots to generate diff' },
        { status: 404 }
      )
    }

    const [toSnapshot, fromSnapshot] = snapshots
    
    if (!fromSnapshot || !toSnapshot) {
      return NextResponse.json(
        { error: 'Invalid snapshots' },
        { status: 500 }
      )
    }
    
    const [oldContent, newContent] = await Promise.all([
      storageClient.getSnapshotContent(fromSnapshot.blobKey),
      storageClient.getSnapshotContent(toSnapshot.blobKey)
    ])

    if (!oldContent || !newContent) {
      return NextResponse.json(
        { error: 'Failed to fetch snapshot content' },
        { status: 500 }
      )
    }

    // Use smart diff engine for better change detection
    const smartDiff = new SmartDiffEngine()
    const smartDiffResult = smartDiff.detectChanges(oldContent, newContent)
    
    // If no significant changes, don't create a diff
    if (!smartDiffResult.hasSignificantChanges) {
      console.log(`No significant changes detected for ${slug}`, {
        ignoredChanges: smartDiffResult.ignoredChanges
      })
      
      // Return the last meaningful diff if available
      const existingDiffs = await storageClient.getLatestDiffs(slug, 1)
      if (existingDiffs.length > 0) {
        const lastDiff = existingDiffs[0]
        if (lastDiff) {
          const diffContent = await storageClient.getDiffContent(lastDiff.diffBlobKey)
          
          return NextResponse.json({
            diff: lastDiff,
            htmlDiff: diffContent?.htmlDiff || '',
            fromSnapshot: {
              id: lastDiff.fromSnapshotId,
              capturedAt: fromSnapshot.capturedAt
            },
            toSnapshot: {
              id: lastDiff.toSnapshotId,
              capturedAt: toSnapshot.capturedAt
            },
            noChanges: true,
            ignoredChanges: smartDiffResult.ignoredChanges
          }, {
            headers: {
              'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
              'Content-Type': 'application/json'
            }
          })
        }
      }
    }
    
    // Use traditional diff for display but smart diff results for metadata
    const displayDiffResult = getDiffEngine().computeDiff(oldContent, newContent)
    
    const diff = DiffMetaSchema.parse({
      id: crypto.randomUUID(),
      slug,
      fromSnapshotId: fromSnapshot.id,
      toSnapshotId: toSnapshot.id,
      createdAt: formatTimestamp(),
      changeCount: smartDiffResult.changeCount,
      changeType: smartDiffResult.changeType as any,
      additions: smartDiffResult.additions,
      deletions: smartDiffResult.deletions,
      diffBlobKey: `diffs/${slug}/${formatTimestamp()}.json`
    })

    await Promise.all([
      storageClient.saveDiff(diff),
      storageClient.saveDiffContent(diff.diffBlobKey, {
        ...displayDiffResult,
        htmlDiff: smartDiffResult.filteredDiff || displayDiffResult.htmlDiff,
        fromSnapshot: fromSnapshot.id,
        toSnapshot: toSnapshot.id,
        generatedAt: formatTimestamp(),
        ignoredChanges: smartDiffResult.ignoredChanges,
        hasSignificantChanges: smartDiffResult.hasSignificantChanges
      })
    ])

    return NextResponse.json({
      diff,
      htmlDiff: smartDiffResult.filteredDiff || displayDiffResult.htmlDiff,
      fromSnapshot: {
        id: fromSnapshot.id,
        capturedAt: fromSnapshot.capturedAt
      },
      toSnapshot: {
        id: toSnapshot.id,
        capturedAt: toSnapshot.capturedAt
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Diff generation error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}