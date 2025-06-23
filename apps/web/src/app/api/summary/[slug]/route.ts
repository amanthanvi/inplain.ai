import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StorageClient } from '../../lib/storage'
import { PolicyAnalysisService } from '../../lib/ai-service'
import { SummarySchema } from '@policydiff/shared'
import { formatTimestamp } from '@policydiff/shared'
import { getEnvVar } from '@/lib/env'
import { AuthService } from '@/lib/auth'
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { diffId, force, model } = bodySchema.parse(body)
    
    // Check authentication in production (skip in dev with auth bypass)
    if (process.env.NODE_ENV === 'production' && !isDevAuthEnabled()) {
      const user = await AuthService.getCurrentUser()
      if (!user) {
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
        summary: 'This is a demonstration summary. The privacy policy has been updated with changes to data collection practices and user rights. In production, this would show actual AI-generated analysis of the specific changes.',
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
    
    // Get storage client
    const storageClient = getStorage()
    
    // If storage is not configured, we can't fetch diffs
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

    // Initialize AI service
    const aiService = new PolicyAnalysisService(OPENROUTER_API_KEY, undefined, model || DEFAULT_MODEL)
    
    // Generate analysis with original content when available
    let analysis
    try {
      console.log('Generating analysis for diff:', {
        diffId,
        slug,
        additions: diff.additions,
        deletions: diff.deletions,
        changeCount: diff.changeCount,
        changeType: diff.changeType,
        hasOldContent: !!oldContent,
        hasNewContent: !!newContent,
        htmlDiffLength: diffContent.htmlDiff?.length || 0
      })
      
      analysis = await aiService.analyzePolicyChanges({
        additions: diff.additions,
        deletions: diff.deletions,
        changeCount: diff.changeCount,
        changeType: diff.changeType,
        htmlDiff: diffContent.htmlDiff,
        oldContent,
        newContent
      }, { model: model || DEFAULT_MODEL })
      
      console.log('Analysis generated successfully:', {
        model: analysis.model,
        tokensUsed: analysis.tokensUsed,
        summaryLength: analysis.summary?.length || 0,
        highlightsCount: analysis.highlights?.length || 0
      })
    } catch (analysisError) {
      console.error('AI analysis failed:', analysisError)
      throw new Error(`AI analysis failed: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`)
    }
    
    const summary = SummarySchema.parse({
      id: crypto.randomUUID(),
      diffId,
      createdAt: formatTimestamp(),
      model: analysis.model,
      prompt: 'AI-generated policy analysis',
      summary: analysis.summary,
      highlights: analysis.highlights,
      riskLevel: analysis.riskLevel,
      categories: analysis.categories,
      tokensUsed: analysis.tokensUsed,
      cached: false
    })

    await storageClient.saveSummary(summary)
    
    diff.summaryId = summary.id
    await storageClient.saveDiff(diff)

    return NextResponse.json({
      summary,
      cached: false
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