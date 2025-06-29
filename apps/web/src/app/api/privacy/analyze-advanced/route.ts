import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAIService } from '@/lib/ai/enhanced-ai-service'
import { AdvancedPrivacyScorer } from '@/lib/privacy/advanced-scoring'
import { kv } from '@vercel/kv'
import { aiCache } from '@/lib/cache/ai-cache'
import { caches } from '@/lib/cache/redis-cache'
import { withErrorHandling, RateLimitError } from '@/lib/errors/api-errors'
import { performanceMonitor } from '@/lib/monitoring/performance'
import { circuitBreakers } from '@/lib/resilience/circuit-breaker'
import { logger } from '@/lib/monitoring'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for complex analysis

export const POST = withErrorHandling(async (request: NextRequest) => {
  const transactionId = performanceMonitor.startTransaction('api.privacy.analyze-advanced')
  
  try {
    const { userId } = await auth()
    
    // Allow demo mode for unauthenticated users with restrictions
    const isDemo = !userId
    
    const body = await request.json()
    const {
      policyText,
      company,
      industry,
      analysisType = 'comprehensive',
      perspectives = ['privacyExpert', 'userAdvocate'],
      includeComparison = false,
      streamResponse = false
    } = body

    if (!policyText || !company) {
      return NextResponse.json(
        { error: 'Policy text and company name are required' },
        { status: 400 }
      )
    }

    // Generate cache key
    const cacheKey = crypto
      .createHash('sha256')
      .update(JSON.stringify({ policyText, company, industry, analysisType, perspectives }))
      .digest('hex')

    // Check cache first (not for streaming responses)
    if (!streamResponse && !isDemo) {
      const cached = await aiCache.getResponse('privacy-analysis', cacheKey)
      if (cached) {
        logger.info('Privacy analysis cache hit', { company })
        performanceMonitor.endTransaction(transactionId)
        return NextResponse.json(JSON.parse(cached))
      }
    }

    // Rate limiting for demo mode
    if (isDemo) {
      const demoKey = request.headers.get('x-forwarded-for') || 'demo'
      const demoCount = await kv.incr(`demo:analyze:${demoKey}:${new Date().toISOString().slice(0, 10)}`)
      
      if (demoCount > 5) {
        throw new RateLimitError(86400) // 24 hours
      }
    }

    // Get AI service with circuit breaker
    const aiService = await circuitBreakers.openrouter.execute(
      () => Promise.resolve(getAIService()),
      async () => {
        // Fallback: return cached response or error
        logger.warn('AI service circuit breaker open, using fallback')
        throw new Error('AI service temporarily unavailable. Please try again later.')
      }
    )

    // For streaming responses
    if (streamResponse) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send initial event
            controller.enqueue(encoder.encode(`event: start\ndata: ${JSON.stringify({ 
              message: 'Starting privacy policy analysis...',
              company,
              industry 
            })}\n\n`))

            // Stream the analysis
            let analysisResult = ''
            let progress = 0

            for await (const { chunk, progress: currentProgress } of aiService.streamAnalysis(policyText, {
              analysisType: analysisType as any,
              onProgress: (p) => {
                progress = p
              }
            })) {
              analysisResult += chunk
              
              // Send progress updates
              if (Math.floor(currentProgress * 10) > Math.floor(progress * 10)) {
                controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({ 
                  progress: currentProgress,
                  stage: currentProgress < 0.3 ? 'Analyzing policy structure...' :
                         currentProgress < 0.6 ? 'Evaluating privacy practices...' :
                         currentProgress < 0.9 ? 'Generating insights...' :
                         'Finalizing analysis...'
                })}\n\n`))
              }
            }

            // Parse the streamed analysis
            const analysis = JSON.parse(analysisResult)

            // Calculate privacy score
            const scorer = new AdvancedPrivacyScorer(analysis)
            const scoreResult = scorer.calculateScore({ industry })

            // Send score event
            controller.enqueue(encoder.encode(`event: score\ndata: ${JSON.stringify(scoreResult)}\n\n`))

            // Generate comparison if requested
            if (includeComparison && industry) {
              controller.enqueue(encoder.encode(`event: comparison\ndata: ${JSON.stringify({ 
                message: 'Generating industry comparison...' 
              })}\n\n`))

              // Get industry peers for comparison
              const industryPeers = await kv.zrange(`industry:${industry}:scores`, 0, 9, {
                withScores: true
              }) as Array<[string, number]>

              const comparison = {
                rank: industryPeers.filter(([_, score]) => score > scoreResult.overallScore).length + 1,
                totalCompanies: industryPeers.length + 1,
                betterThan: Math.round(((industryPeers.length - industryPeers.filter(([_, score]) => score > scoreResult.overallScore).length) / (industryPeers.length + 1)) * 100),
                topPerformers: industryPeers.slice(0, 3).map(([company, score]) => ({ company, score }))
              }

              controller.enqueue(encoder.encode(`event: comparison\ndata: ${JSON.stringify(comparison)}\n\n`))
            }

            // Save analysis results (with user association if authenticated)
            const analysisId = `analysis:${Date.now()}`
            await kv.setex(analysisId, 7 * 24 * 60 * 60, {
              company,
              industry,
              score: scoreResult,
              analysis,
              timestamp: new Date().toISOString(),
              userId: userId || 'demo'
            })

            // Update industry scores
            if (industry && !isDemo) {
              await kv.zadd(`industry:${industry}:scores`, {
                score: scoreResult.overallScore,
                member: company
              })
            }

            // Send completion event
            controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify({ 
              analysisId,
              message: 'Analysis complete!' 
            })}\n\n`))

            controller.close()
          } catch (error) {
            console.error('Streaming analysis error:', error)
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ 
              error: 'Analysis failed. Please try again.' 
            })}\n\n`))
            controller.close()
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    }

    // Non-streaming response
    const result = await aiService.analyzePrivacyPolicy(policyText, {
      analysisType: analysisType as any,
      perspectives: perspectives as any,
      insightConfig: {
        depth: isDemo ? 'standard' : 'deep',
        focus: ['risks', 'opportunities', 'recommendations'],
        predictions: !isDemo,
        recommendations: true,
        comparisons: includeComparison
      },
      metadata: {
        company,
        industry: industry || 'technology'
      }
    })

    // Calculate privacy score
    const scorer = new AdvancedPrivacyScorer(result.analysis)
    const scoreResult = scorer.calculateScore({ industry })

    // Get model recommendations
    const modelRecommendations = aiService.getModelRecommendations()

    // Industry comparison
    let comparison = null
    if (includeComparison && industry) {
      const industryPeers = await kv.zrange(`industry:${industry}:scores`, 0, -1, {
        withScores: true
      }) as Array<[string, number]>

      comparison = {
        rank: industryPeers.filter(([_, score]) => score > scoreResult.overallScore).length + 1,
        totalCompanies: industryPeers.length + 1,
        betterThan: Math.round(((industryPeers.length - industryPeers.filter(([_, score]) => score > scoreResult.overallScore).length) / (industryPeers.length + 1)) * 100),
        distribution: generateDistribution(industryPeers.map(([_, score]) => score)),
        topPerformers: industryPeers.slice(0, 5).map(([company, score]) => ({ 
          company, 
          score
        }))
      }
    }

    // Save analysis
    const analysisId = `analysis:${Date.now()}`
    await kv.setex(analysisId, 7 * 24 * 60 * 60, {
      company,
      industry,
      score: scoreResult,
      analysis: result.analysis,
      insights: result.insights,
      comparison,
      timestamp: new Date().toISOString(),
      userId: userId || 'demo',
      metadata: result.metadata
    })

    // Update user history if authenticated
    if (userId) {
      await kv.lpush(`user:${userId}:analyses`, analysisId)
      await kv.ltrim(`user:${userId}:analyses`, 0, 99) // Keep last 100 analyses
    }

    // Update industry scores
    if (industry && !isDemo) {
      await kv.zadd(`industry:${industry}:scores`, {
        score: scoreResult.overallScore,
        member: company
      })
    }

    const response = {
      success: true,
      analysisId,
      analysis: result.analysis,
      insights: result.insights,
      score: scoreResult,
      comparison,
      metadata: {
        ...result.metadata,
        modelRecommendations: isDemo ? undefined : modelRecommendations
      },
      limits: isDemo ? {
        remaining: 5 - ((await kv.get(`demo:analyze:${request.headers.get('x-forwarded-for') || 'demo'}:${new Date().toISOString().slice(0, 10)}`) as number) || 0),
        resetAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
      } : undefined
    }

    // Cache the response (not for demo users)
    if (!isDemo) {
      await aiCache.setResponse('privacy-analysis', cacheKey, JSON.stringify(response), {
        model: result.metadata?.model || 'unknown',
        company,
        industry,
        analysisType
      })
    }

    performanceMonitor.endTransaction(transactionId)
    return NextResponse.json(response)

  } catch (error) {
    performanceMonitor.endTransaction(transactionId)
    throw error
  }
})

// Helper function to generate score distribution
function generateDistribution(scores: number[]): Record<string, number> {
  const distribution: Record<string, number> = {
    '0-20': 0,
    '21-40': 0,
    '41-60': 0,
    '61-80': 0,
    '81-100': 0
  }

  scores.forEach(score => {
    if (score <= 20) distribution['0-20']!++
    else if (score <= 40) distribution['21-40']!++
    else if (score <= 60) distribution['41-60']!++
    else if (score <= 80) distribution['61-80']!++
    else distribution['81-100']!++
  })

  return distribution
}

// GET endpoint for retrieving analysis results
export const GET = withErrorHandling(async (request: NextRequest) => {
  const transactionId = performanceMonitor.startTransaction('api.privacy.get-analysis')
  
  try {
    const { userId } = await auth()
    const { searchParams } = new URL(request.url)
    const analysisId = searchParams.get('id')

    if (!analysisId) {
      return NextResponse.json(
        { error: 'Analysis ID is required' },
        { status: 400 }
      )
    }

    // Try cache first
    const cacheKey = `analysis:${analysisId}`
    const cached = await caches.data.get(cacheKey)
    if (cached) {
      performanceMonitor.endTransaction(transactionId)
      return NextResponse.json(cached)
    }

    const analysis = await kv.get(analysisId)
    
    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      )
    }

    // Check if user has access (owner or demo)
    const analysisData = analysis as any
    if (analysisData.userId !== 'demo' && analysisData.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Cache the result for future requests
    await caches.data.set(cacheKey, analysisData, {
      ttl: 3600, // 1 hour
      tags: ['analysis', `user:${userId}`]
    })

    performanceMonitor.endTransaction(transactionId)
    return NextResponse.json(analysisData)

  } catch (error) {
    performanceMonitor.endTransaction(transactionId)
    throw error
  }
})