import { NextRequest, NextResponse } from 'next/server'
import { getClerkAuth } from '@/lib/auth-clerk'
import { isDevAuthEnabled } from '@/lib/dev-auth'
import { PrivacyMetricsService } from '@/lib/analytics/privacy-metrics'
import { storage } from '@/lib/storage/adapter'

export const runtime = 'edge'

function getGradeFromScore(score: number): string {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 87) return 'A-'
  if (score >= 83) return 'B+'
  if (score >= 80) return 'B'
  if (score >= 77) return 'B-'
  if (score >= 73) return 'C+'
  if (score >= 70) return 'C'
  if (score >= 67) return 'C-'
  if (score >= 63) return 'D+'
  if (score >= 60) return 'D'
  if (score >= 57) return 'D-'
  return 'F'
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication (skip in dev with auth bypass)
    if (process.env.NODE_ENV === 'production' && !isDevAuthEnabled()) {
      const { userId } = await getClerkAuth()
      if (!userId) {
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    const slug = 'google'
    const metricsService = PrivacyMetricsService.getInstance()
    
    // Get company data
    const company = await storage.company.get(slug)
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Calculate metrics
    const metrics = await metricsService.calculateMetrics(company)
    
    // Get historical data for trends
    const diffs = await storage.diff.list({
      companySlug: slug,
      limit: 100
    })

    // Generate analytics response
    const analytics = {
      company: {
        name: company.name,
        slug: company.slug,
        category: company.category || 'technology'
      },
      currentMetrics: {
        privacyScore: metrics.privacyScore,
        riskLevel: metrics.riskLevel,
        grade: getGradeFromScore(metrics.privacyScore),
        lastAnalyzed: metrics.lastAnalyzed,
        scoreBreakdown: metrics.scoreBreakdown
      },
      trends: {
        scoreChange: 0, // TODO: Calculate score change from historical data
        changeFrequency: metrics.changeFrequency,
        totalChanges: diffs?.length || 0,
        recentChanges: diffs?.slice(0, 5).map(diff => ({
          date: diff.createdAt,
          type: 'update', // Generic type for all changes
          significance: diff.changeType // This is already 'minor' | 'moderate' | 'major'
        })) || []
      },
      compliance: metrics.complianceStatus,
      recommendations: [
        metrics.privacyScore < 70 ? 'Consider reviewing privacy practices' : null,
        metrics.riskLevel === 'High' ? 'High risk detected - monitor closely' : null,
        metrics.changeFrequency === 'Frequently' ? 'Policy changes frequently - stay updated' : null
      ].filter(Boolean),
      metadata: {
        lastUpdated: new Date().toISOString(),
        dataSource: 'real-time-analysis'
      }
    }

    return NextResponse.json(analytics, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Google analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}