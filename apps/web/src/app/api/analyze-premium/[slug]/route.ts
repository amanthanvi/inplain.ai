import { NextRequest, NextResponse } from 'next/server'
import { StorageClient } from '../../lib/storage'
import { getUnifiedAIService } from '@/lib/ai/unified-ai-service'
import type { AnalysisTask } from '@/lib/ai/unified-ai-service'
import { ContentExtractor } from '../../../../lib/content-extractor'
import { WorldClassPromptsLibrary, enhanceAnalysisWithWorldClassPrompts } from '../../../../lib/world-class-prompts'
import { ExpertPromptsLibrary } from '../../../../lib/expert-prompts'
import { getClerkAuth } from '@/lib/auth-clerk'

const storage = new StorageClient()
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export const runtime = 'edge'
export const maxDuration = 300 // 5 minutes for premium analysis

interface PremiumAnalysisRequest {
  analysisType?: 'executive' | 'privacy-champion' | 'risk-assessment' | 'change-analysis' | 'comprehensive'
  userTier?: 'free' | 'premium' | 'enterprise'
  includeExpertPrompts?: boolean
  outputFormat?: 'structured' | 'narrative' | 'both'
  useThinking?: boolean
  useWebSearch?: boolean
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body: PremiumAnalysisRequest = await request.json().catch(() => ({}))
    
    // Check authentication in production (skip in dev with auth bypass)
    let userId: string | null = null
    let actualUserTier: 'free' | 'premium' | 'enterprise' = 'premium'
    
    if (process.env.NODE_ENV === 'production') {
      const auth = await getClerkAuth()
      userId = auth.userId
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      // TODO: Get actual user tier from database
      actualUserTier = 'premium'
    }
    
    const analysisType = body.analysisType || 'comprehensive'
    const userTier = body.userTier || actualUserTier
    const includeExpertPrompts = body.includeExpertPrompts !== false
    const outputFormat = body.outputFormat || 'structured'
    const useThinking = body.useThinking ?? true // Default to true for premium
    const useWebSearch = body.useWebSearch ?? (userTier !== 'free') // Web search for premium/enterprise
    
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
    const cacheKey = `premium-analysis:${snapshot.id}:${analysisType}:${userTier}:enhanced`
    const cachedAnalysis = await storage.getCachedAnalysis(cacheKey)
    
    if (cachedAnalysis) {
      return NextResponse.json({
        analysis: cachedAnalysis,
        cached: true,
        premium: true,
        enhanced: true
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
    
    // Initialize unified AI service
    const aiService = getUnifiedAIService()
    
    // Map analysis types to tasks
    const taskMapping: Record<string, AnalysisTask> = {
      'executive': 'comprehensive',
      'privacy-champion': 'user_impact',
      'risk-assessment': 'risk_assessment',
      'change-analysis': 'differential',
      'comprehensive': 'comprehensive'
    }
    
    const task = taskMapping[analysisType] || 'comprehensive'
    
    // Generate the enhanced analysis
    const response = await aiService.analyze(extractedContent.text, {
      task,
      useTools: true, // Always use tools for premium analysis
      useThinking, // Enable thinking for deeper insights
      useWebSearch, // Enable web search for real-time context
      stream: false, // No streaming for this endpoint
      metadata: {
        company: slug,
        snapshotId: snapshot.id,
        analysisType,
        userTier,
        includeExpertPrompts
      }
    })
    
    // Extract world-class insights if requested
    let worldClassInsights = null
    if (includeExpertPrompts) {
      const worldClassPrompt = WorldClassPromptsLibrary.getPrompt(
        analysisType === 'executive' ? 'executive-summary-genius' :
        analysisType === 'privacy-champion' ? 'privacy-champion' :
        analysisType === 'risk-assessment' ? 'risk-oracle' :
        analysisType === 'change-analysis' ? 'change-detective' :
        'executive-summary-genius'
      )
      
      if (worldClassPrompt && response.content) {
        // Use the AI to extract world-class insights from the analysis
        const insightsResponse = await aiService.analyze(JSON.stringify(response.content), {
          task: 'summary',
          model: 'openai/gpt-4o-mini', // Use fast model for extraction
          useTools: false,
          useThinking: false,
          useWebSearch: false,
          systemPrompt: worldClassPrompt.systemPrompt,
          userPrompt: worldClassPrompt.analysisPrompt
        })
        
        worldClassInsights = {
          promptId: worldClassPrompt.id,
          insights: insightsResponse.content,
          highlights: response.evidence || []
        }
      }
    }
    
    // Create the premium analysis object with enhanced features
    const premiumAnalysis = {
      id: crypto.randomUUID(),
      snapshotId: snapshot.id,
      generatedAt: new Date().toISOString(),
      analysisType,
      userTier,
      model: response.model,
      premium: true,
      enhanced: true,
      structured_content: response.content || {},
      narrative_content: outputFormat === 'narrative' || outputFormat === 'both' ? JSON.stringify(response.content, null, 2) : undefined,
      metadata: {
        tokensUsed: response.tokensUsed.total,
        wordCount: extractedContent.metadata.wordCount,
        sections: extractedContent.sections.length,
        company: slug,
        toolsUsed: response.evidence?.filter(e => e.includes('Tool:')) || [],
        thinkingEnabled: useThinking,
        webSearchEnabled: useWebSearch,
        processingTime: response.processingTime,
        confidence: response.confidence
      },
      insights: {
        executiveSummary: typeof response.content === 'object' && response.content.summary || 'Premium analysis completed',
        topRisks: typeof response.content === 'object' && response.content.risks || [],
        userActions: typeof response.content === 'object' && response.content.recommendations || [],
        competitivePosition: typeof response.content === 'object' && response.content.competitiveAnalysis,
        overallGrade: typeof response.content === 'object' && response.content.riskLevel || 'moderate',
        worldClassInsights
      },
      visualizations: null,
      sources: response.evidence || []
    }
    
    // Cache the premium analysis for 48 hours
    await storage.setCachedAnalysis(cacheKey, premiumAnalysis, 172800)
    
    return NextResponse.json({
      analysis: premiumAnalysis,
      cached: false,
      premium: true,
      enhanced: true,
      features: {
        toolsUsed: (response.evidence?.filter(e => e.includes('Tool:')) || []).length > 0,
        thinkingUsed: useThinking,
        webSearchUsed: useWebSearch && (response.evidence?.length || 0) > 0,
        modelUsed: response.model
      }
    })
  } catch (error) {
    console.error('Premium analysis error:', error)
    
    return NextResponse.json(
      { 
        error: 'Premium analysis failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        premium: true,
        enhanced: true
      },
      { status: 500 }
    )
  }
}