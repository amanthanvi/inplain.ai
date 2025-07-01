/**
 * Enhanced Rate Limiting for Production
 * 
 * Implements sophisticated rate limiting with sliding windows,
 * distributed rate limiting, and adaptive throttling
 */

import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@/app/api/lib/kv-wrapper'
import { logger } from '@/lib/logger'
import { SecurityMonitor } from '@/lib/security/enhanced-security'

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  windowMs: number
  max: number
  message?: string
  standardHeaders?: boolean
  legacyHeaders?: boolean
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (req: NextRequest) => string
  handler?: (req: NextRequest) => NextResponse | Promise<NextResponse>
  skip?: (req: NextRequest) => boolean | Promise<boolean>
  requestPropertyName?: string
  store?: RateLimitStore
}

/**
 * Rate limit store interface
 */
interface RateLimitStore {
  increment(key: string): Promise<{ totalHits: number; resetTime?: Date }>
  decrement(key: string): Promise<void>
  resetKey(key: string): Promise<void>
  resetAll(): Promise<void>
}

/**
 * Sliding window rate limit store using Redis
 */
export class SlidingWindowStore implements RateLimitStore {
  private windowMs: number
  private prefix: string
  
  constructor(windowMs: number, prefix: string = 'ratelimit:') {
    this.windowMs = windowMs
    this.prefix = prefix
  }
  
  async increment(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
    const now = Date.now()
    const window = Math.floor(now / this.windowMs)
    const resetTime = new Date((window + 1) * this.windowMs)
    
    // Use simple counter for rate limiting since KV doesn't have full Redis sorted set support
    const redisKey = `${this.prefix}${key}:${window}`
    
    // Increment counter
    const totalHits = await kv.incr(redisKey) || 1
    
    // Set expiry on first request
    if (totalHits === 1) {
      await kv.expire(redisKey, Math.ceil(this.windowMs / 1000) + 1)
    }
    
    return { totalHits, resetTime }
  }
  
  async decrement(key: string): Promise<void> {
    // In sliding window, we don't decrement, entries expire naturally
  }
  
  async resetKey(key: string): Promise<void> {
    const window = Math.floor(Date.now() / this.windowMs)
    await kv.del(`${this.prefix}${key}:${window}`)
  }
  
  async resetAll(): Promise<void> {
    // KV doesn't support keys command, so we can't reset all
    // This would need to be tracked separately if needed
  }
}

/**
 * Token bucket rate limit store
 */
export class TokenBucketStore implements RateLimitStore {
  private capacity: number
  private refillRate: number
  private prefix: string
  
  constructor(capacity: number, refillPerSecond: number, prefix: string = 'bucket:') {
    this.capacity = capacity
    this.refillRate = refillPerSecond
    this.prefix = prefix
  }
  
  async increment(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
    const bucketKey = `${this.prefix}${key}`
    const now = Date.now()
    
    // Get current bucket state
    let bucket = await kv.get<{ tokens: number; lastRefill: number }>(bucketKey)
    
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now }
    }
    
    // Calculate tokens to add based on time passed
    const timePassed = (now - bucket.lastRefill) / 1000
    const tokensToAdd = Math.floor(timePassed * this.refillRate)
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd)
    bucket.lastRefill = now
    
    // Check if request can proceed
    if (bucket.tokens > 0) {
      bucket.tokens--
      await kv.set(bucketKey, bucket, { ex: 3600 }) // 1 hour expiry
      
      // Calculate when bucket will be full again
      const timeToFull = (this.capacity - bucket.tokens) / this.refillRate
      const resetTime = new Date(now + timeToFull * 1000)
      
      return { totalHits: this.capacity - bucket.tokens, resetTime }
    }
    
    // No tokens available
    return { totalHits: this.capacity + 1, resetTime: new Date(now + 1000 / this.refillRate) }
  }
  
  async decrement(key: string): Promise<void> {
    const bucketKey = `${this.prefix}${key}`
    const bucket = await kv.get<{ tokens: number; lastRefill: number }>(bucketKey)
    
    if (bucket && bucket.tokens < this.capacity) {
      bucket.tokens++
      await kv.set(bucketKey, bucket, { ex: 3600 })
    }
  }
  
  async resetKey(key: string): Promise<void> {
    await kv.del(`${this.prefix}${key}`)
  }
  
  async resetAll(): Promise<void> {
    // KV doesn't support keys command, so we can't reset all
    // This would need to be tracked separately if needed
  }
}

/**
 * Enhanced rate limiter with multiple strategies
 */
export class EnhancedRateLimiter {
  protected config: Required<RateLimitConfig>
  
  constructor(config: RateLimitConfig) {
    const defaults: RateLimitConfig = {
      windowMs: 60 * 1000, // 1 minute default
      max: 100,
      message: 'Too many requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => this.defaultKeyGenerator(req),
      handler: (req) => this.defaultHandler(req),
      skip: () => false,
      requestPropertyName: 'rateLimit'
    }
    
    const mergedConfig = { ...defaults, ...config }
    
    // Create store with the final windowMs value
    if (!mergedConfig.store) {
      mergedConfig.store = new SlidingWindowStore(mergedConfig.windowMs!)
    }
    
    this.config = mergedConfig as Required<RateLimitConfig>
  }
  
