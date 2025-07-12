import { NextRequest, NextResponse } from 'next/server'
import { getUnifiedAIService } from '@/lib/ai/unified-ai-service'
import { ModelCatalog } from '@/lib/ai/model-catalog'

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  
  // Only allow in development or with correct secret
  if (process.env.NODE_ENV !== 'development' && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
  const DEFAULT_MODEL = process.env.DEFAULT_AI_MODEL || 'google/gemini-2.0-flash-exp:free'
  
  try {
    // Test 1: Check if API key exists
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({
        error: 'OPENROUTER_API_KEY not configured',
        suggestion: 'Please set OPENROUTER_API_KEY in Vercel environment variables'
      }, { status: 500 })
    }
    
    // Test 2: Initialize AI service
    let aiService
    try {
      aiService = getUnifiedAIService()
    } catch (error) {
      return NextResponse.json({
        error: 'Failed to initialize AI service',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
    
    // Test 3: Get available models
    let models
    try {
      models = ModelCatalog.getAllModels()
    } catch (error) {
      return NextResponse.json({
        error: 'Failed to get available models',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
    
    // Test 4: Test simple prompt
    let response
    try {
      response = await aiService.analyze('Reply with "OK" if you receive this message.', {
        model: DEFAULT_MODEL,
        maxTokens: 10,
        temperature: 0,
        useTools: false,
        useThinking: false
      })
    } catch (error) {
      return NextResponse.json({
        error: 'Failed to generate AI response',
        details: error instanceof Error ? error.message : 'Unknown error',
        apiKey: {
          exists: true,
          length: OPENROUTER_API_KEY.length,
          startsWithSk: OPENROUTER_API_KEY.startsWith('sk-'),
          model: DEFAULT_MODEL
        }
      }, { status: 500 })
    }
    
    // Test 5: Test policy analysis
    let analysisResponse
    try {
      const analysisResult = await aiService.analyze('Analyze privacy policy changes with 100 additions and 50 deletions', {
        model: DEFAULT_MODEL,
        task: 'differential',
        useTools: true,
        useThinking: true
      })
      
      analysisResponse = {
        summary: analysisResult.content,
        highlights: [],
        riskLevel: 'medium'
      }
    } catch (error) {
      return NextResponse.json({
        error: 'Failed to analyze policy changes',
        details: error instanceof Error ? error.message : 'Unknown error',
        simpleTestPassed: true,
        simpleResponse: response
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      tests: {
        apiKeyConfigured: true,
        aiServiceInitialized: true,
        modelsAvailable: models.length,
        simplePromptTest: {
          success: true,
          response: response.content,
          model: response.model,
          tokensUsed: response.tokensUsed
        },
        analyzePolicyChangesTest: {
          success: true,
          summary: analysisResponse.summary,
          highlights: analysisResponse.highlights,
          riskLevel: analysisResponse.riskLevel
        }
      },
      configuration: {
        defaultModel: DEFAULT_MODEL,
        availableModels: models.map(m => m.id)
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Unexpected error in AI test',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}