import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'
import { companyCache } from '@/lib/cache/company-cache'
import { withErrorHandling } from '@/lib/errors/api-errors'
import { performanceMonitor } from '@/lib/monitoring/performance'
import { logger } from '@/lib/monitoring'

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) => {
  const transactionId = performanceMonitor.startTransaction('api.company.get')
  
  try {
    const { slug } = await params
    
    // Try cache first
    const cachedCompany = await companyCache.get(slug)
    if (cachedCompany) {
      logger.info('Company cache hit', { slug })
      performanceMonitor.endTransaction(transactionId)
      return NextResponse.json(cachedCompany)
    }
    
    // Check watched companies
    const watchedCompany = WATCHED_COMPANIES.find(c => c.slug === slug)
    
    if (watchedCompany) {
      await companyCache.set(slug, watchedCompany)
      performanceMonitor.endTransaction(transactionId)
      return NextResponse.json(watchedCompany)
    }
    
    // Check database
    const companyKey = `company:${slug}`
    const companyData = await kv.get(companyKey)
    
    if (companyData) {
      await companyCache.set(slug, companyData as any)
      performanceMonitor.endTransaction(transactionId)
      return NextResponse.json(companyData)
    }
    
    // Infer company data
    const inferredCompany = {
      name: slug.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      slug: slug,
      url: `https://${slug}.com/privacy`,
      category: 'technology',
      description: 'Privacy policy monitoring in progress',
      lastChecked: null,
      status: 'pending'
    }
    
    // Save to database and cache
    await kv.set(companyKey, inferredCompany, { ex: 86400 })
    await companyCache.set(slug, inferredCompany as any)
    
    performanceMonitor.endTransaction(transactionId)
    return NextResponse.json(inferredCompany)
    
  } catch (error) {
    performanceMonitor.endTransaction(transactionId)
    throw error
  }
})