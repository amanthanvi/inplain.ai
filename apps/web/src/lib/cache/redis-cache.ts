import { kv, isKVConfigured } from '@/app/api/lib/kv-wrapper'
import { logger } from '@/lib/logger-stub'
import * as Sentry from '@/lib/sentry-stub'

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  tags?: string[] // Cache tags for invalidation
  staleWhileRevalidate?: number // Serve stale content while revalidating
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  tags?: string[]
  staleUntil?: number
}

export class RedisCache {
  private readonly prefix: string
  private readonly defaultTTL: number

  constructor(prefix: string = 'cache:', defaultTTL: number = 3600) {
    this.prefix = prefix
    this.defaultTTL = defaultTTL
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!isKVConfigured()) {
      return null
    }

    try {
      const cacheKey = this.getCacheKey(key)
      const entry = await kv.get<CacheEntry<T>>(cacheKey)

      if (!entry) {
        return null
      }

      const now = Date.now()
      const age = now - entry.timestamp

      // Check if expired
      if (age > entry.ttl * 1000) {
        // Check if we can serve stale
        if (entry.staleUntil && now < entry.staleUntil) {
          // Return stale data and trigger background revalidation
          this.triggerRevalidation(key)
          return entry.data
        }
        
        // Expired and no stale serving
        await this.delete(key)
        return null
      }

      return entry.data
    } catch (error) {
      logger.error('Cache get error', { error, key })
      Sentry.captureException(error, {
        tags: { cache_operation: 'get' },
        extra: { key }
      })
      return null
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    if (!isKVConfigured()) {
      return
    }

    try {
      const cacheKey = this.getCacheKey(key)
      const ttl = options.ttl || this.defaultTTL
      
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl,
        tags: options.tags,
      }

      if (options.staleWhileRevalidate) {
        entry.staleUntil = Date.now() + (ttl + options.staleWhileRevalidate) * 1000
      }

      await kv.set(cacheKey, entry, { ex: ttl + (options.staleWhileRevalidate || 0) })

      // Update tag indices
      if (options.tags) {
        await this.updateTagIndices(key, options.tags)
      }
    } catch (error) {
      logger.error('Cache set error', { error, key })
      Sentry.captureException(error, {
        tags: { cache_operation: 'set' },
        extra: { key }
      })
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    if (!isKVConfigured()) {
      return
    }

    try {
      const cacheKey = this.getCacheKey(key)
      
      // Get entry to clean up tags
      const entry = await kv.get<CacheEntry<any>>(cacheKey)
      if (entry?.tags) {
        await this.removeFromTagIndices(key, entry.tags)
      }

      await kv.del(cacheKey)
    } catch (error) {
      logger.error('Cache delete error', { error, key })
      Sentry.captureException(error, {
        tags: { cache_operation: 'delete' },
        extra: { key }
      })
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    if (!isKVConfigured()) {
      return
    }

    try {
      const keysToInvalidate = new Set<string>()

      // Get all keys for each tag
      for (const tag of tags) {
        const tagKey = this.getTagKey(tag)
        // Vercel KV doesn't support sets, use regular keys
        const keysJson = await kv.get<string[]>(tagKey)
        if (keysJson) {
          keysJson.forEach((key: string) => keysToInvalidate.add(key))
        }
      }

      // Delete all keys (no pipeline in Vercel KV)
      const deletePromises = []
      for (const key of keysToInvalidate) {
        deletePromises.push(kv.del(this.getCacheKey(key)))
      }

      // Clean up tag indices
      for (const tag of tags) {
        deletePromises.push(kv.del(this.getTagKey(tag)))
      }

      await Promise.all(deletePromises)

      logger.info('Cache invalidated by tags', { tags, count: keysToInvalidate.size })
    } catch (error) {
      logger.error('Cache invalidation error', { error, tags })
      Sentry.captureException(error, {
        tags: { cache_operation: 'invalidate' },
        extra: { tags }
      })
    }
  }

  /**
   * Clear all cache entries with this prefix
   */
  async clear(): Promise<void> {
    if (!isKVConfigured()) {
      return
    }

    try {
      // Vercel KV doesn't support KEYS command
      // In production, you'd track keys differently
      logger.warn('Cache clear not fully implemented for Vercel KV')

      logger.info('Cache cleared', { prefix: this.prefix, count: 0 })
    } catch (error) {
      logger.error('Cache clear error', { error })
      Sentry.captureException(error, {
        tags: { cache_operation: 'clear' }
      })
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Compute value
    const value = await factory()

    // Cache the result
    await this.set(key, value, options)

    return value
  }

  /**
   * Memoize a function with caching
   */
  memoize<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    keyGenerator: (...args: TArgs) => string,
    options: CacheOptions = {}
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
      const key = keyGenerator(...args)
      return this.getOrSet(key, () => fn(...args), options)
    }
  }

