import { kv } from '@vercel/kv'
import { NextRequest, NextResponse } from 'next/server'

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyPrefix?: string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}

export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = {
      keyPrefix: 'ratelimit',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    }
  }

  /**
   * Get the rate limit key for a request
   */
  private getKey(identifier: string): string {
    return `${this.config.keyPrefix}:${identifier}:${Math.floor(Date.now() / this.config.windowMs)}`
  }

  /**
   * Get the identifier for rate limiting (IP or user ID)
   */
  private async getIdentifier(req: NextRequest, userId?: string): Promise<string> {
    if (userId) {
      return `user:${userId}`
    }

    // Try to get real IP from various headers
    const forwardedFor = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    const cfConnectingIp = req.headers.get('cf-connecting-ip')
    
    const ip = forwardedFor?.split(',')[0]?.trim() || 
               realIp || 
               cfConnectingIp || 
               'unknown'

    return `ip:${ip}`
  }

  /**
   * Check rate limit for a request
   */
  async checkLimit(req: NextRequest, userId?: string): Promise<RateLimitResult> {
    const identifier = await this.getIdentifier(req, userId)
    const key = this.getKey(identifier)
    const now = Date.now()
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs
    const reset = new Date(windowStart + this.config.windowMs)

    try {
      // Get current count
      const current = await kv.incr(key)
      
      // Set expiry on first request
      if (current === 1) {
        await kv.expire(key, Math.ceil(this.config.windowMs / 1000))
      }

      const remaining = Math.max(0, this.config.maxRequests - current)
      const success = current <= this.config.maxRequests

      return {
        success,
        limit: this.config.maxRequests,
        remaining,
        reset,
        retryAfter: success ? undefined : Math.ceil((reset.getTime() - now) / 1000)
      }
    } catch (error) {
      console.error('Rate limit check failed:', error)
      // Fail open - allow request if rate limiting fails
      return {
        success: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        reset
      }
    }
  }

  /**
   * Reset rate limit for a specific identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = this.getKey(identifier)
    await kv.del(key)
  }
}

// Predefined rate limiters for different endpoints
export const rateLimiters = {
  // Strict limit for expensive AI operations
  ai: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10
  }),

  // Moderate limit for API endpoints
  api: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60
  }),

  // Relaxed limit for search
  search: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30
  }),

  // Very strict limit for authentication attempts
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5
  }),

  // Export operations
  export: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10
  }),

  // Webhook operations
  webhook: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100
  })
}

/**
 * Rate limit response headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toISOString(),
    ...(result.retryAfter && {
      'Retry-After': result.retryAfter.toString()
    })
  }
}

/**
 * Create rate limited response
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: result.retryAfter
    },
    {
      status: 429,
      headers: getRateLimitHeaders(result)
    }
  )
}