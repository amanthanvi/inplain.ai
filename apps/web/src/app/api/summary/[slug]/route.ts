import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StorageClient } from '../../lib/storage'
import { getUnifiedAIService } from '@/lib/ai/unified-ai-service'
import type { AnalysisTask } from '@/lib/ai/unified-ai-service'
import { SummarySchema } from '@inplain.ai/shared'
import { formatTimestamp } from '@inplain.ai/shared'
import { getEnvVar } from '@/lib/env'
import { getClerkAuth } from '@/lib/auth-clerk'
import { isDevAuthEnabled } from '@/lib/dev-auth'
import { withErrorHandler, APIError, checkRateLimit, withAPIMonitoring } from '@/lib/api-error-handler'

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
  model: z.string().optional(),
  analysisType: z.enum(['summary', 'comprehensive', 'differential']).optional().default('differential'),
  useThinking: z.boolean().optional().default(false)
})

const OPENROUTER_API_KEY = getEnvVar('OPENROUTER_API_KEY')

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    
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
    
    // Validate request data
    let diffId, force, model, analysisType, useThinking
    try {
      console.log('Summary API request:', { slug, body })
      const validated = bodySchema.parse(body)
      diffId = validated.diffId
      force = validated.force
      model = validated.model
      analysisType = validated.analysisType
      useThinking = validated.useThinking
      console.log('Validated request:', { diffId, force, model, analysisType, useThinking })
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
    
    // Check authentication (skip if dev auth is enabled)
    let userId: string | null = null
    let userTier: 'free' | 'premium' | 'enterprise' = 'free'
    
    if (!isDevAuthEnabled()) {
      try {
        const auth = await getClerkAuth()
        userId = auth.userId
        if (!userId) {
          return NextResponse.json(
            { error: 'Authentication required', message: 'Please sign in to generate AI summaries' },
            { status: 401 }
          )
        }
        // TODO: Get actual user tier from database
        userTier = 'free'
      } catch (authError) {
        console.error('Auth check failed:', authError)
        // In development, continue without auth if Clerk is not configured
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Auth check failed in development, continuing without auth')
          userId = 'dev-user'
        } else {
          return NextResponse.json(
            { error: 'Authentication failed', message: 'Unable to verify authentication' },
            { status: 401 }
          )
        }
      }
    } else {
      userId = 'dev-user'
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
    
    // Get storage client
    const storageClient = getStorage()
    
    // If storage is not configured, return error
    if (!storageClient) {
      return NextResponse.json(
        { 
          error: 'Storage service not configured',
          message: 'Cannot generate summaries without storage. Please configure KV_REST_API_URL and KV_REST_API_TOKEN.',
          code: 'STORAGE_NOT_CONFIGURED'
        },
        { status: 503 }
      )
    }

    const diff = await storageClient.getDiff(slug, diffId)
    if (!diff) {
      return NextResponse.json(
        { error: 'Diff not found' },
        { status: 404 }
      )
    }

    if (diff.summaryId && !force) {
      const existingSummary = await storageClient.getSummary(diff.summaryId)
      if (existingSummary) {
        return NextResponse.json({
          summary: existingSummary,
          cached: true
        })
      }
    }

    const diffContent = await storageClient.getDiffContent(diff.diffBlobKey)
    if (!diffContent) {
      return NextResponse.json(
        { error: 'Diff content not found' },
        { status: 404 }
      )
    }

    // Try to get the original snapshot content for better analysis
    let oldContent: string | undefined
    let newContent: string | undefined

    try {
      const [fromSnapshot, toSnapshot] = await Promise.all([
        storageClient.getSnapshot(slug, diff.fromSnapshotId),
        storageClient.getSnapshot(slug, diff.toSnapshotId)
      ])

      if (fromSnapshot && toSnapshot) {
        const [fromContent, toContent] = await Promise.all([
          storageClient.getSnapshotContent(fromSnapshot.blobKey),
          storageClient.getSnapshotContent(toSnapshot.blobKey)
        ])
        
        oldContent = fromContent || undefined
        newContent = toContent || undefined
      }
    } catch (error) {
      console.warn('Failed to fetch snapshot content for enhanced analysis:', error)
      // Continue with diff-only analysis
    }

    // Initialize unified AI service
    const aiService = getUnifiedAIService()
    
    // Prepare content for analysis
    const analysisContent = newContent || `
## Policy Change Summary

**Change Type**: ${diff.changeType}
**Total Changes**: ${diff.changeCount}
**Additions**: ${diff.additions}
**Deletions**: ${diff.deletions}

### Changes:
${diffContent.htmlDiff || 'No diff content available'}

${oldContent ? `\n### Previous Version:\n${oldContent.substring(0, 5000)}...` : ''}
${newContent ? `\n### Current Version:\n${newContent.substring(0, 5000)}...` : ''}
    `.trim()
    
    // Generate analysis using enhanced AI service
    let analysis
    try {
      console.log('Generating enhanced analysis for diff:', {
        diffId,
        slug,
        additions: diff.additions,
        deletions: diff.deletions,
        changeCount: diff.changeCount,
        changeType: diff.changeType,
        hasOldContent: !!oldContent,
        hasNewContent: !!newContent,
        htmlDiffLength: diffContent.htmlDiff?.length || 0,
        analysisType,
        useThinking
      })
      
      // Use the enhanced AI service with advanced features
      const result = await aiService.analyze(analysisContent, {
        task: analysisType as AnalysisTask,
        model: model,
        useTools: true, // Enable structured extraction
        useThinking: useThinking || (userTier !== 'free'), // Enable thinking for premium users
        useWebSearch: false, // Don't use web search for summaries
        metadata: {
          slug,
          diffId,
          changeType: diff.changeType,
          changeCount: diff.changeCount
        }
      })
      
      console.log('Enhanced analysis generated successfully:', {
        model: result.model,
        tokensUsed: result.tokensUsed.total,
        contentLength: JSON.stringify(result.content || {}).length,
        evidenceCount: result.evidence?.length || 0,
        confidence: result.confidence
      })
      
      // Extract analysis results from unified AI service response
      const content = result.content || {}
      analysis = {
        model: result.model,
        summary: typeof content === 'object' && content.summary || 'Unable to generate summary',
        highlights: result.evidence || [],
        riskLevel: typeof content === 'object' && content.riskAssessment?.overallRisk || 'unknown',
        categories: typeof content === 'object' && content.dataCollected || [],
        tokensUsed: result.tokensUsed.total
      }
    } catch (analysisError) {
      console.error('AI analysis failed:', analysisError)
      throw new Error(`AI analysis failed: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`)
    }
    
    const summary = {
      id: crypto.randomUUID(),
      diffId,
      createdAt: formatTimestamp(),
      model: analysis.model,
      prompt: 'AI-generated policy analysis using enhanced service',
      summary: analysis.summary,
      highlights: analysis.highlights,
      riskLevel: analysis.riskLevel,
      categories: analysis.categories,
      tokensUsed: analysis.tokensUsed,
      cached: false
    }
    
    // Validate the summary matches the schema
    const validatedSummary = SummarySchema.parse(summary)

    await storageClient.saveSummary(validatedSummary)
    
    diff.summaryId = validatedSummary.id
    await storageClient.saveDiff(diff)

    return NextResponse.json({
      summary: validatedSummary,
      cached: false,
      enhancedAnalysis: true
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=3600',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Summary generation error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }
    
    // Provide more detailed error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isStorageError = errorMessage.includes('KV') || errorMessage.includes('storage') || errorMessage.includes('kv.')
    const isAIError = errorMessage.includes('AI') || errorMessage.includes('OpenRouter') || errorMessage.includes('analysis')
    
    return NextResponse.json(
      { 
        error: 'Summary generation failed',
        message: isStorageError 
          ? 'Storage service error. Please check KV_REST_API_URL and KV_REST_API_TOKEN configuration.'
          : isAIError
          ? 'AI service error. Please check OPENROUTER_API_KEY configuration.'
          : errorMessage,
        code: isStorageError ? 'STORAGE_ERROR' : isAIError ? 'AI_SERVICE_ERROR' : 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}