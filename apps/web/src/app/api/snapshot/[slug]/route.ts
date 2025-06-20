import { NextRequest, NextResponse } from 'next/server'
import { StorageClient } from '../../lib/storage'

const storage = new StorageClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    
    // Get the latest snapshot
    const snapshots = await storage.getLatestSnapshots(slug, 1)
    
    if (snapshots.length === 0) {
      return NextResponse.json(
        { error: 'No snapshots found for this policy' },
        { status: 404 }
      )
    }
    
    const snapshot = snapshots[0]
    
    if (!snapshot) {
      return NextResponse.json(
        { error: 'No snapshots found for this policy' },
        { status: 404 }
      )
    }
    
    // Get the snapshot content
    const content = await storage.getSnapshotContent(snapshot.blobKey)
    
    if (!content) {
      return NextResponse.json(
        { error: 'Snapshot content not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      snapshot: {
        id: snapshot.id,
        capturedAt: snapshot.capturedAt,
        url: snapshot.url,
        contentHash: snapshot.contentHash
      },
      content: {
        text: content,
        wordCount: content.split(/\s+/).length,
        characterCount: content.length
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Snapshot fetch error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}