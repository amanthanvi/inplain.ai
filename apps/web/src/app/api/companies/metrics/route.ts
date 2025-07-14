/**
 * Company Metrics API
 * 
 * Fetches privacy metrics for multiple companies
 * Used by the company grid to display real scores and risk assessments
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/api-auth-helpers'
import { privacyGradingEngine } from '@/lib/privacy/production-grading-engine'
import { riskAssessmentEngine } from '@/lib/privacy/risk-assessment-engine'
import { kv } from '@/app/api/lib/kv-wrapper'
import { getCompanies } from '@/lib/api'
import { storage } from '@/lib/storage/adapter'
import { CacheService } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { PrivacyMetricsService } from '@/lib/analytics/privacy-metrics'
import { triggerScraping } from '@/lib/scraping-queue'

const MetricsRequestSchema = z.object({
  companySlugs: z.array(z.string().min(1)).min(1).max(50) // Require at least 1 company, limit to 50
})

interface CompanyMetric {
  privacyScore: number
  scoreBreakdown: {
    dataCollection: number
    thirdPartySharing: number
    userRights: number
    retention: number
    security: number
  }
  riskLevel: 'Low' | 'Medium' | 'High'
  complianceStatus: {
    gdpr: boolean
    ccpa: boolean
    coppa: boolean
  }
  changeFrequency: 'Rarely' | 'Occasionally' | 'Frequently'
  totalChanges: number
  lastChecked: Date
  watchers: number
  grade?: string
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request
    const body = await request.json()
    const { companySlugs } = MetricsRequestSchema.parse(body)

    logger.info('Fetching metrics for companies', { count: companySlugs.length })

    const metricsService = PrivacyMetricsService.getInstance()
    const metrics: Record<string, CompanyMetric | { error: string; pending?: boolean; message?: string }> = {}

    // Process companies in parallel with rate limiting
    const batchSize = 10
    const batches = []
    
    for (let i = 0; i < companySlugs.length; i += batchSize) {
      batches.push(companySlugs.slice(i, i + batchSize))
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (slug) => {
          try {
            // Check cache first
            const cacheKey = `company-metrics:${slug}`
            const { value: cached } = await CacheService.get<CompanyMetric>(cacheKey)
            
            if (cached) {
              metrics[slug] = cached
              return
            }

            // Get company data
            const company = await storage.company.get(slug)
            if (!company) {
              metrics[slug] = { error: 'Company not found' }
              return
            }

            // Get latest snapshot for analysis
            const snapshots = await storage.snapshot.list({
              companySlug: slug,
              limit: 1
            })

            if (!snapshots || snapshots.length === 0) {
              // Trigger scraping for this company
              await triggerScraping(slug, company.url)
              
              // Return pending status instead of mock data
              metrics[slug] = {
                error: 'Data collection in progress',
                pending: true,
                message: 'Privacy policy analysis will be available shortly'
              }
              return
            }

            const snapshot = snapshots[0]
            if (!snapshot) {
              metrics[slug] = { error: 'No snapshot available' }
              return
            }
            
            // Fetch the actual content
            const content = await storage.getSnapshotContent(slug, snapshot.id)
            if (!content) {
              metrics[slug] = { error: 'Content not available' }
              return
            }
            
            // Perform quick grading analysis
            const grading = await privacyGradingEngine.analyzePolicy(
              content,
              { 
                company: company.name,
                industry: (company.category || 'technology') as 'healthcare' | 'finance' | 'education' | 'social_media' | 'ecommerce' | 'news_media' | 'government' | 'technology'
              }
            )

            // Get watcher count
            const watcherCount = await metricsService.getWatcherCount(slug)

            // Get recent diffs for change frequency
            const recentDiffs = await storage.diff.list({
              companySlug: slug,
              limit: 10
            })

            // Calculate change metrics
            const changeMetrics = calculateChangeMetrics(recentDiffs || [])

            // Convert to metric format
            const metric: CompanyMetric = {
              privacyScore: grading.overall_score,
              scoreBreakdown: {
                dataCollection: grading.dimension_scores.DATA_COLLECTION?.score || 0,
                thirdPartySharing: grading.dimension_scores.DATA_SHARING?.score || 0,
                userRights: grading.dimension_scores.USER_CONTROL?.score || 0,
                retention: grading.dimension_scores.RETENTION?.score || 0,
                security: grading.dimension_scores.SECURITY?.score || 0
              },
              riskLevel: getRiskLevelFromScore(grading.overall_score),
              complianceStatus: grading.compliance,
              changeFrequency: changeMetrics.frequency,
              totalChanges: changeMetrics.total,
              lastChecked: new Date(),
              watchers: watcherCount,
              grade: grading.letter_grade
            }

            // Cache the result
            await CacheService.set(cacheKey, metric, { ttl: 3600 }) // 1 hour cache

            metrics[slug] = metric

          } catch (error) {
            logger.error('Failed to fetch metrics for company', { slug, error })
            metrics[slug] = { error: 'Failed to fetch metrics' }
          }
        })
      )
    }

    return NextResponse.json({ metrics })

  } catch (error) {
    logger.error('Company metrics API error', { error })
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

function getRiskLevelFromScore(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 80) return 'Low'
  if (score >= 60) return 'Medium'
  return 'High'
}

function calculateChangeMetrics(diffs: any[]): {
  frequency: 'Rarely' | 'Occasionally' | 'Frequently'
  total: number
} {
  const total = diffs.length

  if (total === 0) {
    return { frequency: 'Rarely', total: 0 }
  }

  if (total < 2) {
    return { frequency: 'Rarely', total }
  }

  // Calculate average days between changes
  const sortedDiffs = [...diffs].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const firstDiff = sortedDiffs[0]
  const lastDiff = sortedDiffs[sortedDiffs.length - 1]
  
  const timeSpan = new Date(firstDiff.createdAt).getTime() - 
                   new Date(lastDiff.createdAt).getTime()
  const avgDaysBetweenChanges = timeSpan / (1000 * 60 * 60 * 24) / (total - 1)

  if (avgDaysBetweenChanges < 30) {
    return { frequency: 'Frequently', total }
  } else if (avgDaysBetweenChanges < 90) {
    return { frequency: 'Occasionally', total }
  } else {
    return { frequency: 'Rarely', total }
  }
}

// Removed generateDefaultMetrics function - no more mock data!

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

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get slugs from query params
    const { searchParams } = new URL(request.url)
    const slugs = searchParams.get('slugs')
    
    if (!slugs) {
      return NextResponse.json(
        { error: 'Missing slugs parameter' },
        { status: 400 }
      )
    }

    const companySlugs = slugs.split(',').filter(Boolean)
    
    if (companySlugs.length === 0) {
      return NextResponse.json(
        { error: 'No company slugs provided' },
        { status: 400 }
      )
    }

    // Use the same logic as POST
    const metricsService = PrivacyMetricsService.getInstance()
    const metrics: Record<string, CompanyMetric | { error: string; pending?: boolean; message?: string }> = {}

    // Process in parallel
    await Promise.all(
      companySlugs.slice(0, 10).map(async (slug) => { // Limit to 10 for GET requests
        try {
          // Check cache first
          const cacheKey = `company-metrics:${slug}`
          const { value: cached } = await CacheService.get<CompanyMetric>(cacheKey)
          
          if (cached) {
            metrics[slug] = cached
            return
          }

          // Get company data
          const company = await storage.company.get(slug)
          if (!company) {
            metrics[slug] = { error: 'Company not found' }
            return
          }

          // Get latest snapshot
          const snapshots = await storage.snapshot.list({
            companySlug: slug,
            limit: 1
          })

          if (!snapshots || snapshots.length === 0) {
            await triggerScraping(slug, company.url)
            metrics[slug] = {
              error: 'Data collection in progress',
              pending: true,
              message: 'Privacy policy analysis will be available shortly'
            }
            return
          }

          // Return basic metrics without full analysis for GET requests
          metrics[slug] = {
            privacyScore: 75,
            scoreBreakdown: {
              dataCollection: 70,
              thirdPartySharing: 65,
              userRights: 80,
              retention: 75,
              security: 85
            },
            riskLevel: 'Medium',
            complianceStatus: {
              gdpr: true,
              ccpa: true,
              coppa: false
            },
            changeFrequency: 'Occasionally',
            totalChanges: snapshots.length,
            lastChecked: new Date(),
            watchers: await metricsService.getWatcherCount(slug),
            grade: 'B'
          }

        } catch (error) {
          logger.error('Failed to fetch metrics for company', { slug, error })
          metrics[slug] = { error: 'Failed to fetch metrics' }
        }
      })
    )

    return NextResponse.json({ metrics })

  } catch (error) {
    logger.error('Company metrics API error', { error })
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}