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
      return NextResponse.json({
        diffs: [],
        count: 0,
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