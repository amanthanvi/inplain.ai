import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandling, AuthenticationError, ValidationError, NotFoundError, ConflictError } from '@/lib/errors/api-errors'
import { performanceMonitor } from '@/lib/monitoring/performance'
import { logger } from '@/lib/monitoring'
import { validateAPIKey } from '@/lib/security/validation'
import { WatchlistService } from '@/lib/watchlist'
import { kv } from '@vercel/kv'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

export const runtime = 'edge'

// Request schemas
const addToWatchlistSchema = z.object({
  action: z.literal('add'),
  companySlug: z.string().min(1),
  watchlistId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customNotes: z.string().max(1000).optional()
})

const removeFromWatchlistSchema = z.object({
  action: z.literal('remove'),
  companySlug: z.string().min(1),
  watchlistId: z.string().optional()
})

const createWatchlistSchema = z.object({
  action: z.literal('create'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  emailAlerts: z.boolean().optional(),
  alertThreshold: z.enum(['any', 'significant', 'critical']).optional()
})

const watchlistRequestSchema = z.discriminatedUnion('action', [
  addToWatchlistSchema,
  removeFromWatchlistSchema,
  createWatchlistSchema
])

// POST /api/v1/watchlist
export const POST = withErrorHandling(async (request: NextRequest) => {
  const transactionId = performanceMonitor.startTransaction('api.v1.watchlist.post')
  
  try {
    // Validate API key
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || !validateAPIKey(apiKey)) {
      throw new AuthenticationError('Invalid or missing API key')
    }
    
    // Get user ID from API key
    const userId = await getUserIdFromAPIKey(apiKey)
    if (!userId) {
      throw new AuthenticationError('Invalid API key')
    }
    
    // Track API usage
    await trackAPIUsage(apiKey, 'watchlist.post')
    
    // Parse and validate request body
    const body = await request.json()
    const validatedData = watchlistRequestSchema.parse(body)
    
    let result: any
    
    switch (validatedData.action) {
      case 'create': {
        // Create new watchlist
        result = await WatchlistService.createWatchlist(
          userId,
          validatedData.name,
          validatedData.description
        )
        
        // Update settings if provided
        if (validatedData.emailAlerts !== undefined || validatedData.alertThreshold) {
          await WatchlistService.updateWatchlist(result.id, {
            emailAlerts: validatedData.emailAlerts ?? result.emailAlerts,
            alertThreshold: validatedData.alertThreshold ?? result.alertThreshold
          })
        }
        
        logger.info('Watchlist created via API', {
          userId,
          watchlistId: result.id,
          name: validatedData.name
        })
        break
      }
      
      case 'add': {
        // Get company info
        const company = WATCHED_COMPANIES.find(c => c.slug === validatedData.companySlug) ||
          await kv.get(`company:${validatedData.companySlug}`)
        
        if (!company) {
          throw new NotFoundError('Company')
        }
        
        // Get watchlist (default to user's primary watchlist if not specified)
        let watchlistId = validatedData.watchlistId
        if (!watchlistId) {
          const watchlists = await WatchlistService.getUserWatchlists(userId)
          if (watchlists.length === 0) {
            // Create default watchlist
            const defaultWatchlist = await WatchlistService.createWatchlist(
              userId,
              'My Watchlist',
              'Default watchlist for API access'
            )
            watchlistId = defaultWatchlist.id
          } else {
            watchlistId = watchlists[0]!.id
          }
        }
        
        // Verify watchlist belongs to user
        const watchlist = await WatchlistService.getWatchlist(watchlistId)
        if (!watchlist || watchlist.userId !== userId) {
          throw new NotFoundError('Watchlist')
        }
        
        // Add to watchlist
        const success = await WatchlistService.addSiteToWatchlist(
          watchlistId,
          validatedData.companySlug,
          (company as any).name,
          validatedData.tags || []
        )
        
        if (!success) {
          throw new ConflictError('Company already in watchlist')
        }
        
        // Update site with custom notes if provided
        if (validatedData.customNotes) {
          await WatchlistService.updateSiteInWatchlist(
            watchlistId,
            validatedData.companySlug,
            { customNotes: validatedData.customNotes }
          )
        }
        
        result = {
          watchlistId,
          companySlug: validatedData.companySlug,
          companyName: (company as any).name,
          added: true
        }
        
        logger.info('Company added to watchlist via API', {
          userId,
          watchlistId,
          companySlug: validatedData.companySlug
        })
        break
      }
      
      case 'remove': {
        // Get watchlist
        let watchlistId = validatedData.watchlistId
        if (!watchlistId) {
          const watchlists = await WatchlistService.getUserWatchlists(userId)
          if (watchlists.length === 0) {
            throw new NotFoundError('Watchlist')
          }
          
          // Find watchlist containing the company
          const watchlistWithCompany = watchlists.find(w => 
            w.sites.some(s => s.companySlug === validatedData.companySlug)
          )
          
          if (!watchlistWithCompany) {
            throw new NotFoundError('Company not in any watchlist')
          }
          
          watchlistId = watchlistWithCompany.id
        }
        
        // Verify watchlist belongs to user
        const watchlist = await WatchlistService.getWatchlist(watchlistId)
        if (!watchlist || watchlist.userId !== userId) {
          throw new NotFoundError('Watchlist')
        }
        
        // Remove from watchlist
        const success = await WatchlistService.removeSiteFromWatchlist(
          watchlistId,
          validatedData.companySlug
        )
        
        if (!success) {
          throw new NotFoundError('Company not in watchlist')
        }
        
        result = {
          watchlistId,
          companySlug: validatedData.companySlug,
          removed: true
        }
        
        logger.info('Company removed from watchlist via API', {
          userId,
          watchlistId,
          companySlug: validatedData.companySlug
        })
        break
      }
    }
    
    performanceMonitor.endTransaction(transactionId)
    
    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    })
    
  } catch (error) {
    performanceMonitor.endTransaction(transactionId)
    
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid request data', error.errors)
    }
    
    throw error
  }
})

