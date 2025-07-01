/**
 * Unified Storage Architecture for Inplain.AI
 * 
 * This module provides a consistent interface for all storage operations,
 * consolidating KV, cache, and content storage into a single API.
 */

import { kv } from '@/app/api/lib/kv-wrapper'
import { HashUtils } from '@/lib/utils/hash'
import { RetryUtils } from '@/lib/utils/retry'
import { logger } from '@/lib/logger'
import { performanceMonitor } from '@/lib/monitoring/performance'
import { StorageConfig, getTTL, shouldCompress } from './storage-config'

export interface StorageOptions {
  ttl?: number // Time to live in seconds
  tags?: string[] // Cache tags for invalidation
  compress?: boolean // Compress large values
  namespace?: string // Storage namespace
}

export interface CacheOptions extends StorageOptions {
  staleWhileRevalidate?: number // Serve stale content while revalidating
  warmCache?: boolean // Pre-warm cache after set
}

export interface BatchItem<T = any> {
  key: string
  value: T
  options?: StorageOptions
}

/**
 * Centralized key builder for consistent key patterns
 */
export class StorageKeys {
  private static separator = ':'
  
  // Core domains
  static snapshot = (slug: string, id: string) => 
    `snapshot${StorageKeys.separator}${slug}${StorageKeys.separator}${id}`
  
  static snapshotContent = (slug: string, id: string) => 
    `snapshot-content${StorageKeys.separator}${slug}${StorageKeys.separator}${id}`
  
  static diff = (slug: string, id: string) => 
    `diff${StorageKeys.separator}${slug}${StorageKeys.separator}${id}`
  
  static diffContent = (slug: string, id: string) => 
    `diff-content${StorageKeys.separator}${slug}${StorageKeys.separator}${id}`
  
  static cache = (domain: string, key: string) => 
    `cache${StorageKeys.separator}${domain}${StorageKeys.separator}${key}`
  
  static company = (slug: string) => 
    `company${StorageKeys.separator}${slug}`
  
  static companyList = () => 
    `company${StorageKeys.separator}list`
  
  static analysis = (slug: string, type: string) => 
    `analysis${StorageKeys.separator}${slug}${StorageKeys.separator}${type}`
  
  static user = (userId: string, domain: string) => 
    `user${StorageKeys.separator}${userId}${StorageKeys.separator}${domain}`
  
  // Utility methods
  static parseKey(key: string): { domain: string; parts: string[] } {
    const parts = key.split(StorageKeys.separator)
    return {
      domain: parts[0] || 'unknown',
      parts: parts.slice(1)
    }
  }
  
  static buildPattern(domain: string, pattern: string = '*'): string {
    return `${domain}${StorageKeys.separator}${pattern}`
  }
}

/**
 * Unified storage implementation
 */
export class UnifiedStorage {
  private static instance: UnifiedStorage
  private readonly maxValueSize = StorageConfig.limits.maxValueSize
  private readonly chunkSize = StorageConfig.limits.chunkSize
  private readonly defaultTTL = getTTL('cache')
  
  private constructor() {}
  
  static getInstance(): UnifiedStorage {
    if (!UnifiedStorage.instance) {
      UnifiedStorage.instance = new UnifiedStorage()
    }
    return UnifiedStorage.instance
  }
  
  /**
   * Get a value from storage
   */
  async get<T>(key: string): Promise<T | null> {
    const transactionId = performanceMonitor.startTransaction('storage.get', { key })
    
    try {
      // Check if this is a chunked value
      const metadata = await kv.get<{ chunked: true; chunks: number }>(`${key}:meta`)
      
      if (metadata?.chunked) {
        return await this.getChunkedValue<T>(key, metadata.chunks)
      }
      
      // Regular get
      const value = await kv.get<T>(key)
      performanceMonitor.endTransaction(transactionId)
      return value
    } catch (error) {
      logger.error('Storage get error', { key, error })
      performanceMonitor.endTransaction(transactionId)
      return null
    }
  }
  
  /**
   * Set a value in storage with automatic chunking for large values
   */
  async set<T>(key: string, value: T, options: StorageOptions = {}): Promise<void> {
    const transactionId = performanceMonitor.startTransaction('storage.set', { key })
    
    try {
      const serialized = JSON.stringify(value)
      const ttl = options.ttl || this.defaultTTL
      
      // Handle large values with chunking
      if (serialized.length > this.maxValueSize) {
        await this.setChunkedValue(key, serialized, ttl)
      } else {
        await kv.set(key, value, { ex: ttl })
      }
      
      // Handle cache tags
      if (options.tags && options.tags.length > 0) {
        await this.addToTags(key, options.tags, ttl)
      }
      
      performanceMonitor.endTransaction(transactionId)
    } catch (error) {
      logger.error('Storage set error', { key, error })
      performanceMonitor.endTransaction(transactionId)
      throw error
    }
  }
  
