import { NextRequest, NextResponse } from 'next/server';
import { aiOrchestrator } from '@/lib/ai-orchestrator';
import { ContentExtractor } from '@/lib/content-extractor';
import { StorageClient } from '../../lib/storage';
import { kv } from '@vercel/kv';
import { getClerkAuth } from '@/lib/auth-clerk';

const storage = new StorageClient();

export const runtime = 'edge';
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const userTier = body.userTier || 'free';
    
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

    // Get the latest snapshot
    const snapshots = await storage.getLatestSnapshots(slug, 1);
    if (snapshots.length === 0) {
      return NextResponse.json(
        { error: `No privacy policy found for ${slug}` },
        { status: 404 }
      );
    }
    
    const snapshot = snapshots[0]!; // We know it exists because we checked length

    // Get and extract content
    const content = await storage.getSnapshotContent(snapshot.blobKey);
    if (!content) {
      return NextResponse.json(
        { error: 'Failed to retrieve policy content' },
        { status: 500 }
      );
    }

    const extractedText = ContentExtractor.extract(content);

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
        if (!aiOrchestrator) {
          throw new Error('AI orchestrator not initialized');
        }
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Streaming analysis failed' },
      { status: 500 }
    );
  }
}