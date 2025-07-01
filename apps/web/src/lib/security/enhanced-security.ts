/**
 * Enhanced Security Configuration for Production
 * 
 * Implements additional security measures and monitoring
 * for production environments
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { kv } from '@/app/api/lib/kv-wrapper'
import { HashUtils } from '@/lib/utils/hash'

/**
 * Security monitoring and incident tracking
 */
export class SecurityMonitor {
  private static readonly INCIDENT_KEY_PREFIX = 'security:incident:'
  private static readonly BLOCKED_IP_PREFIX = 'security:blocked:'
  private static readonly SUSPICIOUS_PATTERN_PREFIX = 'security:pattern:'
  
  /**
   * Log a security incident
   */
  static async logIncident(incident: {
    type: 'sql_injection' | 'xss' | 'path_traversal' | 'rate_limit' | 'auth_failure' | 'suspicious_pattern'
    ip: string
    url: string
    method: string
    userAgent?: string
    payload?: any
    severity: 'low' | 'medium' | 'high' | 'critical'
  }) {
    const incidentId = crypto.randomUUID()
    const timestamp = new Date().toISOString()
    
    const incidentData = {
      id: incidentId,
      ...incident,
      timestamp,
      blocked: incident.severity === 'critical'
    }
    
    // Store incident
    await kv.set(
      `${this.INCIDENT_KEY_PREFIX}${incidentId}`,
      incidentData,
      { ex: 30 * 24 * 60 * 60 } // 30 days retention
    )
    
    // Track incident count by IP
    await kv.incr(`${this.INCIDENT_KEY_PREFIX}count:${incident.ip}`)
    
    // Auto-block IPs with too many incidents
    const incidentCount = await kv.get<number>(`${this.INCIDENT_KEY_PREFIX}count:${incident.ip}`) || 0
    
    if (incidentCount > 10 || incident.severity === 'critical') {
      await this.blockIP(incident.ip, incident.severity === 'critical' ? 'permanent' : 'temporary')
    }
    
    // Log to monitoring
    logger.warn('Security incident detected', incidentData)
    
    // Send alert for critical incidents
    if (incident.severity === 'critical') {
      await this.sendSecurityAlert(incidentData)
    }
    
    return incidentId
  }
  
  /**
   * Block an IP address
   */
  static async blockIP(ip: string, duration: 'temporary' | 'permanent' = 'temporary') {
    const ttl = duration === 'permanent' ? 365 * 24 * 60 * 60 : 24 * 60 * 60 // 1 year or 1 day
    
    await kv.set(
      `${this.BLOCKED_IP_PREFIX}${ip}`,
      {
        blocked: true,
        timestamp: new Date().toISOString(),
        duration
      },
      { ex: ttl }
    )
    
    logger.warn('IP blocked', { ip, duration })
  }
  
  /**
   * Check if an IP is blocked
   */
  static async isIPBlocked(ip: string): Promise<boolean> {
    const blocked = await kv.get(`${this.BLOCKED_IP_PREFIX}${ip}`)
    return !!blocked
  }
  
  /**
   * Send security alert (implement based on notification service)
   */
  private static async sendSecurityAlert(incident: any) {
    // TODO: Implement email/Slack/webhook notification
    logger.error('CRITICAL SECURITY INCIDENT', incident)
  }
}

/**
 * Enhanced CSP configuration for production
 */
export function getProductionCSP(): string {
  const nonce = crypto.randomUUID()
  
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Still need unsafe-inline for Tailwind
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://clerk.com https://*.clerk.accounts.dev https://api.clerk.com https://api.openrouter.ai wss://*.clerk.accounts.dev",
    "frame-src 'self' https://clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "block-all-mixed-content"
  ].join('; ')
}

/**
 * Additional security headers for production
 */
export const PRODUCTION_SECURITY_HEADERS = {
  // OWASP recommended headers
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'X-XSS-Protection': '0', // Disabled in modern browsers, CSP is preferred
  
  // Additional security headers
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  
  // Feature policy (in addition to Permissions-Policy)
  'Feature-Policy': "camera 'none'; microphone 'none'; geolocation 'none'",
  
  // Cache control for security
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
  'Expires': '0'
}

/**
 * Request integrity validation
 */
export class RequestIntegrity {
  /**
   * Generate request signature
   */
  static async generateSignature(
    method: string,
    url: string,
    body: any,
    timestamp: number,
    secret: string
  ): Promise<string> {
    const payload = JSON.stringify({
      method,
      url,
      body,
      timestamp
    })
    
    return HashUtils.hashWithSalt(payload, secret)
  }
  
  /**
   * Validate request signature
   */
  static async validateSignature(
    request: NextRequest,
    secret: string
  ): Promise<boolean> {
    const signature = request.headers.get('x-signature')
    const timestamp = request.headers.get('x-timestamp')
    
    if (!signature || !timestamp) {
      return false
    }
    
    // Check timestamp is within 5 minutes
    const now = Date.now()
    const requestTime = parseInt(timestamp)
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return false
    }
    
    // Validate signature
    const body = await request.text()
    const expectedSignature = await this.generateSignature(
      request.method,
      request.url,
      body,
      requestTime,
      secret
    )
    
    return signature === expectedSignature
  }
}

/**
 * API versioning headers
 */
export function addAPIVersionHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-API-Version', '1.0.0')
  response.headers.set('X-API-Deprecated', 'false')
  response.headers.set('X-RateLimit-Limit', '60')
  response.headers.set('X-RateLimit-Remaining', '59') // This should be dynamic
  response.headers.set('X-RateLimit-Reset', new Date(Date.now() + 60000).toISOString())
  
  return response
}

/**
 * Enhanced input validation
 */
export class InputValidator {
  // Email validation with stricter rules
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailRegex.test(email) && email.length <= 254 // RFC 5321
  }
  
  // URL validation
  static isValidURL(url: string): boolean {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }
  
  // Sanitize HTML content
  static sanitizeHTML(html: string): string {
    // Remove script tags and event handlers
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '')
  }
  
  // Validate and sanitize JSON
  static sanitizeJSON(data: any): any {
    const sanitize = (obj: any): any => {
      if (typeof obj === 'string') {
        return this.sanitizeHTML(obj)
      }
      if (Array.isArray(obj)) {
        return obj.map(sanitize)
      }
      if (obj && typeof obj === 'object') {
        const sanitized: any = {}
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitize(value)
        }
        return sanitized
      }
      return obj
    }
    
    return sanitize(data)
  }
}

/**
 * Security headers middleware enhancer
 */
export function enhanceSecurityHeaders(response: NextResponse): NextResponse {
  // Add production security headers
  Object.entries(PRODUCTION_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  // Add API version headers
  addAPIVersionHeaders(response)
  
  // Add request ID for tracking
  response.headers.set('X-Request-ID', crypto.randomUUID())
  
  return response
}