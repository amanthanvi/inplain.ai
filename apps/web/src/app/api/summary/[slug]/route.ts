import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StorageClient } from '../../lib/storage'
import { PolicyAnalysisService } from '../../lib/ai-service'
import { SummarySchema } from '@policydiff/shared'
import { formatTimestamp } from '@policydiff/shared'

const storage = new StorageClient()

const bodySchema = z.object({
  diffId: z.string().uuid(),
  force: z.boolean().optional(),
  model: z.string().optional()
})

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const DEFAULT_MODEL = process.env.DEFAULT_AI_MODEL || 'anthropic/claude-3.5-sonnet'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { diffId, force, model } = bodySchema.parse(body)

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      )
    }

    const diff = await storage.getDiff(slug, diffId)
    if (!diff) {
      return NextResponse.json(
        { error: 'Diff not found' },
        { status: 404 }
      )
    }

    if (diff.summaryId && !force) {
      const existingSummary = await storage.getSummary(diff.summaryId)
      if (existingSummary) {
        return NextResponse.json({
          summary: existingSummary,
          cached: true
        })
      }
    }

    const diffContent = await storage.getDiffContent(diff.diffBlobKey)
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
        storage.getSnapshot(slug, diff.fromSnapshotId),
        storage.getSnapshot(slug, diff.toSnapshotId)
      ])

      if (fromSnapshot && toSnapshot) {
        const [fromContent, toContent] = await Promise.all([
          storage.getSnapshotContent(fromSnapshot.blobKey),
          storage.getSnapshotContent(toSnapshot.blobKey)
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

    await storage.saveSummary(summary)
    
    diff.summaryId = summary.id
    await storage.saveDiff(diff)

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
    
    return NextResponse.json(
      { error: 'AI analysis failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}