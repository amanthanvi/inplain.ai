import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StorageClient } from '../../lib/storage'
import { getUnifiedAIService, AnalysisTask } from '../../../../lib/ai/unified-ai-service'
import { ModelSelector, UserTier } from '../../../../lib/ai/model-selector'
import { getErrorRecovery } from '../../../../lib/ai/error-recovery'
import { ContentExtractor } from '../../../../lib/content-extractor'
import { getClerkAuth } from '@/lib/auth-clerk'

const storage = new StorageClient()

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    
    // Parse request body if provided
    let requestBody: { model?: string; analysisType?: string; includeRiskScore?: boolean } = {}
    try {
      requestBody = await request.json()
    } catch {
      // Body might be empty, which is fine
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
    
    // Check AI configuration
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
    
    // Get unified AI service and error recovery
    const aiService = getUnifiedAIService()
    const errorRecovery = getErrorRecovery()
    
    // Determine user tier (TODO: Get from actual subscription)
    const userTier: UserTier = 'free' // For now, default to free tier
    
    // Determine analysis task type
    const analysisType = requestBody.analysisType as AnalysisTask || 'comprehensive'
    
    // Select optimal model based on task and user tier
    const { primary: selectedModel, fallbacks, reasoning } = ModelSelector.selectModel({
      task: analysisType,
      contentLength: extractedContent.text.length,
      userTier,
      responseTime: 'balanced',
      requiredFeatures: {
        tools: true, // Enable structured data extraction
        webSearch: false, // Can be enabled for premium users
        streaming: false, // This endpoint doesn't stream
        thinking: true, // Enable free thinking model for deeper analysis
        vision: false
      }
    })
    
    console.log('Model selection reasoning:', reasoning)
    
    // Execute analysis with full error recovery
    const result = await errorRecovery.executeWithRecovery(
      selectedModel.id,
      async () => {
        return await aiService.analyze(extractedContent.text, {
          task: analysisType,
          model: selectedModel.id,
          temperature: 0.3,
          maxTokens: 3000,
          useTools: true,
          useThinking: true, // Enable thinking for all users with free model
          useWebSearch: userTier !== 'free',
          includeConfidence: true,
          includeEvidence: true
        })
      },
      {
        fallbackModels: fallbacks.map(m => m.id),
        priority: 1, // Higher priority for user-initiated requests
        maxRetries: 3
      }
    )
    
    // Extract structured content from result
    const structuredContent = result.content
    
    // Add privacy-specific enhancements
    if (typeof structuredContent === 'object' && !structuredContent.privacy_score) {
      // Calculate privacy score based on analysis
      const privacyScore = calculatePrivacyScore(structuredContent)
      structuredContent.privacy_score = privacyScore
      structuredContent.privacy_grade = getPrivacyGrade(privacyScore)
    }
    
    const analysis = {
      id: crypto.randomUUID(),
      snapshotId: snapshot.id,
      generatedAt: new Date().toISOString(),
      model: result.model,
      structured_content: structuredContent,
      raw_content: JSON.stringify(result.content),
      tokensUsed: result.tokensUsed.total,
      confidence: result.confidence,
      evidence: result.evidence,
      metadata: {
        wordCount: extractedContent.metadata.wordCount,
        sections: extractedContent.sections.length,
        title: extractedContent.title,
        lastUpdated: extractedContent.metadata.lastUpdated,
        effectiveDate: extractedContent.metadata.effectiveDate,
        analysisTask: analysisType,
        processingTime: result.processingTime
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

// Helper function to calculate privacy score
function calculatePrivacyScore(analysis: any): number {
  let score = 100
  
  // Deduct points for concerning practices
  if (analysis.data_sharing?.includes('third parties')) score -= 15
  if (analysis.data_retention === 'indefinite') score -= 20
  if (!analysis.gdpr_compliant) score -= 25
  if (!analysis.user_rights?.includes('deletion')) score -= 15
  if (analysis.cookies_tracking?.third_party_analytics) score -= 10
  
  // Add points for good practices
  if (analysis.security_measures?.includes('encryption')) score += 5
  if (analysis.user_rights?.includes('portability')) score += 5
  if (analysis.transparency_score > 0.8) score += 10
  
  return Math.max(0, Math.min(100, score))
}

// Helper function to get privacy grade
function getPrivacyGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}