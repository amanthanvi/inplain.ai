/**
 * Input validation and sanitization utilities
 */

import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

// Common validation schemas
export const schemas = {
  // IDs and identifiers
  uuid: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  id: z.string().min(1).max(100),
  
  // User input
  email: z.string().email().max(255),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(100),
  
  // Text content
  shortText: z.string().min(1).max(255),
  mediumText: z.string().min(1).max(1000),
  longText: z.string().min(1).max(10000),
  
  // URLs and paths
  url: z.string().url(),
  path: z.string().regex(/^\/[a-zA-Z0-9/_-]*$/),
  
  // Numbers
  positiveInt: z.number().int().positive(),
  percentage: z.number().min(0).max(100),
  
  // Dates
  date: z.date(),
  dateString: z.string().datetime(),
  
  // Common query parameters
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
  
  // File uploads
  fileSize: z.number().max(10 * 1024 * 1024), // 10MB
  mimeType: z.enum([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv'
  ])
}

// SQL injection prevention patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|script)\b)/i,
  /(--|\/\*|\*\/|xp_|sp_)/i,
  /(\bor\b\s*\d+\s*=\s*\d+|\band\b\s*\d+\s*=\s*\d+)/i,
  /[';]--/,
  /\b(char|nchar|varchar|nvarchar|cast|convert|exec|execute)\s*\(/i
]

// XSS prevention patterns
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe|<object|<embed/gi,
  /vbscript:/gi,
  /data:text\/html/gi
]

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.%2[fF]/g,
  /%2e%2e%2f/gi,
  /\.\.\\|\.\.%5[cC]/g
]

/**
 * Sanitize HTML content
 */
export function sanitizeHTML(html: string, options?: any): string {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    ...options
  })
  // DOMPurify returns TrustedHTML in some environments, convert to string
  return typeof sanitized === 'string' ? sanitized : sanitized.toString()
}

/**
 * Escape HTML special characters
 */
export function escapeHTML(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  }
  
  return text.replace(/[&<>"'/]/g, (char) => map[char] || char)
}

/**
 * Check for SQL injection patterns
 */
export function detectSQLInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input))
}

/**
 * Check for XSS patterns
 */
export function detectXSS(input: string): boolean {
  return XSS_PATTERNS.some(pattern => pattern.test(input))
}

/**
 * Check for path traversal attempts
 */
export function detectPathTraversal(input: string): boolean {
  return PATH_TRAVERSAL_PATTERNS.some(pattern => pattern.test(input))
}

/**
 * Validate and sanitize user input
 */
export function validateInput(
  input: unknown,
  schema: z.ZodSchema,
  options?: {
    sanitize?: boolean
    detectInjection?: boolean
  }
): { success: boolean; data?: any; error?: string } {
  try {
    // Parse with Zod schema
    const parsed = schema.parse(input)
    
    // Additional security checks for strings
    if (typeof parsed === 'string' && options?.detectInjection) {
      if (detectSQLInjection(parsed)) {
        return { success: false, error: 'Invalid input detected (SQL)' }
      }
      if (detectXSS(parsed)) {
        return { success: false, error: 'Invalid input detected (XSS)' }
      }
      if (detectPathTraversal(parsed)) {
        return { success: false, error: 'Invalid input detected (Path)' }
      }
    }
    
    // Sanitize if requested
    let data = parsed
    if (typeof parsed === 'string' && options?.sanitize) {
      data = escapeHTML(parsed)
    }
    
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors.map(e => e.message).join(', ')
      }
    }
    return { success: false, error: 'Invalid input' }
  }
}

/**
 * Rate limiting helper
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private readonly windowMs: number
  private readonly maxRequests: number
  private cleanupInterval?: NodeJS.Timeout

  constructor(windowMs: number = 60000, maxRequests: number = 60) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    
    // Clean up old entries periodically
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), windowMs)
    }
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(identifier) || []
    
    // Filter out old requests
    const recentRequests = requests.filter(time => now - time < this.windowMs)
    
    if (recentRequests.length >= this.maxRequests) {
      return false
    }
    
    // Add current request
    recentRequests.push(now)
    this.requests.set(identifier, recentRequests)
    
    return true
  }

  private cleanup() {
    const now = Date.now()
    
    for (const [identifier, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(time => now - time < this.windowMs)
      
      if (recentRequests.length === 0) {
        this.requests.delete(identifier)
      } else {
        this.requests.set(identifier, recentRequests)
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

/**
 * API key validation
 */
export function validateAPIKey(
  key: string,
  pattern: RegExp = /^[a-zA-Z0-9_-]{32,}$/
): boolean {
  return pattern.test(key)
}

/**
 * Secure random token generation
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  
  const randomValues = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues)
  } else {
    // Fallback for Node.js
    const { randomBytes } = require('crypto')
    randomValues.set(randomBytes(length))
  }
  
  for (let i = 0; i < length; i++) {
    token += chars[randomValues[i]! % chars.length]
  }
  
  return token
}

/**
 * Content type validation
 */
export function validateContentType(
  request: Request,
  allowedTypes: string[]
): boolean {
  const contentType = request.headers.get('content-type')
  if (!contentType) return false
  
  return allowedTypes.some(type => 
    contentType.toLowerCase().includes(type.toLowerCase())
  )
}

/**
 * File upload validation
 */
export interface FileValidationOptions {
  maxSize?: number
  allowedTypes?: string[]
  allowedExtensions?: string[]
}

export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): { valid: boolean; error?: string } {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  } = options
  
  // Check file size
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB` 
    }
  }
  
  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: `File type ${file.type} is not allowed` 
    }
  }
  
  // Check file extension
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
  if (!allowedExtensions.includes(extension)) {
    return { 
      valid: false, 
      error: `File extension ${extension} is not allowed` 
    }
  }
  
  return { valid: true }
}