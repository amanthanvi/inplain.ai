/**
 * Production-Ready Comprehensive Privacy Policy Analysis API
 * 
 * Performs deep analysis using the production grading engine
 * and risk assessment engine for detailed privacy insights.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { privacyGradingEngine } from '@/lib/privacy/production-grading-engine'
import { riskAssessmentEngine } from '@/lib/privacy/risk-assessment-engine'
import { kv } from '@/app/api/lib/kv-wrapper'
import { getCompanies } from '@/lib/api'

import { storage } from '@/lib/storage/adapter'
import { rateLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { CacheService } from '@/lib/cache'

const ComprehensiveAnalysisRequestSchema = z.object({
  slug: z.string().min(1),
  content: z.string().optional(),
  industry: z.enum([
    'healthcare', 'finance', 'education', 'social_media', 
    'ecommerce', 'news_media', 'government', 'technology'
  ]).optional(),
  refresh: z.boolean().optional()
})

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting
    const { allowed: success } = await rateLimiter.checkLimit(userId)

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Parse request
    const body = await request.json()
    const { slug, content, industry, refresh } = ComprehensiveAnalysisRequestSchema.parse(body)

    // Check cache first (unless refresh requested)
    const cacheKey = `comprehensive-analysis:${slug}:${industry || 'default'}`
    if (!refresh) {
      const { value: cached } = await CacheService.get(cacheKey)
      if (cached) {
        logger.info('Returning cached comprehensive analysis', { slug })
        return NextResponse.json(cached)
      }
    }

    // Get policy content if not provided
    let policyContent = content
    if (!policyContent) {
      logger.info('Fetching policy content for analysis', { slug })
      
      // Try to get the latest snapshot
      const snapshots = await storage.snapshot.list({
        companySlug: slug,
        limit: 1
      })

      if (!snapshots || snapshots.length === 0) {
        return NextResponse.json(
          { error: 'No policy content found for this company' },
          { status: 404 }
        )
      }

      policyContent = snapshots[0].content.text || ''
    }

    // Perform comprehensive analysis
    logger.info('Starting comprehensive policy analysis', { 
      slug, 
      contentLength: policyContent?.length || 0,
      industry 
    })

    // Run grading engine
    const gradingAnalysis = await privacyGradingEngine.analyzePolicy(
      policyContent || '',
      { company: slug, industry }
    )

    // Run risk assessment
    const riskAssessment = await riskAssessmentEngine.assessRisks(
      policyContent || '',
      gradingAnalysis,
      { industry }
    )

    // Get company info for context
    const company = await storage.company.get(slug)

    // Combine results
    const comprehensiveAnalysis = {
      company: {
        name: company?.name || slug,
        slug,
        industry: industry || company?.industry
      },
      grading: {
        overall_score: gradingAnalysis.overall_score,
        letter_grade: gradingAnalysis.letter_grade,
        dimension_scores: gradingAnalysis.dimension_scores,
        strengths: gradingAnalysis.strengths,
        weaknesses: gradingAnalysis.weaknesses,
        red_flags: gradingAnalysis.red_flags,
        recommendations: gradingAnalysis.recommendations,
        compliance: gradingAnalysis.compliance
      },
      risk_assessment: {
        overall_risk_score: riskAssessment.overall_risk_score,
        risk_level: riskAssessment.risk_level,
        category_risks: riskAssessment.category_risks,
        top_risks: riskAssessment.top_risks,
        mitigation_plan: riskAssessment.mitigation_plan,
        risk_timeline: riskAssessment.risk_timeline,
        comparisons: riskAssessment.comparisons
      },
      metadata: {
        ...gradingAnalysis.metadata,
        risk_assessed_at: new Date().toISOString(),
        cached: false
      },
      summary: generateExecutiveSummary(gradingAnalysis, riskAssessment)
    }

    // Cache the results
    await CacheService.set(cacheKey, comprehensiveAnalysis, { ttl: 3600 }) // 1 hour

    // Track analytics
    await trackAnalysisEvent(userId, slug, {
      score: gradingAnalysis.overall_score,
      grade: gradingAnalysis.letter_grade,
      risk_level: riskAssessment.risk_level
    })

    return NextResponse.json(comprehensiveAnalysis)

  } catch (error) {
    logger.error('Comprehensive analysis failed', { error })
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500 }
    )
  }
}

function generateExecutiveSummary(
  grading: any,
  risk: any
): {
  headline: string
  key_findings: string[]
  action_required: boolean
  recommended_actions: string[]
} {
  const headline = `${grading.letter_grade} Privacy Grade with ${risk.risk_level} Risk Level`
  
  const key_findings: string[] = []
  
  // Add top findings
  if (grading.red_flags.length > 0) {
    key_findings.push(`⚠️ ${grading.red_flags.length} critical privacy concerns identified`)
  }
  
  if (grading.overall_score >= 80) {
    key_findings.push('✓ Strong privacy protections in place')
  } else if (grading.overall_score < 50) {
    key_findings.push('⚠️ Significant privacy gaps detected')
  }
  
  // Add compliance status
  const compliantWith: string[] = []
  if (grading.compliance.gdpr) compliantWith.push('GDPR')
  if (grading.compliance.ccpa) compliantWith.push('CCPA')
  if (compliantWith.length > 0) {
    key_findings.push(`✓ Compliant with ${compliantWith.join(', ')}`)
  }
  
  // Add top risk
  if (risk.top_risks.length > 0) {
    key_findings.push(`⚠️ Top risk: ${risk.top_risks[0].risk}`)
  }
  
  // Determine if action required
  const action_required = grading.overall_score < 60 || 
                         risk.risk_level === 'HIGH' || 
                         risk.risk_level === 'CRITICAL' ||
                         grading.red_flags.length > 0
  
  // Get recommended actions
  const recommended_actions = [
    ...risk.risk_timeline.immediate.slice(0, 2),
    ...grading.recommendations
      .filter((r: any) => r.priority === 'high')
      .map((r: any) => r.action)
      .slice(0, 2)
  ].slice(0, 3)
  
  return {
    headline,
    key_findings: key_findings.slice(0, 4),
    action_required,
    recommended_actions
  }
}

async function trackAnalysisEvent(
  userId: string,
  companySlug: string,
  results: {
    score: number
    grade: string
    risk_level: string
  }
) {
  try {
    // Track in analytics system
    await storage.analytics.track({
      userId,
      event: 'comprehensive_analysis_completed',
      properties: {
        company_slug: companySlug,
        privacy_score: results.score,
        letter_grade: results.grade,
        risk_level: results.risk_level,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.warn('Failed to track analysis event', { error })
  }
}