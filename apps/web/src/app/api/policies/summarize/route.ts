import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { policySummarizer } from '@/lib/ai/policy-summarizer'
import { withErrorHandling, RateLimitError } from '@/lib/errors/api-errors'
import { performanceMonitor } from '@/lib/monitoring/performance'
import { logger } from '@/lib/monitoring'
import { z } from 'zod'
import { validateInput } from '@/lib/security/validation'

const summarizeSchema = z.object({
  policyText: z.string().min(100).max(100000),
  companyName: z.string().optional(),
  industry: z.string().optional(),
  targetAudience: z.enum(['general', 'technical', 'legal']).optional(),
  language: z.string().optional()
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const transactionId = performanceMonitor.startTransaction('api.policies.summarize')
  
  try {
    const { userId } = await auth()
    
    // Parse and validate request body
    const body = await request.json()
    const validation = validateInput(body, summarizeSchema, {
      sanitize: false,
      detectInjection: true
    })
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }
    
    const { policyText, companyName, industry, targetAudience, language } = validation.data
    
    // Rate limiting for non-authenticated users
    let count = 0;
    if (!userId) {
      const ip = request.headers.get('x-forwarded-for') || 'anonymous'
      const rateLimitKey = `summarize:${ip}:${new Date().toDateString()}`
      const currentCount = await kv.get(rateLimitKey) as number || 0;
      count = currentCount + 1;
      await kv.set(rateLimitKey, count);
      
      if (count === 1) {
        await kv.expire(rateLimitKey, 86400) // 24 hours
      }
      
      if (count > 3) {
        throw new RateLimitError(86400)
      }
    }
    
    logger.info('Policy summarization requested', {
      userId,
      companyName,
      policyLength: policyText.length
    })
    
    // Generate summary
    const summary = await policySummarizer.summarizePolicy(policyText, {
      companyName,
      industry,
      targetAudience,
      language
    })
    
    // Track usage
    if (userId) {
      await kv.hincrby(`user:${userId}:usage`, 'summaries', 1)
    }
    
    performanceMonitor.endTransaction(transactionId)
    
    return NextResponse.json({
      success: true,
      summary,
      usage: {
        remaining: userId ? 'unlimited' : Math.max(0, 3 - count),
        resetAt: userId ? null : new Date(new Date().setDate(new Date().getDate() + 1)).toISOString()
      }
    })
    
  } catch (error) {
    performanceMonitor.endTransaction(transactionId)
    throw error
  }
})

// Import kv after other imports to avoid circular dependency
import { kv } from '@vercel/kv'