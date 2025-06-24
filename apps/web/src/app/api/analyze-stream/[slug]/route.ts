import { NextRequest } from 'next/server'
import { StorageClient } from '../../lib/storage'
import { ContentExtractor } from '../../../../lib/content-extractor'
import { ANALYSIS_PROMPTS, PROMPT_OPTIMIZATION, SYSTEM_PROMPTS, selectBestModel } from '../../../../lib/prompts'
import { enhanceAnalysisWithWorldClassPrompts } from '../../../../lib/world-class-prompts'
import { MockAIService } from '../../../../lib/mock-ai-service'

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
      console.warn('OPENROUTER_API_KEY not configured - using mock AI service for demo')
      
      // Use mock service for demo purposes
      const mockService = new MockAIService()
      const stream = mockService.getStreamingResponse()
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Mock-Mode': 'true'
        }
      })
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
    const cacheKey = `analysis:${snapshot.id}`
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
    
    // Create structured prompt
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
    
    // Select best streaming model
    const streamingModels = PROMPT_OPTIMIZATION.modelRecommendations.streaming
    const selectedModel = streamingModels.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : streamingModels[0]

    // Set up streaming response
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({
            type: 'metadata',
            model: DEFAULT_MODEL,
            snapshotId: snapshot.id,
            wordCount: extractedContent.metadata.wordCount
          }) + '\n\n'))
          
          // Make streaming request to OpenRouter
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://inplain.ai',
              'X-Title': 'Inplain.AI'
            },
            body: JSON.stringify({
              model: selectedModel,
              messages: [
                { 
                  role: 'system', 
                  content: SYSTEM_PROMPTS.privacyAnalyst + '\n\nIMPORTANT: Always respond with valid JSON only, no markdown or additional text.' 
                },
                { role: 'user', content: prompt }
              ],
              max_tokens: PROMPT_OPTIMIZATION.maxTokens.streaming,
              temperature: PROMPT_OPTIMIZATION.temperatures.structured,
              stream: true
            })
          })
          
          if (!response.ok) {
            let errorMessage = `AI API error (${response.status})`
            try {
              const errorText = await response.text()
              const errorJson = JSON.parse(errorText)
              errorMessage = errorJson.error?.message || errorJson.message || errorText
            } catch {
              errorMessage = `AI API error: ${response.status} ${response.statusText}`
            }
            
            console.error('OpenRouter API error:', {
              status: response.status,
              message: errorMessage,
              model: selectedModel
            })
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: errorMessage
            })}\n\n`))
            controller.close()
            return
          }
          
          if (!response.body) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: 'No response body from AI service'
            })}\n\n`))
            controller.close()
            return
          }
          
          const reader = response.body.getReader()
          let fullContent = ''
          
          try {
            while (true) {
              const { done, value } = await reader.read()
              
              if (done) break
              
              const chunk = decoder.decode(value)
              const lines = chunk.split('\n')
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  
                  if (data === '[DONE]') {
                    // Parse and validate the full response
                    try {
                      const cleanedContent = fullContent
                        .replace(/^```json\n?/i, '')
                        .replace(/\n?```$/i, '')
                        .trim()
                      
                      const parsedAnalysis = JSON.parse(cleanedContent)
                      
                      // Save to cache
                      const analysis = {
                        id: crypto.randomUUID(),
                        snapshotId: snapshot.id,
                        generatedAt: new Date().toISOString(),
                        model: selectedModel,
                        structured_content: parsedAnalysis,
                        raw_content: fullContent,
                        metadata: {
                          wordCount: extractedContent.metadata.wordCount,
                          sections: extractedContent.sections.length,
                          title: extractedContent.title,
                          lastUpdated: extractedContent.metadata.lastUpdated,
                          effectiveDate: extractedContent.metadata.effectiveDate
                        }
                      }
                      
                      await storage.setCachedAnalysis(cacheKey, analysis, 86400)
                      
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'complete',
                        analysis
                      })}\n\n`))
                    } catch (parseError) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'error',
                        error: 'Failed to parse AI response as JSON'
                      })}\n\n`))
                    }
                    
                    controller.close()
                    return
                  }
                  
                  try {
                    const parsed = JSON.parse(data)
                    if (parsed.choices?.[0]?.delta?.content) {
                      const content = parsed.choices[0].delta.content
                      fullContent += content
                      
                      // Send progress update
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'content',
                        content: content
                      })}\n\n`))
                    }
                  } catch (e) {
                    // Ignore parse errors for individual chunks
                  }
                }
              }
            }
          } finally {
            reader.releaseLock()
          }
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`))
          controller.close()
        }
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
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