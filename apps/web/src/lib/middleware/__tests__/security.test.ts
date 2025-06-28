import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SecurityMiddleware } from '../security'
import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    sadd: vi.fn(),
    smembers: vi.fn(),
    expire: vi.fn()
  }
}))

describe('SecurityMiddleware', () => {
  let security: SecurityMiddleware

  beforeEach(() => {
    vi.clearAllMocks()
    security = new SecurityMiddleware()
  })

  describe('setSecurityHeaders', () => {
    it('should set all security headers', () => {
      const response = NextResponse.next()
      const updatedResponse = security.setSecurityHeaders(response)

      const headers = updatedResponse.headers
      expect(headers.get('X-DNS-Prefetch-Control')).toBe('on')
      expect(headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload')
      expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
      expect(headers.get('X-XSS-Protection')).toBe('1; mode=block')
      expect(headers.get('Permissions-Policy')).toContain('camera=()')
    })

    it('should set Content-Security-Policy header', () => {
      const response = NextResponse.next()
      const updatedResponse = security.setSecurityHeaders(response)

      const csp = updatedResponse.headers.get('Content-Security-Policy')
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("script-src 'self' 'unsafe-eval' 'unsafe-inline'")
      expect(csp).toContain("style-src 'self' 'unsafe-inline'")
      expect(csp).toContain("img-src 'self' data: https:")
      expect(csp).toContain("connect-src 'self'")
    })
  })

  describe('detectAttackPatterns', () => {
    it('should detect SQL injection attempts', () => {
      const maliciousPatterns = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin' --",
        "1; DELETE FROM users",
        "' UNION SELECT * FROM passwords"
      ]

      maliciousPatterns.forEach(pattern => {
        expect(security.detectAttackPatterns(pattern)).toBe(true)
      })
    })

    it('should detect XSS attempts', () => {
      const xssPatterns = [
        "<script>alert('XSS')</script>",
        '<img src=x onerror="alert(1)">',
        "javascript:alert('XSS')",
        "<svg onload=alert(1)>",
        '<iframe src="javascript:alert(1)">'
      ]

      xssPatterns.forEach(pattern => {
        expect(security.detectAttackPatterns(pattern)).toBe(true)
      })
    })

    it('should detect path traversal attempts', () => {
      const traversalPatterns = [
        "../../../etc/passwd",
        "..\\..\\windows\\system32",
        "%2e%2e%2f%2e%2e%2f",
        "....//....//",
        "..%252f..%252f"
      ]

      traversalPatterns.forEach(pattern => {
        expect(security.detectAttackPatterns(pattern)).toBe(true)
      })
    })

    it('should detect command injection attempts', () => {
      const commandPatterns = [
        "; ls -la",
        "| whoami",
        "& net user",
        "`cat /etc/passwd`",
        "$(rm -rf /)"
      ]

      commandPatterns.forEach(pattern => {
        expect(security.detectAttackPatterns(pattern)).toBe(true)
      })
    })

    it('should allow legitimate input', () => {
      const legitimateInputs = [
        "john.doe@example.com",
        "Hello, world!",
        "Product ID: 12345",
        "Search for: coffee shops",
        "User's name"
      ]

      legitimateInputs.forEach(input => {
        expect(security.detectAttackPatterns(input)).toBe(false)
      })
    })
  })

  describe('checkSuspiciousActivity', () => {
    it('should track request patterns', async () => {
      vi.mocked(kv.get).mockResolvedValue(5)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const result = await security.checkSuspiciousActivity('192.168.1.1')

      expect(result).toBe(false)
      expect(kv.set).toHaveBeenCalledWith('security:requests:192.168.1.1', 6)
    })

    it('should detect suspicious activity when threshold exceeded', async () => {
      vi.mocked(kv.get).mockResolvedValue(51) // Over threshold of 50

      const result = await security.checkSuspiciousActivity('192.168.1.1')

      expect(result).toBe(true)
    })

    it('should initialize counter for new IPs', async () => {
      vi.mocked(kv.get).mockResolvedValue(null)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const result = await security.checkSuspiciousActivity('192.168.1.1')

      expect(result).toBe(false)
      expect(kv.set).toHaveBeenCalledWith('security:requests:192.168.1.1', 1)
      expect(kv.expire).toHaveBeenCalledWith('security:requests:192.168.1.1', 300)
    })

    it('should handle KV errors gracefully', async () => {
      vi.mocked(kv.get).mockRejectedValue(new Error('KV error'))

      const result = await security.checkSuspiciousActivity('192.168.1.1')

      expect(result).toBe(false) // Fail open
    })
  })

  describe('blockIP', () => {
    it('should add IP to blocklist', async () => {
      vi.mocked(kv.sadd).mockResolvedValue(1)

      await security.blockIP('192.168.1.1', 'Malicious activity')

      expect(kv.sadd).toHaveBeenCalledWith('security:blocked-ips', '192.168.1.1')
    })
  })

  describe('isIPBlocked', () => {
    it('should check if IP is blocked', async () => {
      vi.mocked(kv.smembers).mockResolvedValue(['192.168.1.1', '10.0.0.1'])

      const blocked = await security.isIPBlocked('192.168.1.1')
      const notBlocked = await security.isIPBlocked('192.168.1.2')

      expect(blocked).toBe(true)
      expect(notBlocked).toBe(false)
    })

    it('should handle empty blocklist', async () => {
      vi.mocked(kv.smembers).mockResolvedValue([])

      const result = await security.isIPBlocked('192.168.1.1')

      expect(result).toBe(false)
    })

    it('should handle KV errors', async () => {
      vi.mocked(kv.smembers).mockRejectedValue(new Error('KV error'))

      const result = await security.isIPBlocked('192.168.1.1')

      expect(result).toBe(false) // Fail open
    })
  })

  describe('handleRequest', () => {
    it('should allow legitimate requests', async () => {
      vi.mocked(kv.smembers).mockResolvedValue([])
      vi.mocked(kv.get).mockResolvedValue(5)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const req = new NextRequest('https://example.com/api/test?q=search+term', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      const response = await security.handleRequest(req)

      expect(response).toBeNull()
    })

    it('should block requests from blocked IPs', async () => {
      vi.mocked(kv.smembers).mockResolvedValue(['192.168.1.1'])

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      const response = await security.handleRequest(req)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(403)
      
      const body = await response?.json()
      expect(body.error).toBe('Access denied')
    })

    it('should block requests with malicious patterns', async () => {
      vi.mocked(kv.smembers).mockResolvedValue([])
      vi.mocked(kv.sadd).mockResolvedValue(1)

      const req = new NextRequest("https://example.com/api/test?q='; DROP TABLE users; --", {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      const response = await security.handleRequest(req)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(400)
      
      const body = await response?.json()
      expect(body.error).toBe('Invalid request')
      
      // Should block the IP
      expect(kv.sadd).toHaveBeenCalledWith('security:blocked-ips', '192.168.1.1')
    })

    it('should check body for attack patterns', async () => {
      vi.mocked(kv.smembers).mockResolvedValue([])
      vi.mocked(kv.sadd).mockResolvedValue(1)

      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: { 
          'x-forwarded-for': '192.168.1.1',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          data: "<script>alert('XSS')</script>"
        })
      })

      const response = await security.handleRequest(req)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(400)
    })

    it('should block suspicious activity', async () => {
      vi.mocked(kv.smembers).mockResolvedValue([])
      vi.mocked(kv.get).mockResolvedValue(51) // Over threshold
      vi.mocked(kv.sadd).mockResolvedValue(1)

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      const response = await security.handleRequest(req)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(429)
      
      const body = await response?.json()
      expect(body.error).toBe('Too many requests')
      
      // Should block the IP
      expect(kv.sadd).toHaveBeenCalledWith('security:blocked-ips', '192.168.1.1')
    })
  })

  describe('middleware', () => {
    it('should create middleware function', () => {
      const middleware = security.middleware()
      expect(middleware).toBeInstanceOf(Function)
    })

    it('should add security headers to response', async () => {
      vi.mocked(kv.smembers).mockResolvedValue([])
      vi.mocked(kv.get).mockResolvedValue(5)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const middleware = security.middleware()
      const req = new NextRequest('https://example.com/api/test')
      const next = vi.fn().mockResolvedValue(NextResponse.next())

      const response = await middleware(req, next)

      expect(next).toHaveBeenCalled()
      expect(response?.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
      expect(response?.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })
  })

  describe('Edge cases', () => {
    it('should handle URLs with special characters', async () => {
      vi.mocked(kv.smembers).mockResolvedValue([])
      vi.mocked(kv.get).mockResolvedValue(0)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const req = new NextRequest('https://example.com/api/test?q=caf%C3%A9+shop', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      const response = await security.handleRequest(req)

      expect(response).toBeNull() // Should allow legitimate encoded characters
    })

    it('should handle large request bodies', async () => {
      vi.mocked(kv.smembers).mockResolvedValue([])
      vi.mocked(kv.get).mockResolvedValue(0)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const largeBody = JSON.stringify({
        data: 'x'.repeat(10000) // Large but legitimate data
      })

      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: { 
          'x-forwarded-for': '192.168.1.1',
          'content-type': 'application/json'
        },
        body: largeBody
      })

      const response = await security.handleRequest(req)

      expect(response).toBeNull() // Should allow large legitimate bodies
    })

    it('should handle malformed JSON gracefully', async () => {
      vi.mocked(kv.smembers).mockResolvedValue([])
      vi.mocked(kv.get).mockResolvedValue(0)
      vi.mocked(kv.set).mockResolvedValue('OK')

      const req = {
        url: 'https://example.com/api/test',
        method: 'POST',
        headers: new Headers({ 
          'x-forwarded-for': '192.168.1.1',
          'content-type': 'application/json'
        }),
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as unknown as NextRequest

      const response = await security.handleRequest(req)

      expect(response).toBeNull() // Should handle JSON errors gracefully
    })
  })
})