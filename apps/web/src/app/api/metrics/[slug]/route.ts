import { NextRequest, NextResponse } from 'next/server'
import { metricsService } from '@/lib/metrics-service'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'
import { getEnvVar } from '@/lib/env'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    
    // Find company from watched list
    const company = WATCHED_COMPANIES.find(c => c.slug === slug)
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }
    
    // Check if storage is configured
    const kvUrl = getEnvVar('KV_REST_API_URL')
    const kvToken = getEnvVar('KV_REST_API_TOKEN')
    
    if (!kvUrl || !kvToken) {
      return NextResponse.json(
        {
          error: 'Storage service not configured',
          message: 'Metrics require KV storage configuration',
          documentation: 'https://docs.inplain.ai/configuration'
        },
        { status: 503 }
      )
    }
    
    // Get real metrics from storage
    const metrics = await metricsService.getCompanyMetrics(slug, company.checkInterval)
    
    return NextResponse.json({
      metrics,
      mock: false
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
    
  } catch (error) {
    console.error('Metrics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}