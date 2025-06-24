import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StorageClient } from '../../../lib/storage'
import { PolicyAnalysisService } from '../../../lib/ai-service'
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
    const body = await request.json()
    const { diffId, force, model } = bodySchema.parse(body)
    
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
      // Even without storage, we can return a mock summary
      const mockSummary = {
        id: crypto.randomUUID(),
        diffId,
        createdAt: formatTimestamp(),
        model: model || DEFAULT_MODEL,
        prompt: 'Analysis without storage access',
        summary: 'Storage is not configured. Please configure Vercel KV storage for full functionality.',
        highlights: ['Storage configuration required'],
        riskLevel: 'unknown' as const,
        categories: [],
        tokensUsed: 0
      }
      
      return NextResponse.json({
        summary: mockSummary,
        cached: false,
        storageError: true
      })
    }
    
    // Check if we already have a summary for this diff
    if (!force) {
      const cacheKey = `summary:${diffId}`
      const cachedSummary = await storageClient.getCachedSummary(cacheKey)
      
      if (cachedSummary) {
        return NextResponse.json({
          summary: cachedSummary,
          cached: true
        })
      }
    }
    
    // Get the diff
    const diff = await storageClient.getDiff(diffId)
    
    if (!diff) {
      return NextResponse.json(
        { error: 'Diff not found' },
        { status: 404 }
      )
    }
    
    // Initialize AI service
    const aiService = new PolicyAnalysisService(OPENROUTER_API_KEY)
    
    // Generate the summary
    const summary = await aiService.generateSummary(diff, model || DEFAULT_MODEL)
    
    // Validate the summary
    const validatedSummary = SummarySchema.parse(summary)
    
    // Cache the summary
    const cacheKey = `summary:${diffId}`
    await storageClient.setCachedSummary(cacheKey, validatedSummary, 86400) // 24 hours
    
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