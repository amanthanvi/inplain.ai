import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { z } from 'zod'

const performanceMetricSchema = z.object({
  metric: z.object({
    name: z.string(),
    value: z.number(),
    unit: z.enum(['ms', 'bytes', 'count', 'percent']),
    timestamp: z.number(),
    tags: z.record(z.string()).optional()
  }),
  sessionId: z.string(),
  timestamp: z.number(),
  userAgent: z.string(),
  url: z.string()
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json()
    const data = performanceMetricSchema.parse(body)
    
    // Store metric in KV
    const date = new Date().toISOString().split('T')[0]
    const metricKey = `perf:${data.metric.name}:${date}`
    const sessionKey = `perf:session:${data.sessionId}:${date}`
    
    // Store aggregated metrics
    const pipeline = kv.pipeline()
    
    // Add to daily metrics
    pipeline.zadd(metricKey, {
      score: data.timestamp,
      member: JSON.stringify({
        value: data.metric.value,
        sessionId: data.sessionId,
        url: data.url,
        tags: data.metric.tags
      })
    })
    
    // Add to session metrics
    pipeline.hset(sessionKey, {
      [data.metric.name]: data.metric.value,
      [`${data.metric.name}_timestamp`]: data.timestamp,
      userAgent: data.userAgent,
      url: data.url
    })
    
    // Set expiration (30 days)
    pipeline.expire(metricKey, 86400 * 30)
    pipeline.expire(sessionKey, 86400 * 30)
    
    // Execute pipeline
    await pipeline.exec()
    
    // Check for anomalies
    if (data.metric.name === 'LCP' && data.metric.value > 4000) {
      // Log slow LCP
      await kv.zadd('perf:alerts:lcp', {
        score: data.timestamp,
        member: JSON.stringify({
          value: data.metric.value,
          url: data.url,
          sessionId: data.sessionId
        })
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to store performance metric:', error)
    return NextResponse.json(
      { error: 'Failed to store metric' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const metric = searchParams.get('metric')
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const limit = parseInt(searchParams.get('limit') || '100')
    
    if (!metric) {
      // Return available metrics
      const metrics = ['LCP', 'FID', 'CLS', 'TTFB', 'FCP']
      const summary: Record<string, any> = {}
      
      for (const m of metrics) {
        const key = `perf:${m}:${date}`
        const values = await kv.zrange(key, 0, -1)
        
        if (values.length > 0) {
          const parsedValues = values.map((v: any) => {
            const data = JSON.parse(v)
            return data.value
          })
          
          const sorted = parsedValues.sort((a: number, b: number) => a - b)
          summary[m] = {
            count: sorted.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            avg: sorted.reduce((a: number, b: number) => a + b, 0) / sorted.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p75: sorted[Math.floor(sorted.length * 0.75)],
            p95: sorted[Math.floor(sorted.length * 0.95)]
          }
        }
      }
      
      return NextResponse.json({
        date,
        metrics: summary
      })
    }
    
    // Return specific metric data
    const key = `perf:${metric}:${date}`
    const values = await kv.zrange(key, -limit, -1, { withScores: true }) as Array<[string, number]>
    
    const data = values.map(([member, score]) => {
      const parsed = JSON.parse(member)
      return {
        ...parsed,
        timestamp: score
      }
    })
    
    return NextResponse.json({
      metric,
      date,
      count: data.length,
      data
    })
  } catch (error) {
    console.error('Failed to fetch performance metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}