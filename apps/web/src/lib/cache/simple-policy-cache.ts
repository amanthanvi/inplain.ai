/**
 * Simplified Policy Cache Service for Inplain.AI
 * Phase 2: Memory-only caching layer
 */

import { LRUCache } from 'lru-cache'
import type { EnhancedSnapshotMeta } from '@/lib/snapshots/kv-snapshot-manager'
import type { SemanticDiff } from '@/lib/diffs/semantic-diff-engine'

interface CacheConfig {
  memoryMax?: number
  ttlMinutes?: number
}

interface CachedSnapshot {
  snapshot: EnhancedSnapshotMeta
  processedContent?: any
  summary?: string
  keyPoints?: string[]
  privacyScore?: number
  cachedAt: number
}

interface CachedDiff {
  diff: SemanticDiff
  fromVersion: number
  toVersion: number
  cachedAt: number
}

export class SimplePolicyCache {
  private static instance: SimplePolicyCache
  private memoryCache: LRUCache<string, any>
  private ttl: number

  private constructor(config: CacheConfig = {}) {
    // Initialize in-memory LRU cache
    this.memoryCache = new LRUCache({
      max: config.memoryMax || 100, // Max 100 items
      ttl: 1000 * 60 * (config.ttlMinutes || 60), // Default 60 min TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true
    })

    this.ttl = config.ttlMinutes || 60
  }

  static getInstance(config?: CacheConfig): SimplePolicyCache {
    if (!this.instance) {
      this.instance = new SimplePolicyCache(config)
    }
    return this.instance
  }

  /**
   * Get cached snapshot
   */
  getCachedSnapshot(
    policyId: string,
    version?: number
  ): CachedSnapshot | null {
    const cacheKey = version 
      ? `snapshot:${policyId}:v${version}`
      : `snapshot:${policyId}:latest`

    try {
      const cached = this.memoryCache.get(cacheKey) as CachedSnapshot
      if (cached && this.isValid(cached.cachedAt)) {
        return cached
      }
      return null
    } catch (error) {
      console.error('Cache lookup error:', error)
      return null
    }
  }

  /**
   * Set cached snapshot
   */
  setCachedSnapshot(
    policyId: string,
    snapshot: EnhancedSnapshotMeta,
    processedData?: {
      processedContent?: any
      summary?: string
      keyPoints?: string[]
      privacyScore?: number
    }
  ): void {
    const cacheKey = `snapshot:${policyId}:v${snapshot.version}`
    const latestKey = `snapshot:${policyId}:latest`

    const cached: CachedSnapshot = {
      snapshot,
      ...processedData,
      cachedAt: Date.now()
    }

    try {
      this.memoryCache.set(cacheKey, cached)
      // Assume it's the latest version for now
      this.memoryCache.set(latestKey, cached)
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  /**
   * Get cached diff
   */
  getCachedDiff(
    policyId: string,
    fromVersion: number,
    toVersion: number
  ): CachedDiff | null {
    const cacheKey = `diff:${policyId}:v${fromVersion}-v${toVersion}`

    try {
      const cached = this.memoryCache.get(cacheKey) as CachedDiff
      if (cached && this.isValid(cached.cachedAt)) {
        return cached
      }
      return null
    } catch (error) {
      console.error('Diff cache lookup error:', error)
      return null
    }
  }

  /**
   * Set cached diff
   */
  setCachedDiff(
    policyId: string,
    fromVersion: number,
    toVersion: number,
    diff: SemanticDiff
  ): void {
    const cacheKey = `diff:${policyId}:v${fromVersion}-v${toVersion}`

    const cached: CachedDiff = {
      diff,
      fromVersion,
      toVersion,
      cachedAt: Date.now()
    }

    try {
      this.memoryCache.set(cacheKey, cached)
    } catch (error) {
      console.error('Diff cache set error:', error)
    }
  }

  /**
   * Invalidate caches for a policy
   */
  invalidatePolicy(policyId: string): void {
    try {
      // Clear memory cache entries
      const keysToDelete: string[] = []
      for (const key of this.memoryCache.keys()) {
        if (key.includes(policyId)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => this.memoryCache.delete(key))
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number
    memoryHitRate: number
  } {
    return {
      memorySize: this.memoryCache.size,
      memoryHitRate: 0 // LRU cache doesn't track hits in the type definition
    }
  }

  private isValid(cachedAt: number): boolean {
    const age = Date.now() - cachedAt
    return age < this.ttl * 60 * 1000
  }
}

// Export singleton instance with default config
export const simpleCacheService = SimplePolicyCache.getInstance({
  memoryMax: 100,
  ttlMinutes: 60
})