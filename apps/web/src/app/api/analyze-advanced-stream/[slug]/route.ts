import { NextRequest, NextResponse } from 'next/server';
import { aiOrchestrator } from '@/lib/ai-orchestrator';
import { ContentExtractor } from '@/lib/content-extractor';
import { StorageClient } from '../../lib/storage';
import { kv } from '@vercel/kv';

const storage = new StorageClient();
const contentExtractor = new ContentExtractor();

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
    const snapshots = await storage.getLatestSnapshots(slug, 1);
    if (snapshots.length === 0) {
      return NextResponse.json(
        { error: `No privacy policy found for ${slug}` },
        { status: 404 }
      );
    }
    
    const snapshot = snapshots[0];

    // Get and extract content
    const content = await storage.getSnapshotContent(snapshot.blobKey);
    if (!content) {
      return NextResponse.json(
        { error: 'Failed to retrieve policy content' },
        { status: 500 }
      );
    }

    const extractedText = contentExtractor.extractFromHtml(content);

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
          extractedText,
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
          extractedText,
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Streaming analysis failed' },
      { status: 500 }
    );
  }
}