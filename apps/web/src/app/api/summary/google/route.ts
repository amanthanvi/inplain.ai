import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StorageClient } from '../../lib/storage'
import { getUnifiedAIService } from '@/lib/ai/unified-ai-service'
import { SummarySchema } from '@inplain.ai/shared'
import { formatTimestamp } from '@inplain.ai/shared'
import { getEnvVar } from '@/lib/env'
import { getClerkAuth } from '@/lib/auth-clerk'

// Initialize storage with error handling
let storage: StorageClient | null = null

function getStorage(): StorageClient | null {
  if (storage) return storage
  
  // Check if KV is configured
  const kvUrl = getEnvVar('KV_REST_API_URL')
  const kvToken = getEnvVar('KV_REST_API_TOKEN')
  
  if (!kvUrl || !kvToken) {
    console.warn('KV storage not configured - summary API will operate in limited mode')
    return null
  }
  
  try {
    storage = new StorageClient()
    return storage
  } catch (error) {
    console.error('Failed to initialize storage client:', error)
    return null
  }
}

const bodySchema = z.object({
  diffId: z.string().uuid(),
  force: z.boolean().optional(),
  model: z.string().optional()
})

const OPENROUTER_API_KEY = getEnvVar('OPENROUTER_API_KEY')
const DEFAULT_MODEL = getEnvVar('DEFAULT_AI_MODEL', 'google/gemini-2.5-flash-preview-05-20')

export async function POST(request: NextRequest) {
  try {
    const slug = 'google' // Hardcoded for this specific route
    
    // Parse request body with better error handling
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json(
        { error: 'Invalid request data', message: 'Request body must be valid JSON' },
        { status: 400 }
      )
    }
    
    console.log('Google summary API request:', body)
    
    let diffId, force, model
    try {
      const validated = bodySchema.parse(body)
      diffId = validated.diffId
      force = validated.force
      model = validated.model
    } catch (validationError) {
      console.error('Request validation failed:', validationError)
      console.error('Received body:', body)
      if (validationError instanceof z.ZodError) {
        const errors = validationError.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
        return NextResponse.json(
          { 
            error: 'Invalid request data', 
            message: 'Request validation failed',
            details: errors,
            received: body
          },
          { status: 400 }
        )
      }
      throw validationError
    }
    
    // Check authentication in production (skip in dev with auth bypass)
    if (process.env.NODE_ENV === 'production') {
      const { userId } = await getClerkAuth()
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        {
          error: 'AI service not configured',
          message: 'Please configure OPENROUTER_API_KEY in your environment variables',
          documentation: 'https://docs.inplain.ai/configuration'
        },
        { status: 503 }
      )
    }
    
    const storageClient = getStorage()
    
    if (!storageClient) {
      return NextResponse.json({
        error: 'Storage not configured',
        message: 'Cannot generate summaries without storage. Please configure Vercel KV.',
        code: 'STORAGE_NOT_CONFIGURED'
      }, { status: 503 })
    }
    
    // Check if we already have a summary for this diff
    if (!force) {
      const cacheKey = `summary:${diffId}`
      const cachedSummary = await storageClient.getCachedAnalysis(cacheKey)
      
      if (cachedSummary) {
        return NextResponse.json({
          summary: cachedSummary,
          cached: true
        })
      }
    }
    
    // Get the diff
    const diff = await storageClient.getDiff(slug, diffId)
    
    if (!diff) {
      return NextResponse.json(
        { error: 'Diff not found' },
        { status: 404 }
      )
    }
    
    // Initialize AI service
    const aiService = getUnifiedAIService()
    
    // Generate the summary
    const summaryPrompt = `Analyze this privacy policy diff and provide a summary:
    
    Company: ${slug}
    Created on: ${diff.createdAt}
    Change Type: ${diff.changeType}
    Additions: ${diff.additions}
    Deletions: ${diff.deletions}
    Total Changes: ${diff.changeCount}
    
    Provide a JSON response with:
    - summary: A clear explanation of what changed
    - highlights: Array of key changes (max 5)
    - riskLevel: "low", "medium", or "high"
    - categories: Array of categories affected. Use ONLY these exact values: data_collection, data_sharing, data_retention, user_rights, security, cookies, third_parties, children, other
    `
    
    const result = await aiService.analyze(summaryPrompt, {
      model: model || DEFAULT_MODEL,
      task: 'differential',
      useTools: true
    })
    
    // Parse and validate the response
    const parsedResponse = typeof result.content === 'object' ? result.content : JSON.parse(result.content)
    
    // Normalize categories to match enum values
    const normalizeCategory = (category: string): string => {
      // Convert to lowercase and replace spaces with underscores
      const normalized = category.toLowerCase().replace(/\s+/g, '_')
      
      // Map common variations to correct enum values
      const categoryMap: Record<string, string> = {
        'data_collection': 'data_collection',
        'data_sharing': 'data_sharing',
        'data_retention': 'data_retention',
        'user_rights': 'user_rights',
        'security': 'security',
        'cookies': 'cookies',
        'third_parties': 'third_parties',
        'third_party': 'third_parties',
        'third_party_sharing': 'data_sharing',
        'children': 'children',
        'childrens_privacy': 'children',
        'other': 'other'
      }
      
      return categoryMap[normalized] || 'other'
    }
    
    const summary = {
      id: crypto.randomUUID(),
      diffId,
      createdAt: formatTimestamp(),
      model: result.model,
      prompt: summaryPrompt,
      summary: parsedResponse.summary || 'No summary generated',
      highlights: parsedResponse.highlights || [],
      riskLevel: parsedResponse.riskLevel || 'medium',
      categories: (parsedResponse.categories || []).map(normalizeCategory),
      tokensUsed: result.tokensUsed.total
    }
    
    const validatedSummary = SummarySchema.parse(summary)
    
    // Cache the summary
    const cacheKey = `summary:${diffId}`
    await storageClient.setCachedAnalysis(cacheKey, validatedSummary, 86400) // 24 hours
    
    return NextResponse.json({
      summary: validatedSummary,
      cached: false
    })
  } catch (error) {
    console.error('Summary generation error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Summary generation failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}