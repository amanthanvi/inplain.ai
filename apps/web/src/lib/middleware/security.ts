import { NextRequest, NextResponse } from 'next/server'

export interface SecurityConfig {
  enableCORS?: boolean
  allowedOrigins?: string[]
  enableCSP?: boolean
  enableHSTS?: boolean
  enableXFrameOptions?: boolean
  enableXContentTypeOptions?: boolean
  enableReferrerPolicy?: boolean
  enablePermissionsPolicy?: boolean
}

const defaultConfig: SecurityConfig = {
  enableCORS: true,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['https://inplain.ai'],
  enableCSP: true,
  enableHSTS: true,
  enableXFrameOptions: true,
  enableXContentTypeOptions: true,
  enableReferrerPolicy: true,
  enablePermissionsPolicy: true
}

export class SecurityMiddleware {
  private config: SecurityConfig

  constructor(config?: SecurityConfig) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Apply security headers to response
   */
  async applySecurityHeaders(
    request: NextRequest,
    response: NextResponse
  ): Promise<NextResponse> {
    const origin = request.headers.get('origin') || ''

    // CORS headers
    if (this.config.enableCORS && this.config.allowedOrigins) {
      if (this.config.allowedOrigins.includes(origin) || this.config.allowedOrigins.includes('*')) {
        response.headers.set('Access-Control-Allow-Origin', origin || '*')
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.set('Access-Control-Max-Age', '86400')
      }
    }

    // Content Security Policy
    if (this.config.enableCSP) {
      const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.accounts.dev https://clerk.inplain.ai https://challenges.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https: http:",
        "connect-src 'self' https://clerk.com https://*.clerk.accounts.dev https://clerk.inplain.ai https://api.clerk.com https://api.openrouter.ai wss://*.clerk.accounts.dev",
        "frame-src 'self' https://clerk.com https://*.clerk.accounts.dev https://clerk.inplain.ai https://challenges.cloudflare.com",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
      ].join('; ')
      
      response.headers.set('Content-Security-Policy', csp)
    }

    // HTTP Strict Transport Security
    if (this.config.enableHSTS) {
      response.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      )
    }

    // X-Frame-Options
    if (this.config.enableXFrameOptions) {
      response.headers.set('X-Frame-Options', 'DENY')
    }

    // X-Content-Type-Options
    if (this.config.enableXContentTypeOptions) {
      response.headers.set('X-Content-Type-Options', 'nosniff')
    }

    // Referrer Policy
    if (this.config.enableReferrerPolicy) {
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    }

    // Permissions Policy
    if (this.config.enablePermissionsPolicy) {
      response.headers.set(
        'Permissions-Policy',
        'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
      )
    }

    // Remove potentially dangerous headers
    response.headers.delete('X-Powered-By')
    response.headers.delete('Server')

    return response
  }

  /**
   * Validate request method
   */
  validateMethod(request: NextRequest, allowedMethods: string[]): boolean {
    return allowedMethods.includes(request.method)
  }

  /**
   * Validate content type
   */
  validateContentType(request: NextRequest, allowedTypes: string[]): boolean {
    const contentType = request.headers.get('content-type')
    if (!contentType) return false
    
    return allowedTypes.some(type => contentType.includes(type))
  }

  /**
   * Check for common attack patterns
   */
  detectAttackPatterns(request: NextRequest): boolean {
    const url = request.url
    const body = request.body

    // Check for SQL injection patterns
    const sqlInjectionPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|script)\b)/i,
      /(--|\/\*|\*\/|xp_|sp_)/i,
      /(\bor\b\s*\d+\s*=\s*\d+|\band\b\s*\d+\s*=\s*\d+)/i
    ]

    // Check for XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe|<object|<embed/gi
    ]

    // Check for path traversal
    const pathTraversalPatterns = [
      /\.\.\//g,
      /\.\.%2[fF]/g,
      /%2e%2e%2f/gi
    ]

    const patterns = [...sqlInjectionPatterns, ...xssPatterns, ...pathTraversalPatterns]
    
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        return true
      }
    }

    return false
  }

  /**
   * Sanitize user input
   */
  sanitizeInput(input: string): string {
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '')
    
    // Escape HTML special characters
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
    
    // Remove potential script tags
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    
    // Trim whitespace
    sanitized = sanitized.trim()
    
    return sanitized
  }
}

// Default security middleware instance
export const securityMiddleware = new SecurityMiddleware()

/**
 * API Key validation
 */
export async function validateAPIKey(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) return false

  // In production, validate against stored API keys
  // For now, check against environment variable
  const validApiKey = process.env.API_KEY
  return apiKey === validApiKey
}

/**
 * IP-based access control
 */
export async function checkIPAccess(request: NextRequest): Promise<boolean> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             request.headers.get('cf-connecting-ip')

  if (!ip) return true // Allow if we can't determine IP

  // Check against blocklist (implement in production)
  const blockedIPs = process.env.BLOCKED_IPS?.split(',') || []
  if (blockedIPs.includes(ip)) {
    return false
  }

  // Check against allowlist for sensitive endpoints
  const sensitiveEndpoints = ['/api/admin', '/api/internal']
  const isRestrictedEndpoint = sensitiveEndpoints.some(endpoint => 
    request.nextUrl.pathname.startsWith(endpoint)
  )

  if (isRestrictedEndpoint) {
    const allowedIPs = process.env.ALLOWED_IPS?.split(',') || []
    return allowedIPs.includes(ip)
  }

  return true
}

/**
 * Request size limiting
 */
export function checkRequestSize(request: NextRequest, maxSizeBytes: number = 1048576): boolean {
  const contentLength = request.headers.get('content-length')
  if (!contentLength) return true
  
  return parseInt(contentLength) <= maxSizeBytes
}