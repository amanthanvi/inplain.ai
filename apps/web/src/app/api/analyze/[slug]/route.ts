import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StorageClient } from '../../lib/storage'
import { PolicyAnalysisService } from '../../lib/ai-service'

const storage = new StorageClient()

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const DEFAULT_MODEL = process.env.DEFAULT_AI_MODEL || 'google/gemini-2.0-flash-exp:free'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      )
    }
    
    // Get the latest snapshot
    const snapshots = await storage.getLatestSnapshots(slug, 1)
    
    if (snapshots.length === 0) {
      return NextResponse.json(
        { error: 'No snapshots found for this policy' },
        { status: 404 }
      )
    }
    
    const snapshot = snapshots[0]
    
    if (!snapshot) {
      return NextResponse.json(
        { error: 'No snapshots found for this policy' },
        { status: 404 }
      )
    }
    
    const content = await storage.getSnapshotContent(snapshot.blobKey)
    
    if (!content) {
      return NextResponse.json(
        { error: 'Snapshot content not found' },
        { status: 404 }
      )
    }
    
    // Check if we already have a cached analysis
    const cacheKey = `analysis:${snapshot.id}`
    const cachedAnalysis = await storage.getCachedAnalysis(cacheKey)
    
    if (cachedAnalysis) {
      return NextResponse.json({
        analysis: cachedAnalysis,
        cached: true
      })
    }
    
    // Generate new analysis
    const aiService = new PolicyAnalysisService(OPENROUTER_API_KEY, undefined, DEFAULT_MODEL)
    
    const prompt = `Analyze this privacy policy and provide:
1. A brief executive summary (2-3 sentences)
2. Key highlights (3-5 bullet points)
3. Main categories of data collected
4. User rights mentioned
5. Notable concerns or positives

Policy content:
${content.substring(0, 50000)}` // Limit to 50k chars for cost efficiency
    
    const response = await aiService.generateResponse(prompt, {
      model: DEFAULT_MODEL,
      temperature: 0.3,
      maxTokens: 1000
    })
    
    const analysis = {
      id: crypto.randomUUID(),
      snapshotId: snapshot.id,
      generatedAt: new Date().toISOString(),
      model: DEFAULT_MODEL,
      content: response.content,
      tokensUsed: response.tokensUsed || 0
    }
    
    // Cache the analysis
    await storage.setCachedAnalysis(cacheKey, analysis, 86400) // Cache for 24 hours
    
    return NextResponse.json({
      analysis,
      cached: false
    })
  } catch (error) {
    console.error('Policy analysis error:', error)
    
    return NextResponse.json(
      { error: 'Analysis failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}