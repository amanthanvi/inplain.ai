import { NextRequest, NextResponse } from 'next/server'
import { getClerkAuth } from '@/lib/auth-clerk'
import { isDevAuthEnabled } from '@/lib/dev-auth'
import { PrivacyMetricsService } from '@/lib/analytics/privacy-metrics'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'
import { getLatestDiffs } from '@/lib/api'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    // Check authentication (skip in dev with auth bypass)
    if (process.env.NODE_ENV === 'production' && !isDevAuthEnabled()) {
      const { userId } = await getClerkAuth()
      if (!userId) {
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    // Parse request body
    const body = await request.json()
    const { companySlugs } = body

    if (!companySlugs || !Array.isArray(companySlugs)) {
      return NextResponse.json(
        { error: 'Invalid request: companySlugs array required' },
        { status: 400 }
      )
    }

    // Get metrics service
    const metricsService = PrivacyMetricsService.getInstance()
    const results: Record<string, any> = {}

    // Process each company
    await Promise.all(
      companySlugs.map(async (slug) => {
        try {
          // Find the company
          const company = WATCHED_COMPANIES.find(c => c.slug === slug)
          if (!company) {
            results[slug] = { error: 'Company not found' }
            return
          }

          // Get recent diffs
          let recentDiffs = []
          try {
            recentDiffs = await getLatestDiffs(slug, 10)
          } catch (error) {
            console.warn(`Failed to fetch diffs for ${slug}:`, error)
          }

          // Fetch policy content
          let policyContent: string | undefined
          try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || request.nextUrl.origin
            const snapshotResponse = await fetch(`${baseUrl}/api/snapshot/${slug}`)
            if (snapshotResponse.ok) {
              const snapshot = await snapshotResponse.json()
              policyContent = snapshot.content || snapshot.text
            }
          } catch (error) {
            console.warn(`Failed to fetch policy content for ${slug}:`, error)
          }

          // Calculate metrics with actual policy content
          const metrics = await metricsService.calculateMetrics(
            company,
            policyContent,
            recentDiffs
          )

          // Get watcher count
          const watchers = await metricsService.getWatcherCount(slug)

          results[slug] = {
            ...metrics,
            lastChecked: new Date().toISOString(),
            watchers
          }
        } catch (error) {
          console.error(`Failed to calculate metrics for ${slug}:`, error)
          results[slug] = {
            error: 'Failed to calculate metrics',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
    )

    return NextResponse.json({ metrics: results })
  } catch (error) {
    console.error('Company metrics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}