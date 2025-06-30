import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StorageClient } from '../../lib/storage'
import { PolicyAnalysisService } from '../../lib/ai-service'
import { SummarySchema } from '@inplain.ai/shared'
import { formatTimestamp } from '@inplain.ai/shared'
import { getEnvVar } from '@/lib/env'
import { getClerkAuth } from '@/lib/auth-clerk'
import { isDevAuthEnabled } from '@/lib/dev-auth'

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
    if (process.env.NODE_ENV === 'production' && !isDevAuthEnabled()) {
      const { userId } = await getClerkAuth()
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }

    if (!OPENROUTER_API_KEY) {
      console.warn('OPENROUTER_API_KEY not configured - returning mock summary for demo')
      
      // Return a mock summary for demo purposes
      const mockSummary = {
        id: crypto.randomUUID(),
        diffId,
        createdAt: formatTimestamp(),
        model: 'demo-mode',
        prompt: 'Mock AI analysis for demonstration',
        summary: 'This is a demonstration summary for Google\'s privacy policy. The privacy policy has been updated with changes to data collection practices and user rights. In production, this would show actual AI-generated analysis of the specific changes.',
        highlights: [
          'Enhanced user data control options',
          'Updated third-party sharing policies',
          'New data retention guidelines',
          'Improved security measures'
        ],
        riskLevel: 'low' as const,
        categories: ['data_collection', 'user_rights', 'security'],
        tokensUsed: 0
      }
      
      return NextResponse.json({
        summary: mockSummary,
        cached: false,
        mockMode: true,
        warning: 'AI service not configured. Set OPENROUTER_API_KEY environment variable for real analysis.'
      }, {
        headers: {
          'Cache-Control': 'private, s-maxage=60',
          'Content-Type': 'application/json',
          'X-Mock-Mode': 'true'
        }
      })
    }
    
    const storageClient = getStorage()
    
    if (!storageClient) {
      console.warn('Storage not configured for Google summary API')
      
      // Check if this is the mock diff ID
      if (diffId === 'f47ac10b-58cc-4372-a567-0e02b2c3d479') {
        const mockSummary = {
          id: crypto.randomUUID(),
          diffId,
          createdAt: formatTimestamp(),
          model: model || DEFAULT_MODEL,
          prompt: 'Mock AI analysis for Google demonstration',
          summary: 'Google has updated its privacy policy with several important changes. The company has enhanced user data control options through a new privacy dashboard, giving users more granular control over their personal information. Third-party data sharing policies have been updated to be more transparent, with clearer explanations of which partners have access to user data. New data retention guidelines limit how long personal information is stored, and improved security measures including encryption at rest have been implemented.',
          highlights: [
            'New privacy dashboard for enhanced user control',
            'Transparent third-party data sharing disclosures',
            '90-day data retention limit for non-essential data',
            'End-to-end encryption for sensitive user data',
            'Simplified one-click opt-out for all marketing'
          ],
          riskLevel: 'low' as const,
          categories: ['data_collection', 'user_rights', 'security', 'third_party_sharing'],
          tokensUsed: 0
        }
        
        return NextResponse.json({
          summary: mockSummary,
          cached: false,
          mockMode: true,
          warning: 'Demo mode: Using mock data. Configure storage for real analysis.'
        }, {
          headers: {
            'Cache-Control': 'private, s-maxage=60',
            'Content-Type': 'application/json',
            'X-Mock-Mode': 'true'
          }
        })
      }
      
      // If not the mock diff ID, return error
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
    const aiService = new PolicyAnalysisService(OPENROUTER_API_KEY)
    
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
    - categories: Array of categories affected
    `
    
    const response = await aiService.generateResponse(summaryPrompt, {
      model: model || DEFAULT_MODEL,
      systemPrompt: 'You are a privacy policy expert. Analyze changes and provide clear summaries.',
      response_format: { type: 'json_object' }
    })
    
    // Parse and validate the response
    const parsedResponse = JSON.parse(response.content)
    const summary = {
      id: crypto.randomUUID(),
      diffId,
      createdAt: formatTimestamp(),
      model: response.model,
      prompt: summaryPrompt,
      summary: parsedResponse.summary || 'No summary generated',
      highlights: parsedResponse.highlights || [],
      riskLevel: parsedResponse.riskLevel || 'medium',
      categories: parsedResponse.categories || [],
      tokensUsed: response.tokensUsed.total
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