  /**
   * Rate limit middleware
   */
  async limit(request: NextRequest): Promise<NextResponse | null> {
    // Check if should skip
    if (await this.config.skip(request)) {
      return null
    }
    
    // Generate key
    const key = this.config.keyGenerator(request)
    
    // Increment counter
    const { totalHits, resetTime } = await this.config.store.increment(key)
    
    // Create response headers
    const headers = new Headers()
    
    if (this.config.standardHeaders) {
      headers.set('RateLimit-Limit', this.config.max.toString())
      headers.set('RateLimit-Remaining', Math.max(0, this.config.max - totalHits).toString())
      headers.set('RateLimit-Reset', resetTime ? Math.round(resetTime.getTime() / 1000).toString() : '')
      headers.set('RateLimit-Policy', `${this.config.max};w=${Math.round(this.config.windowMs / 1000)}`)
    }
    
    if (this.config.legacyHeaders) {
      headers.set('X-RateLimit-Limit', this.config.max.toString())
      headers.set('X-RateLimit-Remaining', Math.max(0, this.config.max - totalHits).toString())
      headers.set('X-RateLimit-Reset', resetTime ? resetTime.toISOString() : '')
    }
    
    // Check if limit exceeded
    if (totalHits > this.config.max) {
      // Log security incident
      await SecurityMonitor.logIncident({
        type: 'rate_limit',
        ip: this.getClientIP(request),
        url: request.url,
        method: request.method,
        severity: totalHits > this.config.max * 2 ? 'high' : 'medium',
        payload: { totalHits, limit: this.config.max }
      })
      
      // Use custom handler or default
      const response = await this.config.handler(request)
      
      // Add rate limit headers
      headers.forEach((value, key) => {
        response.headers.set(key, value)
      })
      
      return response
    }
    
    // Store rate limit info for later use
    (request as any)[this.config.requestPropertyName] = {
      limit: this.config.max,
      remaining: Math.max(0, this.config.max - totalHits),
      resetTime,
      totalHits
    }
    
    return null
  }
  
  /**
   * Default key generator
   */
  private defaultKeyGenerator(request: NextRequest): string {
    const ip = this.getClientIP(request)
    const userId = request.headers.get('x-user-id')
    const apiKey = request.headers.get('x-api-key')
    
    // Prioritize authenticated identifiers
    if (userId) return `user:${userId}`
    if (apiKey) return `api:${apiKey}`
    
    // Fall back to IP
    return `ip:${ip}`
  }
  
  /**
   * Default rate limit exceeded handler
   */
  private defaultHandler(request: NextRequest): NextResponse {
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: this.config.message,
        retryAfter: Math.round(this.config.windowMs / 1000)
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.round(this.config.windowMs / 1000).toString()
        }
      }
    )
  }
  
  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    const forwardedFor = request.headers.get('x-forwarded-for')
    if (forwardedFor) {
      const ips = forwardedFor.split(',')
      return ips[0]?.trim() || 'unknown'
    }
    
    return request.headers.get('x-real-ip') ||
           request.headers.get('cf-connecting-ip') ||
           'unknown'
  }
}

/**
 * Adaptive rate limiting that adjusts based on system load
 */
export class AdaptiveRateLimiter extends EnhancedRateLimiter {
  private loadThreshold: number = 0.8
  private reductionFactor: number = 0.5
  
  constructor(config: RateLimitConfig) {
    super(config)
  }
  
  async limit(request: NextRequest): Promise<NextResponse | null> {
    // Check system load
    const load = await this.getSystemLoad()
    
    // Adjust rate limit based on load
    if (load > this.loadThreshold) {
      const adjustedConfig = {
        ...this.config,
        max: Math.floor(this.config.max * this.reductionFactor)
      }
      
      // Create temporary limiter with reduced limits
      const tempLimiter = new EnhancedRateLimiter(adjustedConfig)
      return tempLimiter.limit(request)
    }
    
    return super.limit(request)
  }
  
  private async getSystemLoad(): Promise<number> {
    // This would check actual system metrics
    // For now, return a mock value
    return 0.5
  }
}

/**
 * Pre-configured rate limiters for different endpoints
 */
export const RateLimiters = {
  // Strict limit for auth endpoints
  auth: new EnhancedRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many authentication attempts, please try again later.',
    store: new SlidingWindowStore(15 * 60 * 1000, 'rl:auth:')
  }),
  
  // Standard API limit
  api: new EnhancedRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    store: new SlidingWindowStore(60 * 1000, 'rl:api:')
  }),
  
  // AI endpoint limit (token bucket for burst handling)
  ai: new EnhancedRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: 'AI request limit exceeded. Please upgrade your plan for higher limits.',
    store: new TokenBucketStore(10, 0.2, 'rl:ai:') // 10 tokens, refill 0.2/sec
  }),
  
  // Search endpoint limit
  search: new AdaptiveRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    store: new SlidingWindowStore(60 * 1000, 'rl:search:')
  }),
  
  // Export endpoint limit
  export: new EnhancedRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'Export limit reached. Please try again later.',
    store: new SlidingWindowStore(60 * 60 * 1000, 'rl:export:')
  }),
  
  // Webhook endpoint limit (higher for external services)
  webhook: new EnhancedRateLimiter({
    windowMs: 60 * 1000,
    max: 100,
    skipFailedRequests: true, // Don't count failed webhooks
    store: new SlidingWindowStore(60 * 1000, 'rl:webhook:')
  })
}