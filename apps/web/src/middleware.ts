import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimiters, getRateLimitHeaders, createRateLimitResponse } from '@/lib/middleware/rate-limiter'
import { securityMiddleware, checkIPAccess } from '@/lib/middleware/security'
import * as Sentry from '@/lib/sentry'
import { logger } from '@/lib/logger'

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/onboarding(.*)',
  '/settings(.*)',
  '/api/alerts(.*)',
  '/api/watchlists(.*)',
  '/api/webhooks(.*)',
  '/api/export(.*)',
  '/api/user(.*)',
  '/api/analytics(.*)',
  '/api/auth/preferences(.*)'
])

// Define API routes that need rate limiting
const isAIRoute = createRouteMatcher([
  '/api/analyze(.*)',
  '/api/analyze-advanced(.*)',
  '/api/analyze-premium(.*)',
  '/api/privacy/analyze-advanced(.*)',
  '/api/analysis(.*)',
  '/api/policies/summarize(.*)',
  '/api/summary(.*)',
  '/api/ai-health(.*)'
])

const isSearchRoute = createRouteMatcher([
  '/api/search(.*)',
  '/api/companies(.*)'
])

const isExportRoute = createRouteMatcher([
  '/api/export(.*)'
])

const isPublicAPIRoute = createRouteMatcher([
  '/api/health(.*)',
  '/api/status',
  '/api/metrics(.*)',
  '/api/privacy/analysis-cache(.*)',
  '/api/feedback(.*)'
])

export default clerkMiddleware(async (auth, req) => {
  const start = Date.now()
  const response = NextResponse.next()
  
  // Add request ID for tracking
  const requestId = crypto.randomUUID()
  response.headers.set('X-Request-ID', requestId)
  
  // Apply security headers to all responses
  try {
    await securityMiddleware.applySecurityHeaders(req as NextRequest, response)
  } catch (error) {
    logger.error('Security middleware error', { error, requestId })
    Sentry.captureException(error, {
      tags: { type: 'middleware_security' },
      extra: { url: req.url, method: req.method }
    })
  }

  // Check IP access for admin routes
  if (req.nextUrl.pathname.startsWith('/api/admin')) {
    const ipAllowed = await checkIPAccess(req as NextRequest)
    if (!ipAllowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // Apply rate limiting based on route type
  let rateLimiter = null
  let userId: string | undefined

  // Get user ID from Clerk auth if available
  try {
    const authObj = await auth()
    userId = authObj.userId || undefined
  } catch (error) {
    // User not authenticated, continue without user ID
  }

  // Determine which rate limiter to use
  if (isAIRoute(req)) {
    rateLimiter = rateLimiters.ai
  } else if (isSearchRoute(req)) {
    rateLimiter = rateLimiters.search
  } else if (isExportRoute(req)) {
    rateLimiter = rateLimiters.export
  } else if (isPublicAPIRoute(req)) {
    rateLimiter = rateLimiters.api
  }

  // Apply rate limiting if applicable
  if (rateLimiter) {
    try {
      const result = await rateLimiter.checkLimit(req as NextRequest, userId)
      
      if (!result.success) {
        logger.warn('Rate limit exceeded', { 
          path: req.url, 
          userId, 
          requestId,
          ip: req.headers.get('x-forwarded-for') || 'unknown'
        })
        return createRateLimitResponse(result)
      }

      // Add rate limit headers to successful responses
      const headers = getRateLimitHeaders(result)
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
    } catch (error) {
      logger.error('Rate limiting error', { error, requestId })
      Sentry.captureException(error, {
        tags: { type: 'middleware_ratelimit' },
        extra: { url: req.url, userId }
      })
      // Continue without rate limiting if there's an error
    }
  }

  // Protect specific routes with Clerk authentication
  if (isProtectedRoute(req)) {
    try {
      await auth.protect()
    } catch (error) {
      logger.error('Authentication error', { error, requestId, path: req.url })
      Sentry.captureException(error, {
        tags: { type: 'middleware_auth' },
        extra: { url: req.url }
      })
      throw error
    }
  }

  // Add performance timing
  response.headers.set('X-Response-Time', `${Date.now() - start}ms`)
  
  // Log successful request
  logger.info('Request processed', {
    requestId,
    method: req.method,
    path: req.url,
    userId,
    duration: Date.now() - start
  })

  return response
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
