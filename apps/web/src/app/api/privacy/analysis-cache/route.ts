import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export const runtime = 'edge'

const MAX_CACHE_TTL_SECONDS = 24 * 60 * 60
const COMPANY_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/

function isWriteAuthorized(request: NextRequest): boolean {
  const token = process.env.CRON_SECRET?.trim()
  return !!token && request.headers.get('authorization') === `Bearer ${token}`
}

function normalizedTtl(value: unknown): number {
  const ttl = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 86400
  return Math.max(60, Math.min(MAX_CACHE_TTL_SECONDS, ttl))
}

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
    if (!isWriteAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > 64 * 1024) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    const body = await request.json()
    const { company, analysisId, data } = body
    const ttl = normalizedTtl(body.ttl)

    if (!company || typeof company !== 'string' || !COMPANY_SLUG_PATTERN.test(company) || !data) {
      return NextResponse.json(
        { error: 'Valid company and data are required' },
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
    if (!isWriteAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const company = searchParams.get('company')

    if (!company || !COMPANY_SLUG_PATTERN.test(company)) {
      return NextResponse.json(
        { error: 'Valid company slug required' },
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
