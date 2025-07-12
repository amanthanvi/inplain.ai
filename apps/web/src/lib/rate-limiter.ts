/**
 * Rate Limiter for API requests
 * 
 * Implements a simple token bucket algorithm for rate limiting
 */

import { kv } from '@/app/api/lib/kv-wrapper'
import { getEnvVar } from '@/lib/env'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reset: number
  limit: number
}

export class RateLimiter {
  private fallbackLimits: Map<string, { count: number; reset: number }> = new Map()

  constructor() {}

  /**
   * Check if a request is allowed under the rate limit
   */
  async checkLimit(
    identifier: string,
    limit: number = 100,
    window: number = 3600 // 1 hour in seconds
  ): Promise<RateLimitResult> {
    const now = Date.now()
    const key = `rate_limit:${identifier}`
    const windowStart = Math.floor(now / 1000 / window) * window

    try {
      // Get current count
      const current = await kv.get(key)
      const count = current ? parseInt(current as string, 10) : 0

      if (count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          reset: windowStart + window,
          limit
        }
      }

      // Increment count
      await kv.incr(key)
      await kv.expire(key, window)

      return {
        allowed: true,
        remaining: limit - count - 1,
        reset: windowStart + window,
        limit
      }
    } catch (error) {
      console.error('Rate limiter error:', error)
      // Fallback to in-memory on error
      return this.checkLimitFallback(identifier, limit, window)
    }
  }

  /**
   * In-memory fallback for rate limiting
   */
  private checkLimitFallback(
    identifier: string,
    limit: number,
    window: number
  ): RateLimitResult {
    const now = Date.now()
    const windowStart = Math.floor(now / 1000 / window) * window
    const key = `${identifier}:${windowStart}`

    const entry = this.fallbackLimits.get(key) || { count: 0, reset: windowStart + window }

    if (entry.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        reset: entry.reset,
        limit
      }
    }

    entry.count++
    this.fallbackLimits.set(key, entry)

    // Clean up old entries
    this.cleanupFallbackLimits()

    return {
      allowed: true,
      remaining: limit - entry.count,
      reset: entry.reset,
      limit
    }
  }

  /**
   * Clean up expired entries from fallback storage
   */
  private cleanupFallbackLimits() {
    const now = Date.now() / 1000
    for (const [key, value] of this.fallbackLimits.entries()) {
      if (value.reset < now) {
        this.fallbackLimits.delete(key)
      }
    }
  }

  /**
   * Create a rate limit middleware for API routes
   */
  static middleware(options?: {
    limit?: number
    window?: number
    identifier?: (req: Request) => string
  }) {
    const limiter = new RateLimiter()
    const {
      limit = 100,
      window = 3600,
      identifier = (req: Request) => req.headers.get('x-forwarded-for') || 'anonymous'
    } = options || {}

    return async (req: Request): Promise<Response | null> => {
      const id = identifier(req)
      const result = await limiter.checkLimit(id, limit, window)

      if (!result.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many requests. Please try again after ${new Date(result.reset * 1000).toISOString()}`,
            retryAfter: result.reset - Math.floor(Date.now() / 1000)
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': result.reset.toString(),
              'Retry-After': (result.reset - Math.floor(Date.now() / 1000)).toString()
            }
          }
        )
      }

      return null // Continue with request
    }
  }
}

// Export a default instance
export const rateLimiter = new RateLimiter()