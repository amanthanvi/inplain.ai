import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StorageClient } from '../../../lib/storage'
import { DiffEngine } from '../../../lib/diff-engine'
import { DiffMetaSchema } from '@policydiff/shared'
import { formatTimestamp } from '@policydiff/shared'

const storage = new StorageClient()
const diffEngine = new DiffEngine()

const querySchema = z.object({
  from: z.string().uuid().optional(),
  to: z.string().uuid().optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const { searchParams } = new URL(request.url)
    
    const query = querySchema.parse({
      from: searchParams.get('from'),
      to: searchParams.get('to')
    })

    const snapshots = await storage.getLatestSnapshots(slug, 2)
    
    if (snapshots.length < 2) {
      return NextResponse.json(
        { error: 'Not enough snapshots to generate diff' },
        { status: 404 }
      )
    }

    const [toSnapshot, fromSnapshot] = snapshots
    
    // Type guard to ensure snapshots are defined
    if (!fromSnapshot || !toSnapshot) {
      return NextResponse.json(
        { error: 'Invalid snapshot data' },
        { status: 500 }
      )
    }
    
    const [oldContent, newContent] = await Promise.all([
      storage.getSnapshotContent(fromSnapshot.blobKey),
      storage.getSnapshotContent(toSnapshot.blobKey)
    ])

    if (!oldContent || !newContent) {
      return NextResponse.json(
        { error: 'Failed to fetch snapshot content' },
        { status: 500 }
      )
    }

    const diffResult = diffEngine.computeDiff(oldContent, newContent)
    
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
      storage.saveDiff(diff),
      storage.saveDiffContent(diff.diffBlobKey, {
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