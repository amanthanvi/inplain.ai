/**
 * Wrapper for Vercel KV with graceful error handling
 * Provides fallback behavior when KV is not configured
 */

import { getEnvVar } from '@/lib/env'

// Type definitions to match @vercel/kv
type KVClient = {
  get: <T = string>(key: string) => Promise<T | null>
  set: (key: string, value: any, options?: { ex?: number; nx?: boolean }) => Promise<string>
  zadd: (key: string, ...members: Array<{ score: number; member: string }>) => Promise<number>
  zrange: <T = string>(key: string, start: number, stop: number) => Promise<T[]>
  del: (...keys: string[]) => Promise<number>
  exists: (...keys: string[]) => Promise<number>
  expire: (key: string, seconds: number) => Promise<number>
  ttl: (key: string) => Promise<number>
}

class MockKVClient implements KVClient {
  private store: Map<string, any> = new Map()
  private expiry: Map<string, number> = new Map()
  private sortedSets: Map<string, Array<{ score: number; member: string }>> = new Map()

  async get<T = string>(key: string): Promise<T | null> {
    // Check if expired
    const expiryTime = this.expiry.get(key)
    if (expiryTime && Date.now() > expiryTime) {
      this.store.delete(key)
      this.expiry.delete(key)
      return null
    }
    
    return this.store.get(key) ?? null
  }

  async set(key: string, value: any, options?: { ex?: number; nx?: boolean }): Promise<string> {
    if (options?.nx && this.store.has(key)) {
      return 'null'
    }
    
    this.store.set(key, value)
    
    if (options?.ex) {
      this.expiry.set(key, Date.now() + (options.ex * 1000))
    }
    
    return 'OK'
  }

  async zadd(key: string, ...members: Array<{ score: number; member: string }>): Promise<number> {
    const set = this.sortedSets.get(key) || []
    
    members.forEach(({ score, member }) => {
      // Remove existing member if present
      const index = set.findIndex(item => item.member === member)
      if (index !== -1) {
        set.splice(index, 1)
      }
      // Add with new score
      set.push({ score, member })
    })
    
    // Sort by score
    set.sort((a, b) => a.score - b.score)
    this.sortedSets.set(key, set)
    
    return members.length
  }

  async zrange<T = string>(key: string, start: number, stop: number): Promise<T[]> {
    const set = this.sortedSets.get(key) || []
    
    // Handle negative indices
    const actualStart = start < 0 ? Math.max(0, set.length + start) : start
    const actualStop = stop < 0 ? set.length + stop : stop
    
    return set
      .slice(actualStart, actualStop + 1)
      .map(item => item.member) as T[]
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0
    keys.forEach(key => {
      if (this.store.delete(key)) {
        deleted++
      }
      this.expiry.delete(key)
      this.sortedSets.delete(key)
    })
    return deleted
  }

  async exists(...keys: string[]): Promise<number> {
    return keys.filter(key => this.store.has(key)).length
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.store.has(key)) return 0
    this.expiry.set(key, Date.now() + (seconds * 1000))
    return 1
  }

  async ttl(key: string): Promise<number> {
    const expiryTime = this.expiry.get(key)
    if (!expiryTime) return -1
    
    const ttl = Math.floor((expiryTime - Date.now()) / 1000)
    return ttl > 0 ? ttl : -2
  }
}

// Singleton instance
let kvInstance: KVClient | null = null
let isConfigured = false
let configError: string | null = null

/**
 * Get KV client instance with automatic fallback
 */
export function getKV(): KVClient {
  if (kvInstance) return kvInstance as KVClient
  
  const kvUrl = getEnvVar('KV_REST_API_URL')
  const kvToken = getEnvVar('KV_REST_API_TOKEN')
  
  if (!kvUrl || !kvToken) {
    console.warn('KV not configured - using in-memory mock (data will not persist)')
    configError = 'KV_REST_API_URL and KV_REST_API_TOKEN not configured'
    kvInstance = new MockKVClient()
    return kvInstance
  }
  
  try {
    // Dynamically import @vercel/kv only if configured
    const { kv } = require('@vercel/kv')
    kvInstance = kv
    isConfigured = true
    return kvInstance as KVClient
  } catch (error) {
    console.error('Failed to initialize KV client:', error)
    console.warn('Falling back to in-memory mock')
    configError = error instanceof Error ? error.message : 'Failed to load @vercel/kv'
    kvInstance = new MockKVClient()
    return kvInstance
  }
}

/**
 * Check if KV is properly configured
 */
export function isKVConfigured(): boolean {
  getKV() // Ensure initialization
  return isConfigured
}

/**
 * Get KV configuration error if any
 */
export function getKVConfigError(): string | null {
  getKV() // Ensure initialization
  return configError
}

/**
 * Export a kv instance that matches the @vercel/kv interface
 */
export const kv = new Proxy({} as KVClient, {
  get(target, prop) {
    const client = getKV()
    return client[prop as keyof KVClient]
  }
})