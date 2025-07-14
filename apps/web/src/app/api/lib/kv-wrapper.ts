/**
 * Wrapper for Vercel KV with graceful error handling
 * Provides fallback behavior when KV is not configured
 */

import { getEnvVar } from '@/lib/env'
import { getKVConfig } from './get-kv-config'

// Type definitions to match @vercel/kv
type KVClient = {
  get: <T = string>(key: string) => Promise<T | null>
  set: (key: string, value: any, options?: { ex?: number; nx?: boolean }) => Promise<string>
  zadd: (key: string, ...members: Array<{ score: number; member: string }>) => Promise<number>
  zrange: (key: string, start: number, stop: number, options?: { withScores?: boolean }) => Promise<Array<[string, number]> | string[]>
  del: (...keys: string[]) => Promise<number>
  exists: (...keys: string[]) => Promise<number>
  expire: (key: string, seconds: number) => Promise<number>
  ttl: (key: string) => Promise<number>
  sadd: (key: string, ...members: string[]) => Promise<number>
  srem: (key: string, ...members: string[]) => Promise<number>
  scard: (key: string) => Promise<number>
  smembers: (key: string) => Promise<string[]>
  hset: (key: string, values: Record<string, unknown>) => Promise<number>
  hgetall: <T = Record<string, unknown>>(key: string) => Promise<T | null>
  pipeline: () => KVPipeline
  lrange: (key: string, start: number, stop: number) => Promise<string[]>
  ltrim: (key: string, start: number, stop: number) => Promise<string>
  lpush: (key: string, ...elements: string[]) => Promise<number>
  incr: (key: string) => Promise<number>
  decr: (key: string) => Promise<number>
  lrem: (key: string, count: number, element: string) => Promise<number>
  zcard: (key: string) => Promise<number>
  keys: (pattern: string) => Promise<string[]>
}

type KVPipeline = {
  get<T = any>(key: string): KVPipeline
  set<T = any>(key: string, value: T, options?: { ex?: number }): KVPipeline
  zadd: (key: string, ...members: Array<{ score: number; member: string }>) => KVPipeline
  hset: (key: string, values: Record<string, unknown>) => KVPipeline
  expire: (key: string, seconds: number) => KVPipeline
  del: (key: string) => KVPipeline
  sadd: (key: string, member: string) => KVPipeline
  srem: (key: string, member: string) => KVPipeline
  exec: () => Promise<Array<any>>
}

class MockKVPipeline implements KVPipeline {
  private commands: Array<() => Promise<any>> = []
  private client: MockKVClient

  constructor(client: MockKVClient) {
    this.client = client
  }

  get<T = any>(key: string): KVPipeline {
    this.commands.push(() => this.client.get<T>(key))
    return this
  }

  set<T = any>(key: string, value: T, options?: { ex?: number }): KVPipeline {
    this.commands.push(() => this.client.set(key, value, options))
    return this
  }

  zadd(key: string, ...members: Array<{ score: number; member: string }>): KVPipeline {
    this.commands.push(() => this.client.zadd(key, ...members))
    return this
  }

  hset(key: string, values: Record<string, unknown>): KVPipeline {
    this.commands.push(() => this.client.hset(key, values))
    return this
  }

  expire(key: string, seconds: number): KVPipeline {
    this.commands.push(() => this.client.expire(key, seconds))
    return this
  }

  del(key: string): KVPipeline {
    this.commands.push(() => this.client.del(key))
    return this
  }

  sadd(key: string, member: string): KVPipeline {
    this.commands.push(() => this.client.sadd(key, member))
    return this
  }

  srem(key: string, member: string): KVPipeline {
    this.commands.push(() => this.client.srem(key, member))
    return this
  }

  async exec(): Promise<Array<any>> {
    const results = []
    for (const command of this.commands) {
      results.push(await command())
    }
    return results
  }
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

