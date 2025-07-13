import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/adapter'

export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params
    
    if (!slug) {
      return NextResponse.json(
        { error: 'Company slug is required' },
        { status: 400 }
      )
    }
    
    // Get the latest snapshot for this company
    const snapshots = await storage.snapshot.list({
      companySlug: slug,
      limit: 1
    })
    
    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json(
        { error: 'No policy snapshots found for this company' },
        { status: 404 }
      )
    }
    
    const latestSnapshot = snapshots[0]
    if (!latestSnapshot) {
      return NextResponse.json(
        { error: 'No policy snapshot available' },
        { status: 404 }
      )
    }
    
    // Get the policy content
    const content = await storage.getSnapshotContent(slug, latestSnapshot.id)
    
    if (!content) {
      return NextResponse.json(
        { error: 'Policy content not available' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      content,
      snapshotId: latestSnapshot.id,
      capturedAt: latestSnapshot.capturedAt,
      url: latestSnapshot.url
    })
  } catch (error) {
    console.error('Error fetching company policy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch policy content' },
      { status: 500 }
    )
  }
}