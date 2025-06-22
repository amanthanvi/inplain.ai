import { NextRequest, NextResponse } from 'next/server';
import { ApiError, ApiErrorType, handleApiError } from '@/lib/api-error';
import { aiOrchestrator } from '@/lib/ai-orchestrator';
import { getLatestSnapshot, getSnapshotContent } from '@/lib/db-queries';
import { extractTextFromHtml } from '@/lib/content-extractor';
import { kv } from '@vercel/kv';

export const runtime = 'edge';
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();
    const userTier = body.userTier || 'free';

    // Get the latest snapshot
    const snapshot = await getLatestSnapshot(slug);
    if (!snapshot) {
      throw new ApiError(
        ApiErrorType.NOT_FOUND,
        `No privacy policy found for ${slug}`
      );
    }

    // Get and extract content
    const content = await getSnapshotContent(slug, snapshot.id);
    if (!content) {
      throw new ApiError(
        ApiErrorType.SERVER_ERROR,
        'Failed to retrieve policy content'
      );
    }

    const extractedText = extractTextFromHtml(content.html, {
      includeMetadata: true,
      preserveStructure: true
    });

    // Create a TransformStream for SSE
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start the orchestration in the background
    (async () => {
      try {
        // Send initial event
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: 'init',
            message: 'Starting advanced AI analysis...',
            company: slug,
            mode: body.mode || 'standard'
          })}\n\n`)
        );

        // Stream the orchestration results
        const analysisStream = aiOrchestrator.streamOrchestrationAnalysis(
          extractedText.text,
          slug,
          {
            includeWebSearch: body.includeWebSearch,
            requireReasoning: body.mode === 'deep' || body.mode === 'expert',
            userTier
          }
        );

        for await (const event of analysisStream) {
          await writer.write(encoder.encode(`data: ${event}\n`));
        }

        // Perform the full analysis
        const fullAnalysis = await aiOrchestrator.orchestrateAnalysis(
          extractedText.text,
          slug,
          {
            includeWebSearch: body.includeWebSearch,
            requireReasoning: body.mode === 'deep' || body.mode === 'expert',
            userTier
          }
        );

        // Send the complete analysis
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: 'analysis_complete',
            analysis: fullAnalysis
          })}\n\n`)
        );

        // Cache the result
        const cacheKey = `analysis-advanced:${slug}:${snapshot.id}:${body.mode || 'standard'}:${userTier}`;
        await kv.setex(cacheKey, 86400, fullAnalysis);

        // Send completion event
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            message: 'Analysis complete!'
          })}\n\n`)
        );

      } catch (error) {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Analysis failed'
          })}\n\n`)
        );
      } finally {
        await writer.close();
      }
    })();

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Advanced streaming analysis error:', error);
    return handleApiError(error);
  }
}