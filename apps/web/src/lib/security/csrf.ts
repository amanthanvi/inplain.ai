/**
 * CSRF Protection utilities
 */

import { createHash, randomBytes } from 'crypto'
import { cookies, headers } from 'next/headers'

const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_TOKEN_LENGTH = 32

export interface CSRFConfig {
  cookieName?: string
  headerName?: string
  cookieOptions?: {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
    maxAge?: number
    path?: string
  }
}

const defaultConfig: CSRFConfig = {
  cookieName: CSRF_COOKIE_NAME,
  headerName: CSRF_HEADER_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400, // 24 hours
    path: '/'
  }
}

/**
 * Generate a new CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
}

/**
 * Hash a token for comparison
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Get CSRF token from cookies
 */
export async function getCSRFToken(config: CSRFConfig = {}): Promise<string | null> {
  const { cookieName } = { ...defaultConfig, ...config }
  const cookieStore = await cookies()
  const token = cookieStore.get(cookieName!)?.value
  return token || null
}

/**
 * Set CSRF token in cookies
 */
export async function setCSRFToken(token: string, config: CSRFConfig = {}): Promise<void> {
  const { cookieName, cookieOptions } = { ...defaultConfig, ...config }
  const cookieStore = await cookies()
  
  cookieStore.set(cookieName!, token, {
    ...defaultConfig.cookieOptions,
    ...cookieOptions
  })
}

/**
 * Verify CSRF token
 */
export async function verifyCSRFToken(config: CSRFConfig = {}): Promise<boolean> {
  const { headerName } = { ...defaultConfig, ...config }
  
  // Get token from cookie
  const cookieToken = await getCSRFToken(config)
  if (!cookieToken) {
    return false
  }
  
  // Get token from header
  const headersList = await headers()
  const headerToken = headersList.get(headerName!)
  
  if (!headerToken) {
    // Also check form data for traditional form submissions
    // This would need to be implemented based on your form handling
    return false
  }
  
  // Compare tokens using timing-safe comparison
  return timingSafeEqual(cookieToken, headerToken)
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * CSRF middleware for API routes
 */
export async function csrfProtection(
  request: Request,
  config: CSRFConfig = {}
): Promise<{ valid: boolean; token?: string }> {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const token = await getCSRFToken(config)
    if (!token) {
      const newToken = generateCSRFToken()
      await setCSRFToken(newToken, config)
      return { valid: true, token: newToken }
    }
    return { valid: true, token }
  }
  
  // Verify CSRF token for state-changing methods
  const valid = await verifyCSRFToken(config)
  const token = await getCSRFToken(config)
  
  return { valid, token: token || undefined }
}

/**
 * Double Submit Cookie pattern implementation
 */
export class DoubleSubmitCSRF {
  private config: CSRFConfig

  constructor(config: CSRFConfig = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  async generateToken(): Promise<{ token: string; hashedToken: string }> {
    const token = generateCSRFToken()
    const hashedToken = hashToken(token)
    return { token, hashedToken }
  }

  async setToken(response: Response): Promise<Response> {
    const { token, hashedToken } = await this.generateToken()
    
    // Set the hashed token in cookie
    response.headers.append(
      'Set-Cookie',
      `${this.config.cookieName}=${hashedToken}; ${this.getCookieString()}`
    )
    
    // Return token to be included in response
    const body = await response.json()
    return new Response(
      JSON.stringify({ ...body, csrfToken: token }),
      {
        status: response.status,
        headers: response.headers
      }
    )
  }

  async verifyToken(request: Request): Promise<boolean> {
    const headersList = await headers()
    const cookieStore = await cookies()
    
    // Get hashed token from cookie
    const hashedCookieToken = cookieStore.get(this.config.cookieName!)?.value
    if (!hashedCookieToken) return false
    
    // Get token from header or body
    let headerToken = headersList.get(this.config.headerName!)
    
    if (!headerToken && request.body) {
      try {
        const body = await request.json()
        headerToken = body.csrfToken
      } catch {
        // Body might not be JSON
      }
    }
    
    if (!headerToken) return false
    
    // Hash the header token and compare
    const hashedHeaderToken = hashToken(headerToken)
    return timingSafeEqual(hashedCookieToken, hashedHeaderToken)
  }

  private getCookieString(): string {
    const options = this.config.cookieOptions!
    const parts = []
    
    if (options.httpOnly) parts.push('HttpOnly')
    if (options.secure) parts.push('Secure')
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
    if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`)
    if (options.path) parts.push(`Path=${options.path}`)
    
    return parts.join('; ')
  }
}

/**
 * Synchronizer Token pattern implementation
 */
export class SynchronizerTokenCSRF {
  private config: CSRFConfig
  private sessionTokens: Map<string, string> = new Map()

  constructor(config: CSRFConfig = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  async generateToken(sessionId: string): Promise<string> {
    const token = generateCSRFToken()
    this.sessionTokens.set(sessionId, token)
    
    // In production, store in Redis/KV instead
    setTimeout(() => {
      this.sessionTokens.delete(sessionId)
    }, this.config.cookieOptions?.maxAge! * 1000)
    
    return token
  }

  async verifyToken(sessionId: string, token: string): Promise<boolean> {
    const storedToken = this.sessionTokens.get(sessionId)
    if (!storedToken) return false
    
    const valid = timingSafeEqual(storedToken, token)
    if (valid) {
      // Rotate token after successful verification
      this.sessionTokens.delete(sessionId)
    }
    
    return valid
  }
}