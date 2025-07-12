/**
 * Scraping Queue Management
 * 
 * Handles queuing and processing of privacy policy scraping requests
 */

import { kv } from '@/app/api/lib/kv-wrapper'
import { logger } from '@/lib/logger'

export interface ScrapingJob {
  companySlug: string
  url: string
  priority: 'high' | 'normal' | 'low'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  createdAt: Date
  updatedAt: Date
  error?: string
}

/**
 * Trigger scraping for a company's privacy policy
 * This queues the job and returns immediately
 */
export async function triggerScraping(
  companySlug: string, 
  url: string,
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<void> {
  try {
    const job: ScrapingJob = {
      companySlug,
      url,
      priority,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Add to queue
    await kv.lpush('scraping-queue', JSON.stringify(job))
    
    // Also store job details for tracking
    await kv.set(`scraping-job:${companySlug}`, job, {
      ex: 86400 // 24 hours
    })

    logger.info('Scraping job queued', { companySlug, url, priority })

    // If this is a high priority job, trigger immediate processing
    if (priority === 'high') {
      // In production, this would trigger a worker or serverless function
      // For now, we'll just log it
      logger.info('High priority scraping job - triggering immediate processing', { companySlug })
    }
  } catch (error) {
    logger.error('Failed to queue scraping job', { companySlug, url, error })
    throw error
  }
}

/**
 * Get the status of a scraping job
 */
export async function getScrapingStatus(companySlug: string): Promise<ScrapingJob | null> {
  try {
    const job = await kv.get<ScrapingJob>(`scraping-job:${companySlug}`)
    return job
  } catch (error) {
    logger.error('Failed to get scraping status', { companySlug, error })
    return null
  }
}

/**
 * Process the next job in the scraping queue
 * This would be called by a worker or cron job
 */
export async function processScrapingQueue(): Promise<void> {
  try {
    // Get the next job from the queue (using lrange + ltrim to simulate rpop)
    const jobs = await kv.lrange('scraping-queue', -1, -1) // Get last item
    if (!jobs || jobs.length === 0) {
      return // No jobs to process
    }
    
    // Remove the job from the queue
    await kv.ltrim('scraping-queue', 0, -2) // Keep all but the last item
    
    const jobData = jobs[0]
    if (!jobData) {
      return // No job data
    }
    const job = JSON.parse(jobData) as ScrapingJob
    
    // Update job status
    job.status = 'processing'
    job.updatedAt = new Date()
    await kv.set(`scraping-job:${job.companySlug}`, job, {
      ex: 86400 // 24 hours
    })

    // In production, this would trigger the actual scraping
    logger.info('Processing scraping job', { companySlug: job.companySlug })

    // TODO: Call the actual scraper service here
    // For now, we'll just log it
    
  } catch (error) {
    logger.error('Failed to process scraping queue', { error })
  }
}