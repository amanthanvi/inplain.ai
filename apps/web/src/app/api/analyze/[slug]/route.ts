import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StorageClient } from '@/lib/storage';
import { ContentExtractor, ExtractedContent } from '@/lib/content-extractor';
import { getUnifiedAIService, UnifiedAIRequest, AIError, AIResponseError, AIRateLimitError, AINotFoundError, AIAuthError } from '@/lib/ai/unified-ai-service';
import { getPromptLibrary } from '@/lib/ai/prompts/prompt-library';
import { ComprehensiveAnalysisContext } from '@/lib/ai/prompts/task-prompts';
import { COMPREHENSIVE_POLICY_ANALYSIS_TOOL_NAME } from '@/lib/ai/tools/comprehensive-analysis-tools';

import { getClerkAuth } from '@/lib/auth-clerk';
import { isDevAuthEnabled } from '@/lib/dev-auth';

const storage = new StorageClient();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Optional: Request body schema for future extensions (e.g., forcing re-analysis)
const RequestBodySchema = z.object({
  forceReanalyze: z.boolean().optional(),
  // model: z.string().optional(), // Could allow user to specify model tier in future
}).strict();


export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } } // Slug is now directly available
) {
  try {
    const { slug } = params;
    let parsedBody = {}; // Default empty body
    // Try to parse body, but don't fail if it's not there or malformed for basic GET-like POST
    try {
        // Ensure request.json() is only called if there's a body
        if (request.body && request.headers.get('content-length') !== '0') {
            const body = await request.json();
            parsedBody = RequestBodySchema.parse(body);
        }
    } catch (e) {
        // Only error if there was a JSON body that was malformed
        if (request.method === 'POST' && request.headers.get('content-type')?.includes('application/json') && request.body) {
             return NextResponse.json({ error: 'Invalid request body', details: (e as Error).message }, { status: 400 });
        }
    }
    const { forceReanalyze = false } = parsedBody as { forceReanalyze?: boolean };


    // Authentication
    if (process.env.NODE_ENV === 'production' && !isDevAuthEnabled()) {
      const { userId } = getClerkAuth(request); // Pass request to getClerkAuth
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }
    
    // Demo mode
    if (!OPENROUTER_API_KEY) {
      // Return a mock analysis for demo mode
      const mockAnalysis = {
        id: crypto.randomUUID(),
        snapshotId: 'demo-snapshot',
        generatedAt: new Date().toISOString(),
        model: 'demo-model',
        structured_content: {
          executive_summary: "This is a demo analysis. To enable real AI analysis, please configure your OpenRouter API key.",
          // TODO: Add other fields from comprehensiveAnalysisParameters to make the mock more realistic
        },
        raw_content: "Demo analysis content",
        tokensUsed: { input:0, output:0, total:0 },
        metadata: { wordCount: 0, sectionsCount: 0, title: "Demo Policy" }
      };
      return NextResponse.json({ analysis: mockAnalysis, cached: false, demo: true });
    }

    const snapshots = await storage.getLatestSnapshots(slug, 1);
    if (snapshots.length === 0 || !snapshots[0]) {
      return NextResponse.json({ error: 'No snapshots found for this policy' }, { status: 404 });
    }
    const snapshot = snapshots[0];

    // Check for cached analysis first, unless forceReanalyze is true
    const cacheKey = `analysis:unified:v2:${snapshot.id}`; // Incremented version for new structure
    if (!forceReanalyze) {
      const cachedAnalysis = await storage.getCachedAnalysis(cacheKey);
      if (cachedAnalysis) {
        return NextResponse.json({ analysis: cachedAnalysis, cached: true });
      }
    }

    const htmlContent = await storage.getSnapshotContent(snapshot.blobKey);
    if (!htmlContent) {
      return NextResponse.json({ error: 'Snapshot content not found' }, { status: 404 });
    }

    const extractedContent: ExtractedContent = ContentExtractor.extract(htmlContent);
    
    if (!extractedContent.text || extractedContent.text.length < 100) {
      return NextResponse.json(
        { error: 'Failed to extract meaningful content from policy' },
        { status: 422 }
      )
    }
    
    if (!ContentExtractor.isPrivacyPolicy(extractedContent.text)) {
      return NextResponse.json({ error: 'Content does not appear to be a privacy policy' }, { status: 422 });
    }

    // Prepare request for UnifiedAIService using PromptLibrary
    const promptLibrary = getPromptLibrary();
    const context: ComprehensiveAnalysisContext = {
      policyHtmlContent: extractedContent.text, // Send extracted text
      companyName: slug.charAt(0).toUpperCase() + slug.slice(1),
      policyTitle: extractedContent.title,
      policyLastUpdated: extractedContent.metadata.lastUpdated,
      policyEffectiveDate: extractedContent.metadata.effectiveDate,
      policyWordCount: extractedContent.metadata.wordCount,
      policySections: extractedContent.sections.map(s => ({ title: s.title, characterCount: s.content.length })),
    };

    // Using 'COMPREHENSIVE_ANALYSIS_TASK' and 'PRIVACY_EXPERT_PERSONA' as defaults for this route
    const preparedPrompt = promptLibrary.prepareAIRequest(
      "comprehensive-policy-analysis-v1", // Task ID
      "privacy-expert-v1", // Persona ID
      context
    );

    if (!preparedPrompt) {
      return NextResponse.json({ error: 'Failed to prepare AI prompt' }, { status: 500 });
    }
    
    const aiService = getUnifiedAIService();
    const aiRequest: UnifiedAIRequest = {
      prompt: preparedPrompt.userPrompt,
      systemPrompt: preparedPrompt.systemPrompt,
      tools: preparedPrompt.tool ? [preparedPrompt.tool] : undefined,
      toolChoice: preparedPrompt.toolChoice,
      modelConfig: preparedPrompt.modelConfig,
      temperature: preparedPrompt.temperature,
      maxTokens: preparedPrompt.maxTokens,
    };

    const aiResponse = await aiService.request(aiRequest);

    let analysisResult;
    if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0 && aiResponse.toolCalls[0].function.name === COMPREHENSIVE_POLICY_ANALYSIS_TOOL_NAME) {
      try {
        analysisResult = JSON.parse(aiResponse.toolCalls[0].function.arguments || "{}");
      } catch (e) {
        console.error("Failed to parse tool call arguments as JSON:", e, "Raw:", aiResponse.toolCalls[0].function.arguments);
        return NextResponse.json({ error: 'AI returned malformed analysis data via tool.' }, { status: 500 });
      }
    } else if (aiResponse.content) {
      // Fallback: Model didn't use the tool, try to parse content if it's JSON, or use as text
      try {
        analysisResult = JSON.parse(aiResponse.content);
         console.warn("AI did not use the requested tool, but returned parsable JSON content.");
      } catch (e) {
        console.warn("AI did not use tool and content was not JSON. Storing raw content fragment.");
        analysisResult = { executive_summary: aiResponse.content.substring(0, 5000), raw_content_fallback: true, full_content_truncated: aiResponse.content.length > 5000 };
      }
    } else {
      console.error("AI Error from service:", aiResponse.error)
      return NextResponse.json({ error: aiResponse.error || 'AI returned no usable content or tool calls.' }, { status: 500 });
    }

    const finalAnalysis = {
      id: crypto.randomUUID(),
      snapshotId: snapshot.id,
      generatedAt: new Date().toISOString(),
      model: aiResponse.modelUsed,
      structured_content: analysisResult,
      // raw_content might be redundant if structured_content is from tool.
      // Consider storing tool_calls[0].function.arguments directly if debugging is needed.
      tokensUsed: aiResponse.tokensUsed,
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