  /**
   * Batch get multiple values
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!isKVConfigured() || keys.length === 0) {
      return keys.map(() => null)
    }

    try {
      const cacheKeys = keys.map(key => this.getCacheKey(key))
      // Vercel KV doesn't support mget, use individual gets
      const values = await Promise.all(
        cacheKeys.map(key => kv.get<CacheEntry<T>>(key))
      )

      return values.map((entry: CacheEntry<T> | null, index: number) => {
        if (!entry) return null

        const now = Date.now()
        const age = now - entry.timestamp

        if (age > entry.ttl * 1000) {
          // Expired
          this.delete(keys[index]!)
          return null
        }

        return entry.data
      })
    } catch (error) {
      logger.error('Cache mget error', { error, keys })
      return keys.map(() => null)
    }
  }

  /**
   * Batch set multiple values
   */
  async mset<T>(
    entries: Array<{ key: string; value: T; options?: CacheOptions }>
  ): Promise<void> {
    if (!isKVConfigured() || entries.length === 0) {
      return
    }

    try {
      // Vercel KV doesn't support pipeline, use individual operations
      const promises = []

      for (const { key, value, options = {} } of entries) {
        const cacheKey = this.getCacheKey(key)
        const ttl = options.ttl || this.defaultTTL

        const entry: CacheEntry<T> = {
          data: value,
          timestamp: Date.now(),
          ttl,
          tags: options.tags,
        }

        if (options.staleWhileRevalidate) {
          entry.staleUntil = Date.now() + (ttl + options.staleWhileRevalidate) * 1000
        }

        promises.push(kv.set(cacheKey, entry, { ex: ttl + (options.staleWhileRevalidate || 0) }))

        // Update tag indices
        if (options.tags) {
          promises.push(this.updateTagIndices(key, options.tags))
        }
      }

      await Promise.all(promises)
    } catch (error) {
      logger.error('Cache mset error', { error })
    }
  }

  private getCacheKey(key: string): string {
    return `${this.prefix}${key}`
  }

  private getTagKey(tag: string): string {
    return `${this.prefix}tag:${tag}`
  }

  private async updateTagIndices(key: string, tags: string[]): Promise<void> {
    // Vercel KV doesn't support sets, use arrays
    const promises: Promise<void>[] = []
    for (const tag of tags) {
      const tagKey = this.getTagKey(tag)
      promises.push(
        kv.get<string[]>(tagKey).then(async (existing) => {
          const keys = existing || []
          if (!keys.includes(key)) {
            keys.push(key)
            await kv.set(tagKey, keys, { ex: 86400 }) // 24 hour TTL for tag indices
          }
        })
      )
    }
    await Promise.all(promises)
  }

  private async removeFromTagIndices(key: string, tags: string[]): Promise<void> {
    // Vercel KV doesn't support sets, use arrays
    const promises: Promise<void>[] = []
    for (const tag of tags) {
      const tagKey = this.getTagKey(tag)
      promises.push(
        kv.get<string[]>(tagKey).then(async (existing) => {
          if (existing) {
            const keys = existing.filter(k => k !== key)
            if (keys.length > 0) {
              await kv.set(tagKey, keys, { ex: 86400 })
            } else {
              await kv.del(tagKey)
            }
          }
        })
      )
    }
    await Promise.all(promises)
  }

  private triggerRevalidation(key: string): void {
    // In a real implementation, this would trigger a background job
    // to revalidate the cache entry
    logger.info('Cache revalidation triggered', { key })
  }
}

// Pre-configured cache instances
export const caches = {
  // Short-lived cache for API responses (5 minutes)
  api: new RedisCache('api:', 300),
  
  // Medium-lived cache for processed data (1 hour)
  data: new RedisCache('data:', 3600),
  
  // Long-lived cache for static content (24 hours)
  static: new RedisCache('static:', 86400),
  
  // Session cache (30 minutes)
  session: new RedisCache('session:', 1800),
  
  // Search results cache (10 minutes)
  search: new RedisCache('search:', 600),
}

// Cache decorators for class methods
export function Cacheable(options: CacheOptions & { key?: string } = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cache = caches.data
      const cacheKey = options.key || `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`

      return cache.getOrSet(
        cacheKey,
        () => method.apply(this, args),
        options
      )
    }

    return descriptor
  }
}

// Cache invalidation decorator
export function InvalidateCache(tags: string[]) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args)
      
      // Invalidate cache after successful execution
      await caches.data.invalidateByTags(tags)
      
      return result
    }

    return descriptor
  }
}