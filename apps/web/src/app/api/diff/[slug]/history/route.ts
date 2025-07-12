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
      return NextResponse.json(
        {
          error: 'Storage service not configured',
          message: 'Diff history requires proper storage configuration',
          documentation: 'https://docs.inplain.ai/configuration'
        },
        { status: 503 }
      )
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