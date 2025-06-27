import { kv } from '@vercel/kv'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

export interface APIKey {
  id: string
  key: string
  name: string
  userId: string
  permissions: string[]
  rateLimit?: {
    requests: number
    window: number
  }
  metadata?: Record<string, any>
  createdAt: Date
  lastUsedAt?: Date
  expiresAt?: Date
  active: boolean
}

export interface APIKeyUsage {
  keyId: string
  requests: number
  lastRequest: Date
  endpoints: Record<string, number>
}

export class APIKeyManager {
  private readonly prefix = 'apikey'

  /**
   * Generate a new API key
   */
  generateKey(): string {
    return `pk_${crypto.randomBytes(32).toString('hex')}`
  }

  /**
   * Hash an API key for storage
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex')
  }

  /**
   * Create a new API key
   */
  async createAPIKey(
    userId: string,
    name: string,
    permissions: string[] = ['read'],
    expiresInDays?: number
  ): Promise<{ apiKey: APIKey; plainKey: string }> {
    const plainKey = this.generateKey()
    const hashedKey = this.hashKey(plainKey)
    const keyId = crypto.randomUUID()

    const apiKey: APIKey = {
      id: keyId,
      key: hashedKey,
      name,
      userId,
      permissions,
      createdAt: new Date(),
      active: true,
      ...(expiresInDays && {
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      })
    }

    // Store the API key
    await kv.hset(`${this.prefix}:${hashedKey}`, apiKey as unknown as Record<string, unknown>)
    
    // Store user's API keys list
    await kv.sadd(`${this.prefix}:user:${userId}`, keyId)
    
    // Set expiration if specified
    if (apiKey.expiresAt) {
      const ttl = Math.floor((apiKey.expiresAt.getTime() - Date.now()) / 1000)
      await kv.expire(`${this.prefix}:${hashedKey}`, ttl)
    }

    return { apiKey, plainKey }
  }

  /**
   * Validate an API key
   */
  async validateAPIKey(plainKey: string): Promise<APIKey | null> {
    const hashedKey = this.hashKey(plainKey)
    const apiKey = await kv.hgetall(`${this.prefix}:${hashedKey}`) as APIKey | null

    if (!apiKey || !apiKey.active) {
      return null
    }

    // Check expiration
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      await this.revokeAPIKey(apiKey.id)
      return null
    }

    // Update last used timestamp
    await kv.hset(`${this.prefix}:${hashedKey}`, {
      lastUsedAt: new Date()
    })

    // Track usage
    await this.trackUsage(apiKey.id)

    return apiKey
  }

  /**
   * Track API key usage
   */
  private async trackUsage(keyId: string, endpoint?: string): Promise<void> {
    const usageKey = `${this.prefix}:usage:${keyId}`
    const today = new Date().toISOString().split('T')[0]!
    
    // Increment daily counter
    await kv.hincrby(usageKey, today, 1)
    
    // Track endpoint usage
    if (endpoint) {
      await kv.hincrby(`${usageKey}:endpoints`, endpoint, 1)
    }
    
    // Set expiration for usage data (30 days)
    await kv.expire(usageKey, 30 * 24 * 60 * 60)
  }

  /**
   * Get API keys for a user
   */
  async getUserAPIKeys(userId: string): Promise<APIKey[]> {
    const keyIds = await kv.smembers(`${this.prefix}:user:${userId}`) as string[]
    const keys: APIKey[] = []

    for (const keyId of keyIds) {
      // Find the key by scanning (in production, maintain a reverse index)
      const pattern = `${this.prefix}:*`
      const scanResult = await kv.scan(0, { match: pattern, count: 100 })
      
      for (const key of scanResult[1]) {
        const apiKey = await kv.hgetall(key as string) as APIKey | null
        if (apiKey && apiKey.id === keyId) {
          // Don't return the hashed key
          keys.push({ ...apiKey, key: '***' })
          break
        }
      }
    }

    return keys.filter(key => key.active)
  }

  /**
   * Revoke an API key
   */
  async revokeAPIKey(keyId: string): Promise<boolean> {
    // Find the key (in production, maintain a reverse index)
    const pattern = `${this.prefix}:*`
    const scanResult = await kv.scan(0, { match: pattern, count: 100 })
    
    for (const key of scanResult[1]) {
      const apiKey = await kv.hgetall(key as string) as APIKey | null
      if (apiKey && apiKey.id === keyId) {
        // Mark as inactive
        await kv.hset(key, { active: false })
        
        // Remove from user's list
        await kv.srem(`${this.prefix}:user:${apiKey.userId}`, keyId)
        
        return true
      }
    }

    return false
  }

  /**
   * Check if API key has permission
   */
  hasPermission(apiKey: APIKey, permission: string): boolean {
    return apiKey.permissions.includes(permission) || apiKey.permissions.includes('*')
  }

  /**
   * Get API key usage statistics
   */
  async getUsageStats(keyId: string, days: number = 7): Promise<APIKeyUsage | null> {
    const usageKey = `${this.prefix}:usage:${keyId}`
    const endpointsKey = `${usageKey}:endpoints`
    
    let totalRequests = 0
    const dates: string[] = []
    
    // Generate date range
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0]!)
    }
    
    // Get usage for each day
    for (const date of dates) {
      const count = await kv.hget<number>(usageKey, date) || 0
      totalRequests += count
    }
    
    // Get endpoint usage
    const endpoints = await kv.hgetall(endpointsKey) as Record<string, number> | null || {}
    
    return {
      keyId,
      requests: totalRequests,
      lastRequest: new Date(),
      endpoints
    }
  }

  /**
   * Rotate an API key
   */
  async rotateAPIKey(keyId: string): Promise<{ apiKey: APIKey; plainKey: string } | null> {
    // Find the existing key
    const pattern = `${this.prefix}:*`
    const scanResult = await kv.scan(0, { match: pattern, count: 100 })
    
    for (const key of scanResult[1]) {
      const apiKey = await kv.hgetall(key as string) as APIKey | null
      if (apiKey && apiKey.id === keyId && apiKey.active) {
        // Revoke the old key
        await this.revokeAPIKey(keyId)
        
        // Create a new key with same permissions
        return await this.createAPIKey(
          apiKey.userId,
          `${apiKey.name} (rotated)`,
          apiKey.permissions
        )
      }
    }
    
    return null
  }
}

// Middleware function to validate API key from request
export async function validateAPIKeyMiddleware(
  request: NextRequest,
  requiredPermission?: string
): Promise<{ valid: boolean; apiKey?: APIKey; error?: string }> {
  const apiKeyHeader = request.headers.get('x-api-key')
  const apiKeyQuery = request.nextUrl.searchParams.get('api_key')
  
  const providedKey = apiKeyHeader || apiKeyQuery
  
  if (!providedKey) {
    return { valid: false, error: 'API key required' }
  }
  
  const manager = new APIKeyManager()
  const apiKey = await manager.validateAPIKey(providedKey)
  
  if (!apiKey) {
    return { valid: false, error: 'Invalid API key' }
  }
  
  if (requiredPermission && !manager.hasPermission(apiKey, requiredPermission)) {
    return { valid: false, error: 'Insufficient permissions' }
  }
  
  return { valid: true, apiKey }
}

// Permission constants
export const API_PERMISSIONS = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  ADMIN: 'admin',
  ANALYTICS: 'analytics',
  EXPORT: 'export',
  WEBHOOK: 'webhook'
} as const