import { NextRequest, NextResponse } from 'next/server'
import { rateLimiters, getRateLimitHeaders, createRateLimitResponse } from './rate-limiter'
import { securityMiddleware, checkIPAccess, checkRequestSize } from './security'
import { validateAPIKeyMiddleware, API_PERMISSIONS } from './api-key'

export interface MiddlewareConfig {
  rateLimit?: {
    enabled: boolean
    type: keyof typeof rateLimiters
  }
  security?: {
    enabled: boolean
    checkIP?: boolean
    maxRequestSize?: number
  }
  apiKey?: {
    enabled: boolean
    requiredPermission?: string
  }
}

/**
 * Compose middleware functions
 */
export async function composeMiddleware(
  request: NextRequest,
  config: MiddlewareConfig,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // 1. Security checks
    if (config.security?.enabled) {
      // Check IP access
      if (config.security.checkIP) {
        const ipAllowed = await checkIPAccess(request)
        if (!ipAllowed) {
          return new NextResponse(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          )
        }
      }

      // Check request size
      if (config.security.maxRequestSize) {
        const sizeOk = checkRequestSize(request, config.security.maxRequestSize)
        if (!sizeOk) {
          return new NextResponse(
            JSON.stringify({ error: 'Request too large' }),
            { status: 413, headers: { 'Content-Type': 'application/json' } }
          )
        }
      }

      // Detect attack patterns
      if (securityMiddleware.detectAttackPatterns(request)) {
        return new NextResponse(
          JSON.stringify({ error: 'Invalid request' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // 2. API Key validation
    let userId: string | undefined
    if (config.apiKey?.enabled) {
      const { valid, apiKey, error } = await validateAPIKeyMiddleware(
        request,
        config.apiKey.requiredPermission
      )

      if (!valid) {
        return new NextResponse(
          JSON.stringify({ error: error || 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }

      userId = apiKey?.userId
    }

    // 3. Rate limiting
    if (config.rateLimit?.enabled && config.rateLimit.type) {
      const limiter = rateLimiters[config.rateLimit.type]
      const result = await limiter.checkLimit(request, userId)

      if (!result.success) {
        return createRateLimitResponse(result)
      }

      // Add rate limit headers to successful responses
      const response = await handler(request)
      
      const rateLimitHeaders = getRateLimitHeaders(result)
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      // Apply security headers
      if (config.security?.enabled) {
        return await securityMiddleware.applySecurityHeaders(request, response)
      }

      return response
    }

    // 4. Execute handler
    const response = await handler(request)

    // Apply security headers
    if (config.security?.enabled) {
      return await securityMiddleware.applySecurityHeaders(request, response)
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Create middleware wrapper for API routes
 */
export function createAPIMiddleware(config: MiddlewareConfig) {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return async (request: NextRequest) => {
      return composeMiddleware(request, config, handler)
    }
  }
}

// Pre-configured middleware for common use cases
export const middleware = {
  // Public API endpoints
  publicAPI: createAPIMiddleware({
    rateLimit: { enabled: true, type: 'api' },
    security: { enabled: true }
  }),

  // Protected API endpoints
  protectedAPI: createAPIMiddleware({
    rateLimit: { enabled: true, type: 'api' },
    security: { enabled: true },
    apiKey: { enabled: true, requiredPermission: API_PERMISSIONS.READ }
  }),

  // AI endpoints
  aiAPI: createAPIMiddleware({
    rateLimit: { enabled: true, type: 'ai' },
    security: { enabled: true, maxRequestSize: 1048576 }, // 1MB
    apiKey: { enabled: true, requiredPermission: API_PERMISSIONS.READ }
  }),

  // Search endpoints
  searchAPI: createAPIMiddleware({
    rateLimit: { enabled: true, type: 'search' },
    security: { enabled: true }
  }),

  // Export endpoints
  exportAPI: createAPIMiddleware({
    rateLimit: { enabled: true, type: 'export' },
    security: { enabled: true },
    apiKey: { enabled: true, requiredPermission: API_PERMISSIONS.EXPORT }
  }),

  // Webhook endpoints
  webhookAPI: createAPIMiddleware({
    rateLimit: { enabled: true, type: 'webhook' },
    security: { enabled: true, checkIP: true },
    apiKey: { enabled: true, requiredPermission: API_PERMISSIONS.WEBHOOK }
  }),

  // Admin endpoints
  adminAPI: createAPIMiddleware({
    rateLimit: { enabled: true, type: 'api' },
    security: { enabled: true, checkIP: true },
    apiKey: { enabled: true, requiredPermission: API_PERMISSIONS.ADMIN }
  })
}

// Export all components
export * from './rate-limiter'
export * from './security'
export * from './api-key'