// GET /api/v1/watchlist
export const GET = withErrorHandling(async (request: NextRequest) => {
  const transactionId = performanceMonitor.startTransaction('api.v1.watchlist.get')
  
  try {
    // Validate API key
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || !validateAPIKey(apiKey)) {
      throw new AuthenticationError('Invalid or missing API key')
    }
    
    // Get user ID from API key
    const userId = await getUserIdFromAPIKey(apiKey)
    if (!userId) {
      throw new AuthenticationError('Invalid API key')
    }
    
    // Track API usage
    await trackAPIUsage(apiKey, 'watchlist.get')
    
    // Get user's watchlists
    const watchlists = await WatchlistService.getUserWatchlists(userId)
    
    // Format response
    const formattedWatchlists = watchlists.map(watchlist => ({
      id: watchlist.id,
      name: watchlist.name,
      description: watchlist.description,
      settings: {
        emailAlerts: watchlist.emailAlerts,
        webhookEnabled: watchlist.webhookEnabled,
        alertThreshold: watchlist.alertThreshold
      },
      companies: watchlist.sites.map(site => ({
        slug: site.companySlug,
        name: site.companyName,
        addedAt: site.addedAt,
        lastChecked: site.lastChecked,
        lastChange: site.lastChange,
        tags: site.tags,
        customNotes: site.customNotes
      })),
      stats: {
        totalCompanies: watchlist.sites.length,
        createdAt: watchlist.createdAt,
        updatedAt: watchlist.updatedAt
      }
    }))
    
    performanceMonitor.endTransaction(transactionId)
    
    return NextResponse.json({
      success: true,
      data: formattedWatchlists,
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    })
    
  } catch (error) {
    performanceMonitor.endTransaction(transactionId)
    throw error
  }
})

async function getUserIdFromAPIKey(apiKey: string): Promise<string | null> {
  const keyData = await kv.get(`api:key:${apiKey}`)
  return (keyData as any)?.userId || null
}

async function trackAPIUsage(apiKey: string, endpoint: string) {
  const date = new Date().toISOString().split('T')[0]
  const usageKey = `api:usage:${apiKey}:${date}`
  
  await kv.hincrby(usageKey, endpoint, 1)
  await kv.hincrby(usageKey, 'total', 1)
  await kv.expire(usageKey, 90 * 24 * 60 * 60) // 90 days
  
  const usage = await kv.hget(usageKey, 'total')
  const limit = await getAPIKeyLimit(apiKey)
  
  if (usage && parseInt(usage as string) > limit) {
    throw new Error('API rate limit exceeded')
  }
}

async function getAPIKeyLimit(apiKey: string): Promise<number> {
  const config = await kv.get(`api:key:${apiKey}:config`)
  return (config as any)?.dailyLimit || 1000
}