  /**
   * Delete a value from storage
   */
  async delete(key: string): Promise<void> {
    try {
      // Check if chunked
      const metadata = await kv.get<{ chunked: true; chunks: number }>(`${key}:meta`)
      
      if (metadata?.chunked) {
        // Delete all chunks
        const pipeline = kv.pipeline()
        for (let i = 0; i < metadata.chunks; i++) {
          pipeline.del(`${key}:chunk:${i}`)
        }
        pipeline.del(`${key}:meta`)
        pipeline.del(key)
        await pipeline.exec()
      } else {
        await kv.del(key)
      }
      
      // Clean up tags
      await this.removeFromTags(key)
    } catch (error) {
      logger.error('Storage delete error', { key, error })
    }
  }
  
  /**
   * Get multiple values in a single operation
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return []
    
    const transactionId = performanceMonitor.startTransaction('storage.mget', { 
      count: keys.length.toString() 
    })
    
    try {
      // First, get all values and metadata in parallel
      const pipeline = kv.pipeline()
      keys.forEach(key => {
        pipeline.get(key)
        pipeline.get(`${key}:meta`)
      })
      
      const results = await pipeline.exec()
      const values: (T | null)[] = []
      
      // Process results
      for (let i = 0; i < keys.length; i++) {
        const valueIndex = i * 2
        const metaIndex = valueIndex + 1
        const metadata = results?.[metaIndex] as any
        
        if (metadata?.chunked) {
          // Handle chunked value
          values.push(await this.getChunkedValue<T>(keys[i]!, metadata.chunks))
        } else {
          values.push(results?.[valueIndex] as T | null)
        }
      }
      
      performanceMonitor.endTransaction(transactionId)
      return values
    } catch (error) {
      logger.error('Storage mget error', { keys, error })
      performanceMonitor.endTransaction(transactionId)
      return keys.map(() => null)
    }
  }
  
  /**
   * Set multiple values in a single operation
   */
  async mset<T>(items: BatchItem<T>[]): Promise<void> {
    if (items.length === 0) return
    
    const transactionId = performanceMonitor.startTransaction('storage.mset', { 
      count: items.length.toString() 
    })
    
    try {
      // Process items that don't need chunking first
      const pipeline = kv.pipeline()
      const chunkedItems: BatchItem<T>[] = []
      
      for (const item of items) {
        const serialized = JSON.stringify(item.value)
        const ttl = item.options?.ttl || this.defaultTTL
        
        if (serialized.length > this.maxValueSize) {
          chunkedItems.push(item)
        } else {
          pipeline.set(item.key, item.value, { ex: ttl })
          
          // Handle tags
          if (item.options?.tags) {
            for (const tag of item.options.tags) {
              pipeline.sadd(`tag:${tag}`, item.key)
              pipeline.expire(`tag:${tag}`, ttl)
            }
          }
        }
      }
      
      await pipeline.exec()
      
      // Handle chunked items
      for (const item of chunkedItems) {
        await this.set(item.key, item.value, item.options)
      }
      
      performanceMonitor.endTransaction(transactionId)
    } catch (error) {
      logger.error('Storage mset error', { count: items.length, error })
      performanceMonitor.endTransaction(transactionId)
      throw error
    }
  }
  
  /**
   * Get or set a value with caching logic
   */
  async withCache<T>(
    key: string, 
    factory: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key)
    
    if (cached !== null) {
      // Handle stale-while-revalidate
      if (options.staleWhileRevalidate) {
        const staleKey = `${key}:stale`
        const staleTime = await kv.get<number>(staleKey)
        
        if (!staleTime || Date.now() > staleTime) {
          // Serve stale content but refresh in background
          this.refreshInBackground(key, factory, options)
        }
      }
      
      return cached
    }
    
