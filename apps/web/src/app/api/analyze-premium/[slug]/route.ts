import { NextRequest, NextResponse } from 'next/server'
import { StorageClient } from '../../lib/storage'
import { PolicyAnalysisService } from '../../lib/ai-service'
import { ContentExtractor } from '../../../../lib/content-extractor'
import { PROMPT_OPTIMIZATION } from '../../../../lib/prompts'
import { WorldClassPromptsLibrary, enhanceAnalysisWithWorldClassPrompts } from '../../../../lib/world-class-prompts'
import { ExpertPromptsLibrary } from '../../../../lib/expert-prompts'
import { getClerkAuth } from '@/lib/auth-clerk'
import { isDevAuthEnabled } from '@/lib/dev-auth'

const storage = new StorageClient()
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export const runtime = 'edge'
export const maxDuration = 300 // 5 minutes for premium analysis

interface PremiumAnalysisRequest {
  analysisType?: 'executive' | 'privacy-champion' | 'risk-assessment' | 'change-analysis' | 'comprehensive'
  userTier?: 'free' | 'premium' | 'enterprise'
  includeExpertPrompts?: boolean
  outputFormat?: 'structured' | 'narrative' | 'both'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body: PremiumAnalysisRequest = await request.json().catch(() => ({}))
    
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
    
