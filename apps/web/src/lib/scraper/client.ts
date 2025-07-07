/**
 * Scraper API Client
 * 
 * Client for communicating with the Railway-hosted Python scraper service
 */

import { z } from 'zod'
import { logger } from '@/lib/logger'

/**
 * Scraper job response schema
 */
const ScraperJobSchema = z.object({
  job_id: z.string(),
  status: z.enum(['queued', 'pending', 'running', 'completed', 'failed']),
  message: z.string().optional(),
})

/**
 * Scraper result schema
 */
const ScraperResultSchema = z.object({
  job_id: z.string(),
  company_slug: z.string(),
  url: z.string(),
  scraped_at: z.string(),
  content: z.any(),
})

/**
 * Job status schema
 */
const JobStatusSchema = z.object({
  id: z.string(),
  slug: z.string(),
  url: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  created_at: z.string(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  failed_at: z.string().optional(),
  error: z.string().optional(),
  result: z.any().optional(),
})

export type ScraperJob = z.infer<typeof ScraperJobSchema>
export type ScraperResult = z.infer<typeof ScraperResultSchema>
export type JobStatus = z.infer<typeof JobStatusSchema>

/**
 * Scraper API client
 */
export class ScraperClient {
  private apiUrl: string
  private apiKey: string
  private timeout: number
  
  constructor() {
    this.apiUrl = process.env.NEXT_PUBLIC_SCRAPER_API_URL || ''
    this.apiKey = process.env.SCRAPER_API_KEY || ''
    this.timeout = 30000 // 30 seconds
    
    if (!this.apiUrl) {
      logger.warn('Scraper API URL not configured')
    }
    
    if (!this.apiKey) {
      logger.warn('Scraper API key not configured')
    }
  }
  
  /**
   * Check if scraper is configured
   */
  isConfigured(): boolean {
    return !!(this.apiUrl && this.apiKey)
  }
  
  /**
   * Make authenticated request to scraper API
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Scraper API not configured')
    }
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)
    
    try {
      const response = await fetch(`${this.apiUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          ...options.headers,
        },
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Scraper API error (${response.status}): ${error}`)
      }
      
      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Scraper API request timeout')
        }
        throw error
      }
      
      throw new Error('Unknown scraper API error')
    }
  }
  
  /**
   * Trigger a scraping job
   */
  async triggerScrape(
    slug: string,
    url: string,
    priority: 'normal' | 'high' = 'normal'
  ): Promise<ScraperJob> {
    logger.info('Triggering scrape', { slug, url, priority })
    
    const response = await this.request<any>('/scrape', {
      method: 'POST',
      body: JSON.stringify({ slug, url, priority }),
    })
    
    return ScraperJobSchema.parse(response)
  }
  
  /**
   * Trigger batch scraping jobs
   */
  async triggerBatchScrape(
    companies: Array<{ slug: string; url: string }>
  ): Promise<{ job_ids: string[]; count: number; status: string }> {
    logger.info('Triggering batch scrape', { count: companies.length })
    
    return this.request('/scrape/batch', {
      method: 'POST',
      body: JSON.stringify({ companies }),
    })
  }
  
  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await this.request<any>(`/status/${jobId}`)
    return JobStatusSchema.parse(response)
  }
  
  /**
   * Get latest results for a company
   */
  async getLatestResults(companySlug: string): Promise<ScraperResult | null> {
    try {
      const response = await this.request<any>(`/results/${companySlug}`)
      return ScraperResultSchema.parse(response)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }
  
  /**
   * Check scraper health
   */
  async checkHealth(): Promise<{
    status: string
    timestamp: string
    services: Record<string, string>
  }> {
    // Health endpoint doesn't require auth
    const response = await fetch(`${this.apiUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    
    if (!response.ok) {
      throw new Error('Scraper health check failed')
    }
    
    return response.json()
  }
  
  /**
   * Wait for job completion with polling
   */
  async waitForJob(
    jobId: string,
    options: {
      pollingInterval?: number
      maxAttempts?: number
      onProgress?: (status: JobStatus) => void
    } = {}
  ): Promise<JobStatus> {
    const {
      pollingInterval = 2000, // 2 seconds
      maxAttempts = 30, // 1 minute total
      onProgress,
    } = options
    
    let attempts = 0
    
    while (attempts < maxAttempts) {
      const status = await this.getJobStatus(jobId)
      
      if (onProgress) {
        onProgress(status)
      }
      
      if (status.status === 'completed' || status.status === 'failed') {
        return status
      }
      
      await new Promise(resolve => setTimeout(resolve, pollingInterval))
      attempts++
    }
    
    throw new Error(`Job ${jobId} did not complete within timeout`)
  }
}

// Export singleton instance
let scraperClient: ScraperClient | null = null

export function getScraperClient(): ScraperClient {
  if (!scraperClient) {
    scraperClient = new ScraperClient()
  }
  return scraperClient
}