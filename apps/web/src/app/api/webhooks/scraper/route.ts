/**
 * Scraper Webhook Handler
 * 
 * Receives notifications from the Railway-hosted scraper service
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { kv } from '@/app/api/lib/kv-wrapper'
import { logger } from '@/lib/logger'
import { unifiedStorage } from '@/lib/storage/unified-storage'
import { HashUtils } from '@/lib/utils/hash'

export const runtime = 'edge'

/**
 * Webhook payload schema
 */
const WebhookPayloadSchema = z.object({
  job_id: z.string(),
  status: z.enum(['completed', 'failed']),
  timestamp: z.string(),
  data: z.any(),
})

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKey = request.headers.get('X-API-Key')
    if (apiKey !== process.env.SCRAPER_API_KEY) {
      logger.warn('Scraper webhook unauthorized attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Parse webhook payload
    const body = await request.json()
    const payload = WebhookPayloadSchema.parse(body)
    
    logger.info('Received scraper webhook', {
      job_id: payload.job_id,
      status: payload.status,
    })
    
    // Log webhook event
    await kv.lpush('scraper:webhooks', JSON.stringify({
      ...payload,
      received_at: new Date().toISOString(),
    }))
    
    // Trim webhook log to last 1000 entries
    await kv.ltrim('scraper:webhooks', 0, 999)
    
    // Handle based on status
    if (payload.status === 'completed') {
      await handleCompletedScrape(payload.data)
    } else if (payload.status === 'failed') {
      await handleFailedScrape(payload.job_id, payload.data)
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Webhook processed successfully' 
    })
    
  } catch (error) {
    logger.error('Scraper webhook error:', error)
    
    // Don't return detailed errors to external service
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle completed scrape
 */
async function handleCompletedScrape(data: any) {
  try {
    const { company_slug, url, content, scraped_at } = data
    
    if (!company_slug || !content) {
      logger.error('Invalid scrape data', { company_slug, has_content: !!content })
      return
    }
    
    // Calculate content hash
    const contentHash = await HashUtils.secureSHA256(
      typeof content === 'string' ? content : JSON.stringify(content)
    )
    
    // Store the scraped content
    const storageKey = `scrape:${company_slug}:${contentHash}`
    await unifiedStorage.set(storageKey, {
      company_slug,
      url,
      content,
      scraped_at,
      content_hash: contentHash,
      processed: false,
    }, {
      ttl: 7 * 24 * 60 * 60, // 7 days
    })
    
    // Mark for processing
    await kv.lpush('scraper:process_queue', JSON.stringify({
      company_slug,
      content_hash: contentHash,
      storage_key: storageKey,
      scraped_at,
    }))
    
    // Update latest scrape timestamp
    await kv.set(
      `scraper:latest:${company_slug}`,
      JSON.stringify({
        scraped_at,
        content_hash: contentHash,
        url,
      }),
      { ex: 30 * 24 * 60 * 60 } // 30 days
    )
    
    logger.info('Scrape content stored', {
      company_slug,
      content_hash: contentHash,
      content_length: content.length,
    })
    
    // TODO: Trigger processing job to:
    // 1. Extract privacy policy content
    // 2. Calculate diff with previous version
    // 3. Generate AI summary
    // 4. Notify users if significant changes
    
  } catch (error) {
    logger.error('Error handling completed scrape:', error)
    throw error
  }
}

/**
 * Handle failed scrape
 */
async function handleFailedScrape(jobId: string, data: any) {
  try {
    const { error, company_slug } = data
    
    logger.error('Scrape failed', {
      job_id: jobId,
      company_slug,
      error,
    })
    
    // Track failure
    await kv.incr(`scraper:failures:${company_slug}`)
    
    // Store failure details
    await kv.setex(
      `scraper:failure:${jobId}`,
      7 * 24 * 60 * 60, // 7 days
      JSON.stringify({
        job_id: jobId,
        company_slug,
        error,
        failed_at: new Date().toISOString(),
      })
    )
    
    // Check if we should alert about repeated failures
    const failureCount = await kv.get(`scraper:failures:${company_slug}`)
    if (failureCount && parseInt(failureCount) >= 3) {
      // TODO: Send alert about repeated scraping failures
      logger.warn('Multiple scrape failures detected', {
        company_slug,
        failure_count: failureCount,
      })
    }
    
  } catch (error) {
    logger.error('Error handling failed scrape:', error)
    throw error
  }
}