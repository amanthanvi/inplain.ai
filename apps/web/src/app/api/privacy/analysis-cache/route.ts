import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export const runtime = 'edge'

// GET: Retrieve cached analysis
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company = searchParams.get('company')
    const analysisId = searchParams.get('id')

    if (!company && !analysisId) {
      return NextResponse.json(
        { error: 'Company slug or analysis ID required' },
        { status: 400 }
      )
    }

    let cacheKey: string
    if (analysisId) {
      cacheKey = `analysis:${analysisId}`
    } else {
      cacheKey = `cache:analysis:${company}`
    }

    const cached = await kv.get(cacheKey)
    
    if (!cached) {
      return NextResponse.json(
        { error: 'No cached analysis found' },
        { status: 404 }
      )
    }

    // Check if cache is still fresh (24 hours)
    const cacheData = cached as any
    const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours

    return NextResponse.json({
      ...cacheData,
      fresh: cacheAge < maxAge,
      age: Math.round(cacheAge / 1000 / 60) // age in minutes
    })

  } catch (error) {
    console.error('Cache retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve cached analysis' },
      { status: 500 }
    )
  }
}

// POST: Store analysis in cache
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { company, analysisId, data, ttl = 86400 } = body // Default 24 hour TTL

    if (!company || !data) {
      return NextResponse.json(
        { error: 'Company and data are required' },
        { status: 400 }
      )
    }

    const cacheKey = `cache:analysis:${company}`
    const cacheData = {
      ...data,
      company,
      timestamp: new Date().toISOString(),
      analysisId
    }

    await kv.setex(cacheKey, ttl, cacheData)

    // Also store by analysis ID if provided
    if (analysisId) {
      await kv.setex(`analysis:${analysisId}`, ttl * 7, cacheData) // 7 days for analysis ID
    }

    return NextResponse.json({
      success: true,
      cacheKey,
      ttl
    })

  } catch (error) {
    console.error('Cache storage error:', error)
    return NextResponse.json(
      { error: 'Failed to cache analysis' },
      { status: 500 }
    )
  }
}

// DELETE: Clear cache for a company
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company = searchParams.get('company')

    if (!company) {
      return NextResponse.json(
        { error: 'Company slug required' },
        { status: 400 }
      )
    }

    const cacheKey = `cache:analysis:${company}`
    await kv.del(cacheKey)

    return NextResponse.json({
      success: true,
      cleared: cacheKey
    })

  } catch (error) {
    console.error('Cache deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    )
  }
}