    const analysisType = body.analysisType || 'comprehensive'
    const userTier = body.userTier || 'premium'
    const includeExpertPrompts = body.includeExpertPrompts !== false
    const outputFormat = body.outputFormat || 'structured'
    
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured. Please set up your OpenRouter API key.' },
        { status: 503 }
      )
    }
    
    // Get the latest snapshot
    const snapshots = await storage.getLatestSnapshots(slug, 1)
    if (snapshots.length === 0) {
      return NextResponse.json(
        { error: `No privacy policy found for ${slug}` },
        { status: 404 }
      )
    }
    
    const snapshot = snapshots[0]
    if (!snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      )
    }
    
    // Check premium cache
    const cacheKey = `premium-analysis:${snapshot.id}:${analysisType}:${userTier}`
    const cachedAnalysis = await storage.getCachedAnalysis(cacheKey)
    
    if (cachedAnalysis) {
      return NextResponse.json({
        analysis: cachedAnalysis,
        cached: true,
        premium: true
      })
    }
    
    // Get and extract content
    const content = await storage.getSnapshotContent(snapshot.blobKey)
    if (!content) {
      return NextResponse.json(
        { error: 'Failed to retrieve policy content' },
        { status: 500 }
      )
    }
    
    const extractedContent = ContentExtractor.extract(content)
    if (!extractedContent.text || extractedContent.text.length < 100) {
      return NextResponse.json(
        { error: 'Failed to extract meaningful content from policy' },
        { status: 422 }
      )
    }
    
    // Initialize AI service
    const aiService = new PolicyAnalysisService(OPENROUTER_API_KEY)
    
    // Prepare analysis based on type
    let worldClassPrompt, expertPrompt, combinedSystemPrompt, analysisPrompt
    
    switch (analysisType) {
      case 'executive':
        worldClassPrompt = WorldClassPromptsLibrary.getPrompt('executive-summary-genius')
        expertPrompt = includeExpertPrompts ? ExpertPromptsLibrary.getPrompt('competitive-benchmark') : null
        break
        
      case 'privacy-champion':
        worldClassPrompt = WorldClassPromptsLibrary.getPrompt('privacy-champion')
        expertPrompt = includeExpertPrompts ? ExpertPromptsLibrary.getPrompt('consumer-friendly-analysis') : null
        break
        
      case 'risk-assessment':
        worldClassPrompt = WorldClassPromptsLibrary.getPrompt('risk-oracle')
        expertPrompt = includeExpertPrompts ? ExpertPromptsLibrary.getPrompt('security-architecture-review') : null
        break
        
      case 'change-analysis':
        worldClassPrompt = WorldClassPromptsLibrary.getPrompt('change-detective')
        // For change analysis, we'd need previous version - for now, analyze current
        break
        
      case 'comprehensive':
      default:
        // Combine multiple perspectives for comprehensive analysis
        const executiveSummary = WorldClassPromptsLibrary.getPrompt('executive-summary-genius')
        const privacyChampion = WorldClassPromptsLibrary.getPrompt('privacy-champion')
        const riskOracle = WorldClassPromptsLibrary.getPrompt('risk-oracle')
        
        combinedSystemPrompt = [
          executiveSummary?.systemPrompt,
          privacyChampion?.systemPrompt,
          riskOracle?.systemPrompt
        ].filter(Boolean).join('\n\n---\n\n')
        
        analysisPrompt = `Provide a comprehensive premium analysis combining multiple expert perspectives:

## Executive Summary
${executiveSummary?.analysisPrompt}

## Privacy Champion Analysis
${privacyChampion?.analysisPrompt}

## Risk Assessment
${riskOracle?.analysisPrompt}

Analyze the following privacy policy:
${extractedContent.text.substring(0, 50000)}`
        break
    }
    
    // Build the final prompt
    if (!combinedSystemPrompt && worldClassPrompt) {
      combinedSystemPrompt = worldClassPrompt.systemPrompt
      if (expertPrompt) {
        combinedSystemPrompt += `\n\n---\n\n${expertPrompt.systemPrompt || ''}`
      }
    }
    
    if (!analysisPrompt && worldClassPrompt) {
      analysisPrompt = worldClassPrompt.analysisPrompt
      if (expertPrompt) {
        analysisPrompt += `\n\n---\n\nAdditional Expert Analysis:\n${expertPrompt.prompt}`
      }
      analysisPrompt += `\n\nPrivacy Policy Content:\n${extractedContent.text.substring(0, 50000)}`
    }
    
    // Select optimal model based on analysis type and length
    const modelPreferences = worldClassPrompt?.modelPreferences || [
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4-turbo',
      'google/gemini-2.0-flash'
    ]
    
    const availableModels = aiService.getAvailableModels().map(m => m.id)
    const selectedModel = modelPreferences.find(m => availableModels.includes(m)) || availableModels[0]
    
    // Generate the analysis
    const response = await aiService.generateResponse(analysisPrompt || '', {
      model: selectedModel,
      temperature: worldClassPrompt?.temperature || 0.3,
      maxTokens: worldClassPrompt?.maxTokens || 4000,
      systemPrompt: combinedSystemPrompt,
      response_format: outputFormat === 'structured' ? { type: 'json_object' } : undefined
    })
    
    // Parse response based on format
    let structuredContent, narrativeContent
    
    if (outputFormat === 'structured' || outputFormat === 'both') {
      try {
        const cleanedContent = response.content
          .replace(/^```json\n?/i, '')
          .replace(/\n?```$/i, '')
          .trim()
        structuredContent = JSON.parse(cleanedContent)
      } catch (e) {
        console.error('Failed to parse structured response:', e)
        structuredContent = { error: 'Failed to parse structured response', raw: response.content }
      }
    }
    
    if (outputFormat === 'narrative' || outputFormat === 'both') {
      narrativeContent = response.content
    }
    
    // Create the premium analysis object
    const premiumAnalysis = {
      id: crypto.randomUUID(),
      snapshotId: snapshot.id,
      generatedAt: new Date().toISOString(),
      analysisType,
      userTier,
      model: selectedModel,
      premium: true,
      structured_content: structuredContent,
      narrative_content: narrativeContent,
      metadata: {
        worldClassPrompt: worldClassPrompt?.id,
        expertPrompt: expertPrompt?.id,
        tokensUsed: response.tokensUsed,
        wordCount: extractedContent.metadata.wordCount,
        sections: extractedContent.sections.length,
        company: slug
      },
      insights: {
        executiveSummary: structuredContent?.executiveSummary || structuredContent?.investigation?.headline,
        topRisks: structuredContent?.regulatoryRisk || structuredContent?.alerts?.critical,
        userActions: structuredContent?.actionPlan || structuredContent?.defense?.minimum,
        competitivePosition: structuredContent?.metricsSnapshot?.competitivePosition,
        overallGrade: structuredContent?.reportCard?.overallGrade || structuredContent?.metricsSnapshot?.overallGrade
      }
    }
    
    // Cache the premium analysis for 48 hours
    await storage.setCachedAnalysis(cacheKey, premiumAnalysis, 172800)
    
    return NextResponse.json({
      analysis: premiumAnalysis,
      cached: false,
      premium: true
    })
  } catch (error) {
    console.error('Premium analysis error:', error)
    
    return NextResponse.json(
      { 
        error: 'Premium analysis failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        premium: true 
      },
      { status: 500 }
    )
  }
}