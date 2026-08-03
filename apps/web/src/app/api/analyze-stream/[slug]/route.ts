import { NextRequest, NextResponse } from 'next/server'
import { StorageClient } from '../../lib/storage'
import { ContentExtractor } from '../../../../lib/content-extractor'
import { getUnifiedAIService, AnalysisTask } from '../../../../lib/ai/unified-ai-service'
import { ModelSelector, UserTier } from '../../../../lib/ai/model-selector'
// Mock AI service removed - no more demo mode fallbacks
import { getClerkAuth } from '@/lib/auth-clerk'

const storage = new StorageClient()

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    
    // Parse request body
    let requestBody: { analysisType?: string; model?: string; userTier?: string } = {}
    try {
      requestBody = await request.json()
    } catch {
      // Body might be empty
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
      return new Response(
        JSON.stringify({ error: 'No snapshots found for this policy' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    const snapshot = snapshots[0]
    
    if (!snapshot) {
      return new Response(
        JSON.stringify({ error: 'No snapshots found for this policy' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Check if we already have a cached analysis
    const cacheKey = `analysis:${snapshot.id}:${requestBody.analysisType || 'comprehensive'}`
    const cachedAnalysis = await storage.getCachedAnalysis(cacheKey)
    
    if (cachedAnalysis) {
      return new Response(
        JSON.stringify({
          analysis: cachedAnalysis,
          cached: true
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    const content = await storage.getSnapshotContent(snapshot.blobKey)
    
    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Snapshot content not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Extract clean text from HTML
    const extractedContent = ContentExtractor.extract(content)
    
    if (!extractedContent.text || extractedContent.text.length < 100) {
      return new Response(
        JSON.stringify({ error: 'Failed to extract meaningful content from policy' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Verify this is actually a privacy policy
    if (!ContentExtractor.isPrivacyPolicy(extractedContent.text)) {
      return new Response(
        JSON.stringify({ error: 'Content does not appear to be a privacy policy' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Get unified AI service
    const aiService = getUnifiedAIService()
    
    // Determine user tier and analysis type
    const userTier = (requestBody.userTier as UserTier) || 'free'
    const analysisType = (requestBody.analysisType as AnalysisTask) || 'comprehensive'
    
    // Select optimal streaming model
    const { primary: selectedModel, fallbacks } = ModelSelector.selectModel({
      task: analysisType,
      contentLength: extractedContent.text.length,
      userTier,
      responseTime: 'balanced',
      requiredFeatures: {
        streaming: true, // Must support streaming
        tools: true,
        webSearch: userTier !== 'free',
        thinking: true, // Enable free thinking model for deeper analysis
        vision: false
      }
    })
    
    // Set up streaming response
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({
            type: 'metadata',
            model: selectedModel.id,
            snapshotId: snapshot.id,
            wordCount: extractedContent.metadata.wordCount,
            analysisType,
            confidence: 'calculating...'
          }) + '\n\n'))
          
          // Create async generator for streaming
          const analysisStream = aiService.streamAnalysis(extractedContent.text, {
            task: analysisType,
            model: requestBody.model || selectedModel.id,
            temperature: 0.3,
            maxTokens: 3000,
            useTools: true,
            useThinking: true, // Enable thinking for all users with free model
            useWebSearch: userTier !== 'free',
            includeConfidence: true,
            includeEvidence: true
          })
          
          let fullAnalysis: any = null
          
          // Process the stream
          for await (const update of analysisStream) {
            switch (update.type) {
              case 'progress':
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'progress',
                  status: update.data.status,
                  progress: update.data.progress
                })}\n\n`))
                break
                
              case 'content':
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'content',
                  content: update.data.partial || update.data,
                  progress: update.data.progress
                })}\n\n`))
                break
                
              case 'complete':
                fullAnalysis = update.data
                
                // Save to cache
                const analysis = {
                  id: crypto.randomUUID(),
                  snapshotId: snapshot.id,
                  generatedAt: new Date().toISOString(),
                  model: fullAnalysis.model,
                  structured_content: fullAnalysis.content,
                  raw_content: JSON.stringify(fullAnalysis.content),
                  confidence: fullAnalysis.confidence,
                  evidence: fullAnalysis.evidence,
                  metadata: {
                    wordCount: extractedContent.metadata.wordCount,
                    sections: extractedContent.sections.length,
                    title: extractedContent.title,
                    lastUpdated: extractedContent.metadata.lastUpdated,
                    effectiveDate: extractedContent.metadata.effectiveDate,
                    analysisTask: analysisType,
                    processingTime: fullAnalysis.processingTime
                  }
                }
                
                await storage.setCachedAnalysis(cacheKey, analysis, 86400)
                
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'complete',
                  analysis
                })}\n\n`))
                break
            }
          }
          
          // Close the stream
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          
        } catch (error) {
          console.error('Streaming error:', error)
          
          // Try fallback models if available
          let fallbackError = error
          for (const fallbackModel of fallbacks) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'fallback',
                message: `Trying fallback model: ${fallbackModel.name}`,
                model: fallbackModel.id
              })}\n\n`))
              
              // Attempt with fallback (simplified for now)
              const result = await aiService.analyze(extractedContent.text, {
                task: analysisType,
                model: fallbackModel.id,
                temperature: 0.3,
                maxTokens: 3000,
                useTools: true,
                stream: false // Fallback to non-streaming
              })
              
              const analysis = {
                id: crypto.randomUUID(),
                snapshotId: snapshot.id,
                generatedAt: new Date().toISOString(),
                model: result.model,
                structured_content: result.content,
                raw_content: JSON.stringify(result.content),
                confidence: result.confidence,
                evidence: result.evidence,
                metadata: {
                  wordCount: extractedContent.metadata.wordCount,
                  sections: extractedContent.sections.length,
                  title: extractedContent.title,
                  analysisTask: analysisType,
                  processingTime: result.processingTime,
                  fallback: true
                }
              }
              
              await storage.setCachedAnalysis(cacheKey, analysis, 86400)
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'complete',
                analysis,
                fallback: true
              })}\n\n`))
              
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
              
            } catch (fbError) {
              fallbackError = fbError
              console.error(`Fallback model ${fallbackModel.id} failed:`, fbError)
            }
          }
          
          // All models failed
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: fallbackError instanceof Error ? fallbackError.message : 'Analysis failed'
          })}\n\n`))
          controller.close()
        }
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable nginx buffering
      }
    })
  } catch (error) {
    console.error('Policy analysis stream error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Analysis failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
}