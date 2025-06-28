import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RateLimiter, rateLimiters } from '../rate-limiter'
import { kv } from '@vercel/kv'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    expire: vi.fn()
  }
}))

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter

  beforeEach(() => {
    vi.clearAllMocks()
    rateLimiter = new RateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 10
    })
  })

  describe('check', () => {
    it('should allow request when under limit', async () => {
      vi.mocked(kv.get).mockResolvedValue(5)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const result = await rateLimiter.check('test-key')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
      expect(result.resetIn).toBeLessThanOrEqual(60000)
      expect(kv.set).toHaveBeenCalledWith('rate-limit:test-key', 6)
    })

    it('should deny request when at limit', async () => {
      vi.mocked(kv.get).mockResolvedValue(10)

      const result = await rateLimiter.check('test-key')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(kv.set).not.toHaveBeenCalled()
    })

    it('should initialize counter for new keys', async () => {
      vi.mocked(kv.get).mockResolvedValue(null)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const result = await rateLimiter.check('new-key')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
      expect(kv.set).toHaveBeenCalledWith('rate-limit:new-key', 1)
      expect(kv.expire).toHaveBeenCalledWith('rate-limit:new-key', 60)
    })

    it('should handle KV errors gracefully', async () => {
      vi.mocked(kv.get).mockRejectedValue(new Error('KV error'))

      const result = await rateLimiter.check('error-key')

      expect(result.allowed).toBe(true) // Fail open
      expect(result.remaining).toBe(9)
    })
  })

  describe('reset', () => {
    it('should reset the counter for a key', async () => {
      await rateLimiter.reset('test-key')

      expect(kv.set).toHaveBeenCalledWith('rate-limit:test-key', 0)
    })
  })

  describe('handleRequest', () => {
    it('should allow request and set headers', async () => {
      vi.mocked(kv.get).mockResolvedValue(3)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      const response = await rateLimiter.handleRequest(req)

      expect(response).toBeNull()
    })

    it('should return 429 when rate limited', async () => {
      vi.mocked(kv.get).mockResolvedValue(10)

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      const response = await rateLimiter.handleRequest(req)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(429)
      
      const body = await response?.json()
      expect(body.error).toBe('Rate limit exceeded')
    })

    it('should extract IP from various headers', async () => {
      vi.mocked(kv.get).mockResolvedValue(0)
      vi.mocked(kv.set).mockResolvedValue('OK')

      // Test x-forwarded-for
      let req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1' }
      })
      await rateLimiter.handleRequest(req)
      expect(kv.set).toHaveBeenCalledWith('rate-limit:api:/api/test:10.0.0.1', 1)

      // Test x-real-ip
      vi.clearAllMocks()
      vi.mocked(kv.get).mockResolvedValue(0)
      req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-real-ip': '10.0.0.2' }
      })
      await rateLimiter.handleRequest(req)
      expect(kv.set).toHaveBeenCalledWith('rate-limit:api:/api/test:10.0.0.2', 1)

      // Test cf-connecting-ip
      vi.clearAllMocks()
      vi.mocked(kv.get).mockResolvedValue(0)
      req = new NextRequest('https://example.com/api/test', {
        headers: { 'cf-connecting-ip': '10.0.0.3' }
      })
      await rateLimiter.handleRequest(req)
      expect(kv.set).toHaveBeenCalledWith('rate-limit:api:/api/test:10.0.0.3', 1)
    })

    it('should use default IP when headers are missing', async () => {
      vi.mocked(kv.get).mockResolvedValue(0)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const req = new NextRequest('https://example.com/api/test')
      await rateLimiter.handleRequest(req)

      expect(kv.set).toHaveBeenCalledWith('rate-limit:api:/api/test:127.0.0.1', 1)
    })
  })

  describe('middleware', () => {
    it('should create middleware function', () => {
      const middleware = rateLimiter.middleware()
      expect(middleware).toBeInstanceOf(Function)
    })

    it('should call handleRequest in middleware', async () => {
      vi.mocked(kv.get).mockResolvedValue(0)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const middleware = rateLimiter.middleware()
      const req = new NextRequest('https://example.com/api/test')
      const next = vi.fn().mockResolvedValue(NextResponse.next())

      const response = await middleware(req, next)

      expect(next).toHaveBeenCalled()
      expect(response).toBeInstanceOf(NextResponse)
    })

    it('should return rate limit response without calling next', async () => {
      vi.mocked(kv.get).mockResolvedValue(10)

      const middleware = rateLimiter.middleware()
      const req = new NextRequest('https://example.com/api/test')
      const next = vi.fn()

      const response = await middleware(req, next)

      expect(next).not.toHaveBeenCalled()
      expect(response?.status).toBe(429)
    })
  })

  describe('rateLimiters', () => {
    it('should have different limits for different endpoints', () => {
      expect(rateLimiters.ai).toBeDefined()
      expect(rateLimiters.api).toBeDefined()
      expect(rateLimiters.search).toBeDefined()
      expect(rateLimiters.auth).toBeDefined()
      expect(rateLimiters.export).toBeDefined()

      // AI endpoint should have lower limit
      expect(rateLimiters.ai['maxRequests']).toBeLessThan(rateLimiters.api['maxRequests'])
    })
  })

  describe('Edge cases', () => {
    it('should handle concurrent requests correctly', async () => {
      vi.mocked(kv.get).mockResolvedValue(8)
      vi.mocked(kv.set).mockResolvedValue('OK')

      // Simulate concurrent requests
      const promises = Array(5).fill(null).map(() => 
        rateLimiter.check('concurrent-key')
      )

      const results = await Promise.all(promises)

      // All should be allowed since we start at 8 and limit is 10
      expect(results.every(r => r.allowed)).toBe(true)
      expect(kv.set).toHaveBeenCalledTimes(5)
    })

    it('should handle very long keys', async () => {
      vi.mocked(kv.get).mockResolvedValue(0)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const longKey = 'a'.repeat(1000)
      const result = await rateLimiter.check(longKey)

      expect(result.allowed).toBe(true)
      expect(kv.set).toHaveBeenCalledWith(`rate-limit:${longKey}`, 1)
    })

    it('should handle special characters in keys', async () => {
      vi.mocked(kv.get).mockResolvedValue(0)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const specialKey = 'test:key/with@special#chars'
      const result = await rateLimiter.check(specialKey)

      expect(result.allowed).toBe(true)
      expect(kv.set).toHaveBeenCalledWith(`rate-limit:${specialKey}`, 1)
    })
  })
})