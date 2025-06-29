import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { policyMonitor } from '@/lib/monitoring/policy-monitor'
import { logger } from '@/lib/monitoring'
import { kv } from '@vercel/kv'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = (await headers()).get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting policy monitoring cron job')

    // Get all companies to monitor
    const companies = await getCompaniesToMonitor()
    
    logger.info(`Monitoring ${companies.length} policies`)

    // Monitor policies in batches
    const results = await policyMonitor.monitorPolicies(companies)
    
    // Summary statistics
    const stats = {
      total: companies.length,
      checked: companies.length,
      changed: results.length,
      byType: {
        structure: results.filter(r => r.changeType === 'structure').length,
        content: results.filter(r => r.changeType === 'content').length,
        minor: results.filter(r => r.changeType === 'minor').length
      }
    }

    // Store monitoring results
    await kv.set('policy:monitoring:last-run', {
      timestamp: new Date().toISOString(),
      stats,
      changes: results.map(r => ({
        company: r.companySlug,
        type: r.changeType,
        sections: r.changedSections
      }))
    }, { ex: 86400 }) // 24 hours

    logger.info('Policy monitoring completed', stats)

    return NextResponse.json({
      success: true,
      stats,
      changes: results.length > 0 ? results : undefined
    })

  } catch (error) {
    logger.error('Policy monitoring cron failed', { error })
    return NextResponse.json(
      { error: 'Monitoring failed' },
      { status: 500 }
    )
  }
}

async function getCompaniesToMonitor(): Promise<Array<{ companySlug: string; url: string }>> {
  const companies = []

  // Start with watched companies
  for (const company of WATCHED_COMPANIES) {
    if (company.privacyPolicyUrl) {
      companies.push({
        companySlug: company.slug,
        url: company.privacyPolicyUrl
      })
    }
  }

  // Add user-watched companies
  try {
    const userWatchedKeys = await kv.keys('watchlist:company:*')
    
    for (const key of userWatchedKeys) {
      const companySlug = key.split(':')[2]
      
      // Get company data
      const companyData = await kv.get(`company:${companySlug}`)
      if (companyData && (companyData as any).privacyPolicyUrl) {
        companies.push({
          companySlug,
          url: (companyData as any).privacyPolicyUrl
        })
      }
    }
  } catch (error) {
    logger.error('Failed to get user-watched companies', { error })
  }

  // Remove duplicates
  const uniqueCompanies = Array.from(
    new Map(companies.map(c => [c.companySlug, c])).values()
  )

  return uniqueCompanies
}