  async zrange(key: string, start: number, stop: number, options?: { withScores?: boolean }): Promise<Array<[string, number]> | string[]> {
    const set = this.sortedSets.get(key) || []
    
    // Handle negative indices
    const actualStart = start < 0 ? Math.max(0, set.length + start) : start
    const actualStop = stop < 0 ? set.length + stop : stop
    
    const slice = set.slice(actualStart, actualStop + 1)
    
    if (options?.withScores) {
      return slice.map(item => [item.member, item.score] as [string, number])
    }
    
    return slice.map(item => item.member)
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

  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.store.get(key) || new Set<string>()
    let added = 0
    
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member)
        added++
      }
    }
    
    this.store.set(key, set)
    return added
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.store.get(key)
    if (!set || !(set instanceof Set)) return 0
    
    let removed = 0
    for (const member of members) {
      if (set.delete(member)) {
        removed++
      }
    }
    
    if (set.size === 0) {
      this.store.delete(key)
    }
    
    return removed
  }

  async scard(key: string): Promise<number> {
    const set = this.store.get(key)
    if (!set || !(set instanceof Set)) return 0
    return set.size
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.store.get(key)
    if (!set || !(set instanceof Set)) return []
    return Array.from(set)
  }

  async hset(key: string, values: Record<string, unknown>): Promise<number> {
    const existing = this.store.get(key) || {}
    const updated = { ...existing, ...values }
    this.store.set(key, updated)
    return Object.keys(values).length
  }

  async hgetall<T = Record<string, unknown>>(key: string): Promise<T | null> {
    const data = this.store.get(key)
    if (!data || typeof data !== 'object') return null
    return data as T
  }

  pipeline(): KVPipeline {
    return new MockKVPipeline(this)
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.store.get(key)
    if (!Array.isArray(list)) return []
    
    // Handle negative indices
    const actualStart = start < 0 ? Math.max(0, list.length + start) : start
    const actualStop = stop < 0 ? list.length + stop : stop
    
    return list.slice(actualStart, actualStop + 1)
  }

  async ltrim(key: string, start: number, stop: number): Promise<string> {
    const list = this.store.get(key)
    if (!Array.isArray(list)) return 'OK'
    
    // Handle negative indices
    const actualStart = start < 0 ? Math.max(0, list.length + start) : start
    const actualStop = stop < 0 ? list.length + stop : stop
    
    // Keep only elements in the specified range
    const trimmed = list.slice(actualStart, actualStop + 1)
    
    if (trimmed.length === 0) {
      this.store.delete(key)
    } else {
      this.store.set(key, trimmed)
    }
    
    return 'OK'
  }

  async lpush(key: string, ...elements: string[]): Promise<number> {
    let list = this.store.get(key)
    if (!Array.isArray(list)) {
      list = []
    }
    
    // Push elements to the front of the list
    list.unshift(...elements.reverse())
    this.store.set(key, list)
    
    return list.length
  }

  async incr(key: string): Promise<number> {
    const value = this.store.get(key)
    const num = typeof value === 'number' ? value : parseInt(value) || 0
    const newValue = num + 1
    this.store.set(key, newValue)
    return newValue
  }

  async decr(key: string): Promise<number> {
    const value = this.store.get(key)
    const num = typeof value === 'number' ? value : parseInt(value) || 0
    const newValue = Math.max(0, num - 1)
    this.store.set(key, newValue)
    return newValue
  }

  async lrem(key: string, count: number, element: string): Promise<number> {
    const list = this.store.get(key)
    if (!Array.isArray(list)) return 0
    
    let removed = 0
    const newList = []
    
    if (count === 0) {
      // Remove all occurrences
      for (const item of list) {
        if (item === element) {
          removed++
        } else {
          newList.push(item)
        }
      }
    } else if (count > 0) {
      // Remove first count occurrences
      for (const item of list) {
        if (item === element && removed < count) {
          removed++
        } else {
          newList.push(item)
        }
      }
    } else {
      // Remove last count occurrences
      const absCount = Math.abs(count)
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i] === element && removed < absCount) {
          removed++
        } else {
          newList.unshift(list[i])
        }
      }
    }
    
    if (newList.length === 0) {
      this.store.delete(key)
    } else {
      this.store.set(key, newList)
    }
    
    return removed
  }

  async zcard(key: string): Promise<number> {
    const set = this.sortedSets.get(key)
    return set?.length || 0
  }

  async keys(pattern: string): Promise<string[]> {
    const results: string[] = []
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    
    // Check all keys in the store
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        results.push(key)
      }
    }
    
    // Check all keys in sorted sets
    for (const key of this.sortedSets.keys()) {
      if (regex.test(key) && !results.includes(key)) {
        results.push(key)
      }
    }
    
    return results
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
  
  // Use the config helper to try multiple env var names
  const { kvUrl, kvToken } = getKVConfig()
  
  if (!kvUrl || !kvToken) {
    console.warn('KV not configured - using in-memory mock (data will not persist)')
    configError = 'KV credentials not found in any of the expected environment variables'
    kvInstance = new MockKVClient()
    return kvInstance
  }
  
  try {
    // In production Vercel environment, try the default kv export first
    // This works better with Vercel's automatic environment injection
    if (process.env.VERCEL && process.env.NODE_ENV === 'production') {
      try {
        const { kv } = require('@vercel/kv')
        kvInstance = kv
        isConfigured = true
        console.log('KV client initialized with default export (Vercel production)')
        return kvInstance as KVClient
      } catch (defaultError) {
        console.warn('Failed to use default KV export, trying createClient:', defaultError)
      }
    }
    
    // Fallback to createClient with explicit configuration
    const { createClient } = require('@vercel/kv')
    kvInstance = createClient({
      url: kvUrl,
      token: kvToken
    })
    isConfigured = true
    console.log('KV client successfully initialized with explicit config')
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