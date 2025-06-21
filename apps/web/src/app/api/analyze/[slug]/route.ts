import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StorageClient } from '../../lib/storage'
import { PolicyAnalysisService } from '../../lib/ai-service'
import { ContentExtractor } from '../../../../lib/content-extractor'
import { ANALYSIS_PROMPTS, PROMPT_OPTIMIZATION, selectBestModel } from '../../../../lib/prompts'

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
    
    // Extract clean text from HTML
    const extractedContent = ContentExtractor.extract(content)
    
    if (!extractedContent.text || extractedContent.text.length < 100) {
      return NextResponse.json(
        { error: 'Failed to extract meaningful content from policy' },
        { status: 422 }
      )
    }
    
    // Verify this is actually a privacy policy
    if (!ContentExtractor.isPrivacyPolicy(extractedContent.text)) {
      return NextResponse.json(
        { error: 'Content does not appear to be a privacy policy' },
        { status: 422 }
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
    
    // Generate new analysis with enhanced prompt
    const aiService = new PolicyAnalysisService(OPENROUTER_API_KEY, undefined, DEFAULT_MODEL)
    
    // Create a structured prompt with metadata
    const policyMetadata = [
      `Company: ${slug.charAt(0).toUpperCase() + slug.slice(1)}`,
      extractedContent.title ? `Title: ${extractedContent.title}` : '',
      extractedContent.metadata.lastUpdated ? `Last Updated: ${extractedContent.metadata.lastUpdated}` : '',
      extractedContent.metadata.effectiveDate ? `Effective Date: ${extractedContent.metadata.effectiveDate}` : '',
      `Word Count: ${extractedContent.metadata.wordCount}`,
      `Sections: ${extractedContent.sections.length}`
    ].filter(Boolean).join('\n')
    
    const sectionSummary = extractedContent.sections.slice(0, 10)
      .map(s => `- ${s.title}`)
      .join('\n')
    
    // Use optimized prompt from prompts library
    const prompt = ANALYSIS_PROMPTS.comprehensive(
      policyMetadata,
      sectionSummary,
      extractedContent.text.substring(0, 30000)
    )
    
    // Get available models and select the best one
    const availableModels = aiService.getAvailableModels().map(m => m.id)
    const selectedModel = selectBestModel('comprehensive', availableModels)
    
    // Define fallback models for reliability
    const fallbackModels = PROMPT_OPTIMIZATION.modelRecommendations.comprehensive
      .filter(m => m !== selectedModel && availableModels.includes(m))
    
    const response = await aiService.generateResponse(prompt, {
      model: selectedModel,
      temperature: PROMPT_OPTIMIZATION.temperatures.structured,
      maxTokens: PROMPT_OPTIMIZATION.maxTokens.comprehensive,
      systemPrompt: 'You are a privacy policy expert. Always respond with valid JSON only, no markdown or additional text.',
      fallbackModels
    })
    
    // Parse the JSON response
    let parsedAnalysis
    try {
      // Clean the response in case it has markdown formatting
      const cleanedContent = response.content
        .replace(/^```json\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim()
      
      parsedAnalysis = JSON.parse(cleanedContent)
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError)
      console.error('Raw response:', response.content)
      
      // Fallback to text analysis if JSON parsing fails
      parsedAnalysis = {
        executive_summary: response.content,
        parse_error: true
      }
    }
    
    const analysis = {
      id: crypto.randomUUID(),
      snapshotId: snapshot.id,
      generatedAt: new Date().toISOString(),
      model: DEFAULT_MODEL,
      structured_content: parsedAnalysis,
      raw_content: response.content,
      tokensUsed: response.tokensUsed || 0,
      metadata: {
        wordCount: extractedContent.metadata.wordCount,
        sections: extractedContent.sections.length,
        title: extractedContent.title,
        lastUpdated: extractedContent.metadata.lastUpdated,
        effectiveDate: extractedContent.metadata.effectiveDate
      }
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