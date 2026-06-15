import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RateLimiter,
  rateLimiters,
  createRateLimitResponse,
  getRateLimitHeaders,
} from '../rate-limiter'
import { kv } from '@vercel/kv'
import { NextRequest } from 'next/server'

vi.mock('@vercel/kv', () => ({
  kv: {
    incr: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
  },
}))

const now = new Date('2026-06-15T00:00:00Z')
const windowMs = 60_000
const windowBucket = Math.floor(now.getTime() / windowMs)

function request(headers: Record<string, string> = {}) {
  return new NextRequest('https://example.com/api/test', { headers })
}

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.clearAllMocks()
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    rateLimiter = new RateLimiter({
      windowMs,
      maxRequests: 10,
      keyPrefix: 'test',
    })
  })

  afterEach(() => {
    consoleError.mockRestore()
    vi.useRealTimers()
  })

  it('allows requests below the configured limit', async () => {
    vi.mocked(kv.incr).mockResolvedValue(6)

    const result = await rateLimiter.checkLimit(request({ 'x-forwarded-for': '192.0.2.1' }))

    expect(result).toMatchObject({
      success: true,
      limit: 10,
      remaining: 4,
      reset: new Date(now.getTime() + windowMs),
    })
    expect(kv.incr).toHaveBeenCalledWith(`test:ip:192.0.2.1:${windowBucket}`)
    expect(kv.expire).not.toHaveBeenCalled()
  })

  it('sets key expiry for a new bucket', async () => {
    vi.mocked(kv.incr).mockResolvedValue(1)

    await rateLimiter.checkLimit(request({ 'x-real-ip': '192.0.2.2' }))

    expect(kv.expire).toHaveBeenCalledWith(`test:ip:192.0.2.2:${windowBucket}`, 60)
  })

  it('denies requests above the configured limit', async () => {
    vi.mocked(kv.incr).mockResolvedValue(11)

    const result = await rateLimiter.checkLimit(request({ 'cf-connecting-ip': '192.0.2.3' }))

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBe(60)
  })

  it('uses authenticated user id when provided', async () => {
    vi.mocked(kv.incr).mockResolvedValue(1)

    await rateLimiter.checkLimit(request({ 'x-forwarded-for': '192.0.2.4' }), 'user_123')

    expect(kv.incr).toHaveBeenCalledWith(`test:user:user_123:${windowBucket}`)
  })

  it('fails open if KV is unavailable', async () => {
    vi.mocked(kv.incr).mockRejectedValue(new Error('KV down'))

    const result = await rateLimiter.checkLimit(request())

    expect(result).toMatchObject({
      success: true,
      limit: 10,
      remaining: 10,
    })
    expect(consoleError).toHaveBeenCalled()
  })

  it('resets the current bucket for an identifier', async () => {
    await rateLimiter.reset('ip:192.0.2.5')

    expect(kv.del).toHaveBeenCalledWith(`test:ip:192.0.2.5:${windowBucket}`)
  })

  it('exports isolated buckets for predefined endpoint groups', () => {
    const configs = {
      ai: (rateLimiters.ai as unknown as { config: { maxRequests: number; keyPrefix: string } }).config,
      api: (rateLimiters.api as unknown as { config: { maxRequests: number; keyPrefix: string } }).config,
      search: (rateLimiters.search as unknown as { config: { maxRequests: number; keyPrefix: string } }).config,
      auth: (rateLimiters.auth as unknown as { config: { maxRequests: number; keyPrefix: string } }).config,
      export: (rateLimiters.export as unknown as { config: { maxRequests: number; keyPrefix: string } }).config,
      webhook: (rateLimiters.webhook as unknown as { config: { maxRequests: number; keyPrefix: string } }).config,
    }

    expect(configs.ai.maxRequests).toBe(5)
    expect(configs.ai.maxRequests).toBeLessThan(configs.api.maxRequests)
    expect(new Set(Object.values(configs).map((config) => config.keyPrefix)).size).toBe(6)
  })

  it('builds rate limit headers and responses', async () => {
    const reset = new Date(now.getTime() + windowMs)
    const result = { success: false, limit: 5, remaining: 0, reset, retryAfter: 60 }

    expect(getRateLimitHeaders(result)).toMatchObject({
      'X-RateLimit-Limit': '5',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': reset.toISOString(),
      'Retry-After': '60',
    })

    const response = createRateLimitResponse(result)
    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Too many requests',
      retryAfter: 60,
    })
  })
})
