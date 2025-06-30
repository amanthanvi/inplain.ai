import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StorageClient } from '../../lib/storage'
import { DiffEngine } from '../../lib/diff-engine'
import { DiffMetaSchema } from '@inplain.ai/shared'
import { formatTimestamp } from '@inplain.ai/shared'
import { getEnvVar } from '@/lib/env'

// Initialize storage with error handling
let storage: StorageClient | null = null
let diffEngine: DiffEngine | null = null

function getStorage(): StorageClient | null {
  if (storage) return storage
  
  // Check if KV is configured
  const kvUrl = getEnvVar('KV_REST_API_URL')
  const kvToken = getEnvVar('KV_REST_API_TOKEN')
  
  if (!kvUrl || !kvToken) {
    console.warn('KV storage not configured - diff API will return mock data')
    return null
  }
  
  try {
    storage = new StorageClient()
    return storage
  } catch (error) {
    console.error('Failed to initialize storage client:', error)
    return null
  }
}

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

    const diffResult = getDiffEngine().computeDiff(oldContent, newContent)
    
    const diff = DiffMetaSchema.parse({
      id: crypto.randomUUID(),
      slug,
      fromSnapshotId: fromSnapshot.id,
      toSnapshotId: toSnapshot.id,
      createdAt: formatTimestamp(),
      changeCount: diffResult.changeCount,
      changeType: diffResult.changeType,
      additions: diffResult.additions,
      deletions: diffResult.deletions,
      diffBlobKey: `diffs/${slug}/${formatTimestamp()}.json`
    })

    await Promise.all([
      storageClient.saveDiff(diff),
      storageClient.saveDiffContent(diff.diffBlobKey, {
        ...diffResult,
        fromSnapshot: fromSnapshot.id,
        toSnapshot: toSnapshot.id,
        generatedAt: formatTimestamp()
      })
    ])

    return NextResponse.json({
      diff,
      htmlDiff: diffResult.htmlDiff,
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