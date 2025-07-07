/**
 * Scraper Status API
 * 
 * Check the health and status of the Railway-hosted scraper service
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth as clerkAuth } from '@clerk/nextjs/server'
import { getScraperClient } from '@/lib/scraper/client'
import { kv } from '@/app/api/lib/kv-wrapper'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

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
    
    const scraperClient = getScraperClient()
    
    // Check if scraper is configured
    const configured = scraperClient.isConfigured()
    if (!configured) {
      return NextResponse.json({
        configured: false,
        status: 'not_configured',
        message: 'Scraper service is not configured. Please set SCRAPER_API_URL and SCRAPER_API_KEY.',
      })
    }
    
    try {
      // Check scraper health
      const health = await scraperClient.checkHealth()
      
      // Get recent webhook events
      const webhooks = await kv.lrange('scraper:webhooks', 0, 9)
      const recentWebhooks = webhooks?.map(w => JSON.parse(w as string)) || []
      
      // Get processing queue length
      const queueLength = await kv.llen('scraper:process_queue')
      
      // Get recent job stats
      const stats = await getScraperStats()
      
      return NextResponse.json({
        configured: true,
        status: 'healthy',
        health,
        url: process.env.NEXT_PUBLIC_SCRAPER_API_URL,
        stats,
        queue: {
          length: queueLength || 0,
        },
        recent_webhooks: recentWebhooks,
      })
      
    } catch (error) {
      logger.error('Scraper health check failed:', error)
      
      return NextResponse.json({
        configured: true,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        url: process.env.NEXT_PUBLIC_SCRAPER_API_URL,
      })
    }
    
  } catch (error) {
    logger.error('Error checking scraper status:', error)
    
    return NextResponse.json(
      { error: 'Failed to check scraper status' },
      { status: 500 }
    )
  }
}

/**
 * Get scraper statistics
 */
async function getScraperStats() {
  try {
    const now = Date.now()
    const hourAgo = now - 60 * 60 * 1000
    const dayAgo = now - 24 * 60 * 60 * 1000
    
    // Get recent webhooks for stats
    const webhooks = await kv.lrange('scraper:webhooks', 0, 99)
    const recentWebhooks = webhooks?.map(w => JSON.parse(w as string)) || []
    
    // Calculate stats
    const stats = {
      total_jobs: recentWebhooks.length,
      last_hour: 0,
      last_24h: 0,
      completed: 0,
      failed: 0,
      companies_scraped: new Set<string>(),
    }
    
    recentWebhooks.forEach(webhook => {
      const timestamp = new Date(webhook.timestamp).getTime()
      
      if (timestamp > hourAgo) {
        stats.last_hour++
      }
      
      if (timestamp > dayAgo) {
        stats.last_24h++
      }
      
      if (webhook.status === 'completed') {
        stats.completed++
        if (webhook.data?.company_slug) {
          stats.companies_scraped.add(webhook.data.company_slug)
        }
      } else if (webhook.status === 'failed') {
        stats.failed++
      }
    })
    
    return {
      total_jobs: stats.total_jobs,
      last_hour: stats.last_hour,
      last_24h: stats.last_24h,
      completed: stats.completed,
      failed: stats.failed,
      success_rate: stats.total_jobs > 0 
        ? Math.round((stats.completed / stats.total_jobs) * 100) 
        : 0,
      unique_companies: stats.companies_scraped.size,
    }
    
  } catch (error) {
    logger.error('Error calculating scraper stats:', error)
    return null
  }
}