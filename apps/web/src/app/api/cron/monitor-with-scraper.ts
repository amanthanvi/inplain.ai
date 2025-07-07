/**
 * Enhanced Policy Monitor with Scraper Integration
 * 
 * Uses Railway-hosted scraper when available, falls back to direct fetch
 */

import { getScraperClient } from '@/lib/scraper/client'
import { logger } from '@/lib/logger'

interface MonitorResult {
  slug: string
  status: 'success' | 'failed' | 'queued'
  method: 'scraper' | 'direct'
  jobId?: string
  error?: string
}

/**
 * Check if scraper should be used for this company
 */
function shouldUseScraper(company: { slug: string; url: string }): boolean {
  // Sites that require JavaScript rendering
  const jsHeavySites = [
    'facebook.com',
    'instagram.com',
    'twitter.com',
    'linkedin.com',
    'tiktok.com',
  ]
  
  return jsHeavySites.some(site => company.url.includes(site))
}

/**
 * Monitor a company using scraper service
 */
export async function monitorWithScraper(
  company: { slug: string; url: string; name: string }
): Promise<MonitorResult> {
  const scraperClient = getScraperClient()
  
  // Check if scraper is configured
  if (!scraperClient.isConfigured()) {
    logger.info('Scraper not configured, using direct fetch', { slug: company.slug })
    return {
      slug: company.slug,
      status: 'failed',
      method: 'direct',
      error: 'Scraper not configured'
    }
  }
  
  // Check if we should use scraper for this site
  if (!shouldUseScraper(company)) {
    logger.info('Site does not require scraper', { slug: company.slug })
    return {
      slug: company.slug,
      status: 'failed',
      method: 'direct',
      error: 'Site does not require scraper'
    }
  }
  
  try {
    // Check scraper health first
    await scraperClient.checkHealth()
    
    // Trigger scrape job
    const job = await scraperClient.triggerScrape(
      company.slug,
      company.url,
      'normal' // Use high priority for sites that often fail
    )
    
    logger.info('Scraper job triggered', {
      slug: company.slug,
      job_id: job.job_id,
      status: job.status
    })
    
    return {
      slug: company.slug,
      status: 'queued',
      method: 'scraper',
      jobId: job.job_id
    }
    
  } catch (error) {
    logger.error('Failed to trigger scraper', {
      slug: company.slug,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return {
      slug: company.slug,
      status: 'failed',
      method: 'scraper',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Enhanced monitor function that tries scraper first
 */
export async function enhancedMonitorCompany(
  company: { slug: string; url: string; name: string },
  originalMonitor: (company: any) => Promise<void>
): Promise<void> {
  // Try scraper first for JS-heavy sites
  if (shouldUseScraper(company)) {
    const scraperResult = await monitorWithScraper(company)
    
    if (scraperResult.status === 'queued') {
      logger.info('Company queued for scraping', {
        slug: company.slug,
        job_id: scraperResult.jobId
      })
      // The webhook will handle the rest
      return
    }
  }
  
  // Fall back to original monitor function
  logger.info('Using direct fetch for monitoring', { slug: company.slug })
  return originalMonitor(company)
}