/**
 * Admin Scraping API
 * 
 * Allows administrators to manually trigger privacy policy scraping
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth as clerkAuth } from '@clerk/nextjs/server'
import { getScraperClient } from '@/lib/scraper/client'
import { logger } from '@/lib/logger'
import { kv } from '@/app/api/lib/kv-wrapper'

export const runtime = 'edge'

/**
 * Request schema
 */
const ScrapeRequestSchema = z.object({
  slug: z.string().min(1),
  url: z.string().url(),
  priority: z.enum(['normal', 'high']).optional().default('normal'),
})

const BatchScrapeRequestSchema = z.object({
  companies: z.array(z.object({
    slug: z.string().min(1),
    url: z.string().url(),
  })).min(1).max(50), // Limit batch size
})

/**
 * Trigger a single scrape job
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const { userId } = await clerkAuth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // TODO: Check if user is admin
    // For now, any authenticated user can trigger scraping
    
    // Check if scraper is configured
    const scraperClient = getScraperClient()
    if (!scraperClient.isConfigured()) {
      return NextResponse.json(
        { error: 'Scraper service not configured' },
        { status: 503 }
      )
    }
    
    // Parse request body
    const body = await request.json()
    
    // Handle batch scraping
    if (body.companies) {
      const data = BatchScrapeRequestSchema.parse(body)
      
      // Check rate limit for batch operations
      const rateLimitKey = `scrape:batch:${userId}`
      const count = await kv.incr(rateLimitKey)
      if (count === 1) {
        await kv.expire(rateLimitKey, 3600) // 1 hour
      }
      
      if (count > 5) { // Max 5 batch operations per hour
        return NextResponse.json(
          { error: 'Rate limit exceeded for batch scraping' },
          { status: 429 }
        )
      }
      
      // Trigger batch scrape
      const result = await scraperClient.triggerBatchScrape(data.companies)
      
      logger.info('Batch scrape triggered', {
        user_id: userId,
        count: result.count,
        job_ids: result.job_ids,
      })
      
      return NextResponse.json(result)
    }
    
    // Handle single scrape
    const data = ScrapeRequestSchema.parse(body)
    
    // Check rate limit
    const rateLimitKey = `scrape:single:${userId}`
    const count = await kv.incr(rateLimitKey)
    if (count === 1) {
      await kv.expire(rateLimitKey, 300) // 5 minutes
    }
    
    if (count > 10) { // Max 10 scrapes per 5 minutes
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }
    
    // Check if already scraped recently
    const recentKey = `scraper:latest:${data.slug}`
    const recent = await kv.get(recentKey)
    if (recent) {
      const recentData = JSON.parse(recent as string)
      const hourAgo = Date.now() - 60 * 60 * 1000
      const scrapedAt = new Date(recentData.scraped_at).getTime()
      
      if (scrapedAt > hourAgo && data.priority !== 'high') {
        return NextResponse.json({
          error: 'Recently scraped',
          message: 'This site was scraped less than an hour ago. Use priority=high to force rescrape.',
          last_scraped: recentData.scraped_at,
        }, { status: 400 })
      }
    }
    
    // Trigger scrape
    const job = await scraperClient.triggerScrape(
      data.slug,
      data.url,
      data.priority
    )
    
    logger.info('Scrape triggered', {
      user_id: userId,
      company_slug: data.slug,
      job_id: job.job_id,
      priority: data.priority,
    })
    
    // Store job metadata
    await kv.set(
      `scrape:job:${job.job_id}`,
      JSON.stringify({
        ...job,
        triggered_by: userId,
        triggered_at: new Date().toISOString(),
        company_slug: data.slug,
        url: data.url,
      }),
      { ex: 3600 } // 1 hour TTL
    )
    
    return NextResponse.json({
      ...job,
      message: `Scraping job ${job.job_id} queued for ${data.slug}`,
    })
    
  } catch (error) {
    logger.error('Error triggering scrape:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }
    
    if (error instanceof Error) {
      // Check for specific scraper errors
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Scraper service timeout' },
          { status: 504 }
        )
      }
      
      if (error.message.includes('Scraper API error')) {
        return NextResponse.json(
          { error: 'Scraper service error', message: error.message },
          { status: 502 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to trigger scrape' },
      { status: 500 }
    )
  }
}

/**
 * Get scraping job status
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const { userId } = await clerkAuth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get job ID from query params
    const jobId = request.nextUrl.searchParams.get('job_id')
    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing job_id parameter' },
        { status: 400 }
      )
    }
    
    // Check if scraper is configured
    const scraperClient = getScraperClient()
    if (!scraperClient.isConfigured()) {
      return NextResponse.json(
        { error: 'Scraper service not configured' },
        { status: 503 }
      )
    }
    
    // Get job status
    const status = await scraperClient.getJobStatus(jobId)
    
    // Get additional metadata if available
    const metadata = await kv.get(`scrape:job:${jobId}`)
    if (metadata) {
      return NextResponse.json({
        ...status,
        metadata: JSON.parse(metadata as string),
      })
    }
    
    return NextResponse.json(status)
    
  } catch (error) {
    logger.error('Error getting scrape status:', error)
    
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to get scrape status' },
      { status: 500 }
    )
  }
}