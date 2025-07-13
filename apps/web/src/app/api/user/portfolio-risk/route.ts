import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { storage } from '@/lib/storage/adapter'
import { PrivacyMetricsService } from '@/lib/analytics/privacy-metrics'

export const runtime = 'edge'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For now, use all companies as the portfolio
    // In production, this would fetch the user's actual watchlist
    const { WATCHED_COMPANIES } = await import('@inplain.ai/shared')
    const companies = Object.values(WATCHED_COMPANIES).slice(0, 5) // Limit to 5 for performance
    
    if (companies.length === 0) {
      return NextResponse.json({
        overall: 0,
        categories: {
          dataCollection: 0,
          thirdPartySharing: 0,
          dataRetention: 0,
          userRights: 0,
          transparency: 0
        },
        trend: 'stable' as const,
        lastUpdated: new Date().toISOString(),
        alerts: 0,
        message: 'No companies available'
      })
    }

    // Calculate aggregate risk metrics for all companies
    const metricsService = PrivacyMetricsService.getInstance()
    const allMetrics = []
    let totalAlerts = 0

    for (const company of companies) {
      try {
        const metrics = await metricsService.calculateMetrics(company)
        allMetrics.push(metrics)
        
        // Count high risk items as alerts
        if (metrics.riskLevel === 'High') {
          totalAlerts++
        }
      } catch (error) {
        console.warn(`Failed to calculate metrics for ${company.name}:`, error)
      }
    }

    if (allMetrics.length === 0) {
      return NextResponse.json({
        overall: 0,
        categories: {
          dataCollection: 0,
          thirdPartySharing: 0,
          dataRetention: 0,
          userRights: 0,
          transparency: 0
        },
        trend: 'stable' as const,
        lastUpdated: new Date().toISOString(),
        alerts: 0,
        message: 'Unable to calculate portfolio metrics'
      })
    }

    // Calculate averages
    const avgScore = allMetrics.reduce((sum, m) => sum + m.privacyScore, 0) / allMetrics.length
    const avgCategories = {
      dataCollection: allMetrics.reduce((sum, m) => sum + (m.scoreBreakdown?.dataCollection || 0), 0) / allMetrics.length,
      thirdPartySharing: allMetrics.reduce((sum, m) => sum + (m.scoreBreakdown?.thirdPartySharing || 0), 0) / allMetrics.length,
      dataRetention: allMetrics.reduce((sum, m) => sum + (m.scoreBreakdown?.retention || 0), 0) / allMetrics.length,
      userRights: allMetrics.reduce((sum, m) => sum + (m.scoreBreakdown?.userRights || 0), 0) / allMetrics.length,
      transparency: allMetrics.reduce((sum, m) => sum + (m.scoreBreakdown?.security || 0), 0) / allMetrics.length
    }

    // Determine trend (simplified - in reality would compare with historical data)
    const trend = avgScore > 70 ? 'up' : avgScore < 50 ? 'down' : 'stable'

    return NextResponse.json({
      overall: avgScore / 10, // Convert to 0-10 scale
      categories: {
        dataCollection: avgCategories.dataCollection / 10,
        thirdPartySharing: avgCategories.thirdPartySharing / 10,
        dataRetention: avgCategories.dataRetention / 10,
        userRights: avgCategories.userRights / 10,
        transparency: avgCategories.transparency / 10
      },
      trend: trend as 'up' | 'down' | 'stable',
      lastUpdated: new Date().toISOString(),
      alerts: totalAlerts,
      companiesAnalyzed: allMetrics.length,
      totalCompanies: companies.length
    })
  } catch (error) {
    console.error('Portfolio risk calculation error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate portfolio risk' },
      { status: 500 }
    )
  }
}