/**
 * Snapshot Storage API
 * 
 * Stores privacy policy snapshots from the scraper
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { storage } from '@/lib/storage/adapter'
import { logger } from '@/lib/logger'
import { SnapshotMetaSchema } from '@inplain.ai/shared'

const SnapshotCreateSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  url: z.string().url(),
  capturedAt: z.string(),
  blobKey: z.string().optional(),
  contentHash: z.string(),
  contentLength: z.number(),
  contentType: z.enum(['html', 'pdf', 'text']),
  content: z.string(),
  headers: z.record(z.any()).optional(),
  status: z.enum(['pending', 'processed', 'failed']).optional()
})

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Verify API key
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')
    
    if (!apiKey || apiKey !== process.env.VERCEL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = params
    const body = await request.json()
    
    // Validate input
    const data = SnapshotCreateSchema.parse(body)
    
    // Ensure slug matches
    if (data.slug !== slug) {
      return NextResponse.json(
        { error: 'Slug mismatch' },
        { status: 400 }
      )
    }
    
    // Store snapshot metadata
    const snapshot = SnapshotMetaSchema.parse({
      id: data.id,
      slug: data.slug,
      url: data.url,
      capturedAt: data.capturedAt,
      blobKey: data.blobKey || `snapshots/${slug}/${data.id}.${data.contentType}`,
      contentHash: data.contentHash,
      contentLength: data.contentLength,
      contentType: data.contentType,
      headers: data.headers || {},
      status: data.status || 'processed'
    })
    
    await storage.snapshot.set(slug, snapshot)
    
    // Store content
    if (data.content) {
      await storage.setSnapshotContent(slug, snapshot.id, data.content)
    }
    
    logger.info('Snapshot stored', {
      slug,
      snapshot_id: snapshot.id,
      content_length: data.contentLength
    })
    
    // Check if we should calculate diff
    const previousSnapshots = await storage.snapshot.list({
      companySlug: slug,
      limit: 2
    })
    
    if (previousSnapshots.length >= 2) {
      // Queue diff calculation
      const fromSnapshot = previousSnapshots[1]
      const toSnapshot = previousSnapshots[0]
      
      if (fromSnapshot && toSnapshot && fromSnapshot.id !== toSnapshot.id) {
        await queueDiffCalculation(slug, fromSnapshot.id, toSnapshot.id)
      }
    }
    
    return NextResponse.json({
      success: true,
      snapshot: {
        id: snapshot.id,
        slug: snapshot.slug,
        capturedAt: snapshot.capturedAt
      }
    })
  } catch (error) {
    logger.error('Snapshot storage error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Storage failed' },
      { status: 500 }
    )
  }
}

async function queueDiffCalculation(
  slug: string,
  fromSnapshotId: string,
  toSnapshotId: string
) {
  try {
    const { kv } = await import('@/app/api/lib/kv-wrapper')
    
    await kv.lpush('diff:calculation:queue', JSON.stringify({
      slug,
      fromSnapshotId,
      toSnapshotId,
      queuedAt: new Date().toISOString()
    }))
    
    logger.info('Diff calculation queued', {
      slug,
      from: fromSnapshotId,
      to: toSnapshotId
    })
  } catch (error) {
    logger.error('Failed to queue diff calculation:', error)
  }
}