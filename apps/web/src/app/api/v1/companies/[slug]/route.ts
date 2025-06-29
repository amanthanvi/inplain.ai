import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { kv } from '@vercel/kv'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'
import { companyCache } from '@/lib/cache/company-cache'
import { withErrorHandling, AuthenticationError, NotFoundError } from '@/lib/errors/api-errors'
import { performanceMonitor } from '@/lib/monitoring/performance'
import { logger } from '@/lib/monitoring'
import { validateAPIKey } from '@/lib/security/validation'

export const runtime = 'edge'

// GET /api/v1/companies/:slug
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) => {
  const transactionId = performanceMonitor.startTransaction('api.v1.companies.get')
  
  try {
    const { slug } = await context.params
    
    // Validate API key
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || !validateAPIKey(apiKey)) {
      throw new AuthenticationError('Invalid or missing API key')
    }
    
    // Track API usage
    await trackAPIUsage(apiKey, 'companies.get')
    
    // Try cache first
    const cached = await companyCache.get(slug)
    if (cached) {
      performanceMonitor.endTransaction(transactionId)
      return NextResponse.json({
        success: true,
        data: formatCompanyResponse(cached),
        cached: true
      })
    }
    
    // Check watched companies
    const watchedCompany = WATCHED_COMPANIES.find(c => c.slug === slug)
    if (watchedCompany) {
      const formatted = formatCompanyResponse(watchedCompany)
      await companyCache.set(slug, watchedCompany)
      
      performanceMonitor.endTransaction(transactionId)
      return NextResponse.json({
        success: true,
        data: formatted,
        cached: false
      })
    }
    
    // Check database
    const companyData = await kv.get(`company:${slug}`)
    if (!companyData) {
      throw new NotFoundError('Company')
    }
    
    const formatted = formatCompanyResponse(companyData as any)
    await companyCache.set(slug, companyData as any)
    
    performanceMonitor.endTransaction(transactionId)
    return NextResponse.json({
      success: true,
      data: formatted,
      cached: false
    })
    
  } catch (error) {
    performanceMonitor.endTransaction(transactionId)
    throw error
  }
})

// GET /api/v1/companies/:slug/policies
const getPolicies = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) => {
  const { slug } = await context.params
  
  // Validate API key
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || !validateAPIKey(apiKey)) {
    throw new AuthenticationError('Invalid or missing API key')
  }
  
  // Track API usage
  await trackAPIUsage(apiKey, 'companies.policies')
  
  // Get policies from cache or database
  const policies = await companyCache.getPolicies(slug)
  if (policies) {
    return NextResponse.json({
      success: true,
      data: policies.map(formatPolicyResponse),
      cached: true
    })
  }
  
  // Fetch from database
  const policyKeys = await kv.zrange(`company:${slug}:policies`, 0, -1)
  const policyData = []
  
  for (const key of policyKeys) {
    const policy = await kv.get(key as string)
    if (policy) {
      policyData.push(policy)
    }
  }
  
  if (policyData.length === 0) {
    throw new NotFoundError('Policies')
  }
  
  await companyCache.setPolicies(slug, policyData as any)
  
  return NextResponse.json({
    success: true,
    data: policyData.map(formatPolicyResponse),
    cached: false
  })
})

// GET /api/v1/companies/:slug/score
const getScore = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) => {
  const { slug } = await context.params
  
  // Validate API key
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || !validateAPIKey(apiKey)) {
    throw new AuthenticationError('Invalid or missing API key')
  }
  
  // Track API usage
  await trackAPIUsage(apiKey, 'companies.score')
  
  // Get latest privacy score
  const scoreKey = `company:${slug}:score:latest`
  const scoreData = await kv.get(scoreKey)
  
  if (!scoreData) {
    throw new NotFoundError('Privacy score')
  }
  
  return NextResponse.json({
    success: true,
    data: scoreData,
    cached: false
  })
})

// GET /api/v1/companies/:slug/changes
const getChanges = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) => {
  const { slug } = await context.params
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '10')
  
  // Validate API key
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || !validateAPIKey(apiKey)) {
    throw new AuthenticationError('Invalid or missing API key')
  }
  
  // Track API usage
  await trackAPIUsage(apiKey, 'companies.changes')
  
  // Get policy changes
  const { policyMonitor } = await import('@/lib/monitoring/policy-monitor')
  const changes = await policyMonitor.getCompanyChanges(slug, limit)
  
  return NextResponse.json({
    success: true,
    data: changes,
    cached: false
  })
})

// Helper functions
function formatCompanyResponse(company: any) {
  return {
    slug: company.slug,
    name: company.name,
    description: company.description,
    category: company.category,
    website: company.url,
    privacyPolicyUrl: company.privacyPolicyUrl,
    lastChecked: company.lastChecked,
    metadata: {
      headquarters: company.headquarters,
      founded: company.founded,
      employees: company.employees
    }
  }
}

function formatPolicyResponse(policy: any) {
  return {
    id: policy.id,
    name: policy.name,
    url: policy.url,
    type: policy.type,
    lastUpdated: policy.lastUpdated,
    version: policy.version
  }
}

async function trackAPIUsage(apiKey: string, endpoint: string) {
  const date = new Date().toISOString().split('T')[0]
  const usageKey = `api:usage:${apiKey}:${date}`
  
  await kv.hincrby(usageKey, endpoint, 1)
  await kv.hincrby(usageKey, 'total', 1)
  await kv.expire(usageKey, 90 * 24 * 60 * 60) // 90 days
  
  // Check rate limits
  const usage = await kv.hget(usageKey, 'total')
  const limit = await getAPIKeyLimit(apiKey)
  
  if (usage && parseInt(usage as string) > limit) {
    throw new Error('API rate limit exceeded')
  }
}

async function getAPIKeyLimit(apiKey: string): Promise<number> {
  // Get API key configuration
  const config = await kv.get(`api:key:${apiKey}:config`)
  return (config as any)?.dailyLimit || 1000
}