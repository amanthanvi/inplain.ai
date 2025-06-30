import { NextResponse } from 'next/server'
import { checkAuth } from '@/lib/auth'
import { kv } from '@vercel/kv'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    // Check authentication in production
    const authResult = await checkAuth(request)
    if (!authResult.authenticated && process.env.NODE_ENV === 'production') {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Try to get cached stats from KV
    const cacheKey = 'analytics:dashboard:stats'
    
    if (process.env.KV_REST_API_URL) {
      try {
        const cached = await kv.get(cacheKey)
        if (cached) {
          return NextResponse.json(cached)
        }
      } catch (error) {
        console.error('KV cache error:', error)
      }
    }

    // Generate analytics data
    const totalCompanies = WATCHED_COMPANIES.length
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Simulate analytics based on realistic patterns
    const stats = {
      // Active monitoring (all companies are actively monitored)
      activeMonitoring: totalCompanies,
      
      // Recent changes (simulate ~20% of companies had changes in last 30 days)
      recentChanges: Math.floor(totalCompanies * 0.2),
      
      // High risk (simulate ~10% are high risk)
      highRisk: Math.floor(totalCompanies * 0.1),
      
      // Average privacy score (realistic range 70-90)
      averageScore: 82,
      
      // Additional detailed stats
      details: {
        changesByPeriod: {
          last7Days: Math.floor(totalCompanies * 0.05),
          last30Days: Math.floor(totalCompanies * 0.2),
          last90Days: Math.floor(totalCompanies * 0.35)
        },
        
        riskDistribution: {
          low: Math.floor(totalCompanies * 0.6),
          medium: Math.floor(totalCompanies * 0.3),
          high: Math.floor(totalCompanies * 0.1)
        },
        
        complianceStats: {
          gdprCompliant: Math.floor(totalCompanies * 0.75),
          ccpaCompliant: Math.floor(totalCompanies * 0.65),
          coppaCompliant: Math.floor(totalCompanies * 0.4)
        },
        
        categoryBreakdown: {
          'Technology': Math.floor(totalCompanies * 0.4),
          'Social Media': Math.floor(totalCompanies * 0.2),
          'E-commerce': Math.floor(totalCompanies * 0.15),
          'Finance': Math.floor(totalCompanies * 0.1),
          'Entertainment': Math.floor(totalCompanies * 0.1),
          'Other': Math.floor(totalCompanies * 0.05)
        },
        
        topChanges: [
          {
            company: 'Google',
            changeType: 'Data Collection',
            date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            impact: 'moderate'
          },
          {
            company: 'Meta',
            changeType: 'Third-party Sharing',
            date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            impact: 'major'
          },
          {
            company: 'Amazon',
            changeType: 'User Rights',
            date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            impact: 'minor'
          }
        ],
        
        alertsGenerated: {
          today: 3,
          thisWeek: 18,
          thisMonth: 72
        }
      },
      
      // Timestamps
      lastUpdated: now.toISOString(),
      dataRange: {
        from: thirtyDaysAgo.toISOString(),
        to: now.toISOString()
      }
    }

    // Cache the result for 5 minutes
    if (process.env.KV_REST_API_URL) {
      try {
        await kv.set(cacheKey, stats, { ex: 300 })
      } catch (error) {
        console.error('Failed to cache stats:', error)
      }
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Analytics dashboard error:', error)
    
    // Return default stats on error
    return NextResponse.json({
      activeMonitoring: WATCHED_COMPANIES.length,
      recentChanges: 0,
      highRisk: 0,
      averageScore: 85,
      error: 'Failed to load complete analytics'
    })
  }
}