    // Cache miss - get fresh value
    try {
      const fresh = await RetryUtils.withRetry(factory, {
        maxAttempts: 3,
        backoffMultiplier: 2
      })
      
      if (fresh.result !== undefined) {
        await this.set(key, fresh.result, options)
        
        // Set stale time if using stale-while-revalidate
        if (options.staleWhileRevalidate) {
          const staleTime = Date.now() + (options.staleWhileRevalidate * 1000)
          await kv.set(`${key}:stale`, staleTime, { 
            ex: options.ttl || this.defaultTTL 
          })
        }
        
        return fresh.result
      }
      
      throw new Error('Factory returned undefined')
    } catch (error) {
      logger.error('Cache factory failed', { key, error })
      throw new Error('Failed to get or create cache value')
    }
  }
  
  /**
   * Invalidate all keys with given tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    if (tags.length === 0) return
    
    try {
      const pipeline = kv.pipeline()
      const keysToDelete = new Set<string>()
      
      // Get all keys for each tag
      for (const tag of tags) {
        const keys = await kv.smembers(`tag:${tag}`)
        if (keys) {
          keys.forEach(key => keysToDelete.add(key))
        }
        pipeline.del(`tag:${tag}`)
      }
      
      // Delete all tagged keys
      for (const key of keysToDelete) {
        pipeline.del(key)
        pipeline.del(`${key}:meta`)
        pipeline.del(`${key}:stale`)
      }
      
      await pipeline.exec()
      
      logger.info('Invalidated cache by tags', { tags, count: keysToDelete.size })
    } catch (error) {
      logger.error('Tag invalidation error', { tags, error })
    }
  }
  
  /**
   * Clear all storage (use with caution!)
   */
  async clear(pattern?: string): Promise<void> {
    try {
      const keys = await kv.keys(pattern || '*')
      
      if (keys && keys.length > 0) {
        const pipeline = kv.pipeline()
        keys.forEach(key => pipeline.del(key))
        await pipeline.exec()
      }
      
      logger.warn('Storage cleared', { pattern, count: keys?.length || 0 })
    } catch (error) {
      logger.error('Storage clear error', { pattern, error })
    }
  }
  
  // Private helper methods
  
  private async getChunkedValue<T>(key: string, chunks: number): Promise<T | null> {
    try {
      const pipeline = kv.pipeline()
      
      for (let i = 0; i < chunks; i++) {
        pipeline.get(`${key}:chunk:${i}`)
      }
      
      const chunkResults = await pipeline.exec()
      
      if (!chunkResults || chunkResults.some(chunk => !chunk)) {
        return null
      }
      
      const combined = chunkResults.join('')
      return JSON.parse(combined)
    } catch (error) {
      logger.error('Error getting chunked value', { key, chunks, error })
      return null
    }
  }
  
  private async setChunkedValue(key: string, serialized: string, ttl: number): Promise<void> {
    const chunks = Math.ceil(serialized.length / this.chunkSize)
    const pipeline = kv.pipeline()
    
    // Store metadata
    pipeline.set(`${key}:meta`, { chunked: true, chunks }, { ex: ttl })
    
    // Store chunks
    for (let i = 0; i < chunks; i++) {
      const start = i * this.chunkSize
      const end = Math.min(start + this.chunkSize, serialized.length)
      const chunk = serialized.slice(start, end)
      
      pipeline.set(`${key}:chunk:${i}`, chunk, { ex: ttl })
    }
    
    // Store a marker for the main key
    pipeline.set(key, { __chunked: true }, { ex: ttl })
    
    await pipeline.exec()
  }
  
  private async addToTags(key: string, tags: string[], ttl: number): Promise<void> {
    const pipeline = kv.pipeline()
    
    for (const tag of tags) {
      pipeline.sadd(`tag:${tag}`, key)
      pipeline.expire(`tag:${tag}`, ttl)
    }
    
    await pipeline.exec()
  }
  
  private async removeFromTags(key: string): Promise<void> {
    // This is a simplified version - in production you'd track which tags a key belongs to
    const tags = await kv.keys('tag:*')
    
    if (tags && tags.length > 0) {
      const pipeline = kv.pipeline()
      tags.forEach(tag => pipeline.srem(tag, key))
      await pipeline.exec()
    }
  }
  
  private async refreshInBackground<T>(
    key: string, 
    factory: () => Promise<T>, 
    options: CacheOptions
  ): Promise<void> {
    // Fire and forget background refresh
    setImmediate(async () => {
      try {
        const result = await RetryUtils.withRetry(factory, {
          maxAttempts: 2,
          backoffMultiplier: 2
        })
        
        if (result.result !== undefined) {
          await this.set(key, result.result, options)
          
          if (options.staleWhileRevalidate) {
            const staleTime = Date.now() + (options.staleWhileRevalidate * 1000)
            await kv.set(`${key}:stale`, staleTime, { 
              ex: options.ttl || this.defaultTTL 
            })
          }
        }
      } catch (error) {
        logger.error('Background refresh failed', { key, error })
      }
    })
  }
}

// Export singleton instance
export const storage = UnifiedStorage.getInstance()