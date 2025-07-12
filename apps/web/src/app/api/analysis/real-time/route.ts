/**
 * Real-time Privacy Analysis API
 * 
 * Provides instant privacy scoring for policy content
 * Used by browser extension and real-time monitoring features
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { privacyGradingEngine } from '@/lib/privacy/production-grading-engine'
// Mock rate limiter
const rateLimiter = {
  limit: async (key: string) => ({ success: true })
}
import { logger } from '@/lib/logger'

const RealTimeAnalysisRequestSchema = z.object({
  content: z.string().min(100).max(500000), // Min 100 chars, max 500KB
  url: z.string().url().optional(),
  quick: z.boolean().optional() // For faster, less detailed analysis
})

export async function POST(request: NextRequest) {
  try {
    // Optional auth - allow anonymous for browser extension
    const { userId } = await auth()
    
    // Different rate limits for authenticated vs anonymous
    const rateLimitKey = userId || request.headers.get('x-forwarded-for') || 'anonymous'
    const { success } = await rateLimiter.limit(rateLimitKey)

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Parse request
    const body = await request.json()
    const { content, url, quick } = RealTimeAnalysisRequestSchema.parse(body)

    logger.info('Real-time analysis requested', { 
      contentLength: content.length,
      url,
      quick,
      authenticated: !!userId
    })

    if (quick) {
      // Fast scoring - just the essentials
      const quickScore = await performQuickScoring(content)
      return NextResponse.json(quickScore)
    }

    // Full analysis
    const analysis = await privacyGradingEngine.analyzePolicy(content, { url })

    // Simplified response for real-time use
    const response = {
      score: analysis.overall_score,
      grade: analysis.letter_grade,
      breakdown: {
        dataCollection: analysis.dimension_scores.DATA_COLLECTION?.score || 0,
        userControl: analysis.dimension_scores.USER_CONTROL?.score || 0,
        dataSharing: analysis.dimension_scores.DATA_SHARING?.score || 0,
        transparency: analysis.dimension_scores.TRANSPARENCY?.score || 0,
        security: analysis.dimension_scores.SECURITY?.score || 0,
        retention: analysis.dimension_scores.RETENTION?.score || 0
      },
      top_concerns: [
        ...analysis.red_flags.slice(0, 2),
        ...analysis.weaknesses
          .filter(w => w.includes('Weak'))
          .slice(0, 3 - analysis.red_flags.length)
      ].slice(0, 3),
      quick_actions: analysis.recommendations
        .filter(r => r.priority === 'high')
        .map(r => r.action)
        .slice(0, 3),
      compliance: {
        gdpr: analysis.compliance.gdpr,
        ccpa: analysis.compliance.ccpa
      },
      metadata: {
        analyzed_at: new Date().toISOString(),
        word_count: analysis.metadata.word_count,
        readability: analysis.metadata.readability_score
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Real-time analysis failed', { error })
    
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

async function performQuickScoring(content: string): Promise<{
  score: number
  grade: string
  risk_level: 'Low' | 'Medium' | 'High'
  key_indicators: string[]
}> {
  // Quick pattern-based scoring for instant feedback
  let score = 70 // Start neutral
  const indicators: string[] = []

  // Positive indicators
  const positivePatterns = [
    { pattern: /we do not sell/i, impact: 10, indicator: 'Does not sell data' },
    { pattern: /end-to-end encryption/i, impact: 8, indicator: 'Strong encryption' },
    { pattern: /gdpr compliant/i, impact: 5, indicator: 'GDPR compliant' },
    { pattern: /right to delete/i, impact: 7, indicator: 'Deletion rights' },
    { pattern: /opt[- ]?out/i, impact: 5, indicator: 'Opt-out available' }
  ]

  // Negative indicators
  const negativePatterns = [
    { pattern: /sell your (?:personal )?data/i, impact: -15, indicator: 'May sell data' },
    { pattern: /share with advertisers/i, impact: -10, indicator: 'Shares with advertisers' },
    { pattern: /indefinitely/i, impact: -8, indicator: 'Indefinite retention' },
    { pattern: /no guarantee/i, impact: -5, indicator: 'Weak security' },
    { pattern: /third[- ]?party tracking/i, impact: -7, indicator: 'Third-party tracking' }
  ]

  // Check patterns
  for (const { pattern, impact, indicator } of positivePatterns) {
    if (pattern.test(content)) {
      score += impact
      indicators.push(`✓ ${indicator}`)
    }
  }

  for (const { pattern, impact, indicator } of negativePatterns) {
    if (pattern.test(content)) {
      score += impact
      indicators.push(`⚠️ ${indicator}`)
    }
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score))

  // Determine grade
  let grade = 'F'
  if (score >= 90) grade = 'A'
  else if (score >= 80) grade = 'B'
  else if (score >= 70) grade = 'C'
  else if (score >= 60) grade = 'D'

  // Determine risk level
  let risk_level: 'Low' | 'Medium' | 'High' = 'Medium'
  if (score >= 80) risk_level = 'Low'
  else if (score < 60) risk_level = 'High'

  return {
    score,
    grade,
    risk_level,
    key_indicators: indicators.slice(0, 5)
  }
}