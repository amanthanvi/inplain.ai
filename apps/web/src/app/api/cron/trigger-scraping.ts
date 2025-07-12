/**
 * Trigger Scraping Cron Job
 * 
 * Checks which companies need scraping and triggers the scraper
 */

import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@/app/api/lib/kv-wrapper'
import { storage } from '@/lib/storage/adapter'
import { logger } from '@/lib/logger'
import { getCompanies } from '@/lib/api'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting scraping trigger job')

    // Get all active companies
    const companies = await getCompanies()
    const companiesToScrape = []
    const now = new Date()

    for (const company of companies) {
      if (!company.active) continue

      // Check last scrape time
      const lastScrapeKey = `last-scrape:${company.slug}`
      const lastScrape = await kv.get(lastScrapeKey)
      
      let shouldScrape = false
      
      if (!lastScrape) {
        // Never scraped before
        shouldScrape = true
      } else {
        // Check if enough time has passed
        const lastScrapeTime = new Date(lastScrape as string)
        const timeSinceLastScrape = now.getTime() - lastScrapeTime.getTime()
        const checkInterval = company.checkInterval * 1000 // Convert to ms
        
        if (timeSinceLastScrape >= checkInterval) {
          shouldScrape = true
        }
      }

      // Also check if there's a pending scrape request
      const pendingKey = `scraping-job:${company.slug}`
      const pendingJob = await kv.get(pendingKey)
      if (pendingJob) {
        const job = JSON.parse(pendingJob as string)
        if (job.status === 'pending') {
          shouldScrape = true
        }
      }

      if (shouldScrape) {
        companiesToScrape.push(company)
      }
    }

    logger.info(`Found ${companiesToScrape.length} companies to scrape`)

    // Update Redis with companies to scrape
    if (companiesToScrape.length > 0) {
      await kv.set('companies:active', JSON.stringify(companiesToScrape), {
        ex: 3600 // 1 hour TTL
      })

      // Also add to scraping queue for our internal processing
      for (const company of companiesToScrape) {
        await kv.lpush('scraping-queue', JSON.stringify({
          id: `scrape-${company.slug}-${Date.now()}`,
          companySlug: company.slug,
          url: company.url,
          priority: 'normal',
          status: 'pending',
          createdAt: now,
          updatedAt: now
        }))

        // Mark last scrape time
        await kv.set(`last-scrape:${company.slug}`, now.toISOString(), {
          ex: 86400 * 7 // 7 days
        })
      }

      // If Railway scraper webhook is configured, notify it
      if (process.env.RAILWAY_SCRAPER_URL && process.env.RAILWAY_SCRAPER_SECRET) {
        try {
          const response = await fetch(`${process.env.RAILWAY_SCRAPER_URL}/trigger`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': process.env.RAILWAY_SCRAPER_SECRET
            },
            body: JSON.stringify({
              companies: companiesToScrape.map(c => ({
                slug: c.slug,
                url: c.url
              }))
            })
          })

          if (!response.ok) {
            logger.error('Failed to trigger Railway scraper', {
              status: response.status,
              statusText: response.statusText
            })
          } else {
            logger.info('Successfully triggered Railway scraper')
          }
        } catch (error) {
          logger.error('Error triggering Railway scraper:', error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      triggered: companiesToScrape.length,
      companies: companiesToScrape.map(c => c.slug)
    })
  } catch (error) {
    logger.error('Scraping trigger error:', error)
    return NextResponse.json(
      { error: 'Trigger failed' },
      { status: 500 }
    )
  }
}