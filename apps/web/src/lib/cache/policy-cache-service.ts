/**
 * Policy Cache Service for Inplain.AI
 * Phase 2: Efficient caching layer for snapshots and analysis
 */

import { Redis } from '@upstash/redis'
import { LRUCache } from 'lru-cache'
import { db } from '@/lib/db'
import { snapshotCache, snapshots, policies } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import type { Snapshot, ExtractedContent } from '@/lib/snapshots/snapshot-manager'
import type { SemanticDiff } from '@/lib/diffs/semantic-diff-engine'

interface CacheConfig {
  redisUrl?: string
  redisToken?: string
  memoryMax?: number
  ttlMinutes?: number
}

interface CachedSnapshot {
  snapshot: Snapshot
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

export class PolicyCacheService {
  private static instance: PolicyCacheService
  private redis?: Redis
  private memoryCache: LRUCache<string, any>
  private ttl: number

  private constructor(config: CacheConfig = {}) {
    // Initialize Redis if credentials provided
    if (config.redisUrl && config.redisToken) {
      this.redis = new Redis({
        url: config.redisUrl,
        token: config.redisToken
      })
    }

    // Initialize in-memory LRU cache
    this.memoryCache = new LRUCache({
      max: config.memoryMax || 100, // Max 100 items
      ttl: 1000 * 60 * (config.ttlMinutes || 60), // Default 60 min TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true
    })

    this.ttl = config.ttlMinutes || 60
  }

  static getInstance(config?: CacheConfig): PolicyCacheService {
    if (!this.instance) {
      this.instance = new PolicyCacheService(config)
    }
    return this.instance
  }

  /**
   * Get cached snapshot with multi-tier lookup
   */
  async getCachedSnapshot(
    policyId: string,
    version?: number
  ): Promise<CachedSnapshot | null> {
    const cacheKey = version 
      ? `snapshot:${policyId}:v${version}`
      : `snapshot:${policyId}:latest`

    try {
      // 1. Check memory cache first
      const memoryCached = this.memoryCache.get(cacheKey) as CachedSnapshot
      if (memoryCached && this.isValid(memoryCached.cachedAt)) {
        return memoryCached
      }

      // 2. Check Redis cache
      if (this.redis) {
        const redisCached = await this.redis.get(cacheKey)
        if (redisCached && typeof redisCached === 'object') {
          const cached = redisCached as CachedSnapshot
          if (this.isValid(cached.cachedAt)) {
            // Populate memory cache
            this.memoryCache.set(cacheKey, cached)
            return cached
          }
        }
      }

      // 3. Check database cache
      const dbCached = await this.getFromDatabaseCache(policyId, version)
      if (dbCached) {
        // Populate both caches
        await this.setCaches(cacheKey, dbCached)
        return dbCached
      }

      return null
    } catch (error) {
      console.error('Cache lookup error:', error)
      return null
    }
  }

  /**
   * Set cached snapshot in all tiers
   */
  async setCachedSnapshot(
    policyId: string,
    snapshot: Snapshot,
    processedData?: {
      processedContent?: any
      summary?: string
      keyPoints?: string[]
      privacyScore?: number
    }
  ): Promise<void> {
    const cacheKey = `snapshot:${policyId}:v${snapshot.metadata.version}`
    const latestKey = `snapshot:${policyId}:latest`

    const cached: CachedSnapshot = {
      snapshot,
      ...processedData,
      cachedAt: Date.now()
    }

    try {
      // Set in all cache tiers
      await this.setCaches(cacheKey, cached)
      
      // Also update latest if this is the newest version
      const isLatest = await this.isLatestVersion(policyId, snapshot.metadata.version)
      if (isLatest) {
        await this.setCaches(latestKey, cached)
      }

      // Update database cache if processed data provided
      if (processedData && Object.keys(processedData).length > 0) {
        await this.updateDatabaseCache(snapshot.id, processedData)
      }
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  /**
   * Get cached diff
   */
  async getCachedDiff(
    policyId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<CachedDiff | null> {
    const cacheKey = `diff:${policyId}:v${fromVersion}-v${toVersion}`

    try {
      // Check memory cache
      const cached = this.memoryCache.get(cacheKey) as CachedDiff
      if (cached && this.isValid(cached.cachedAt)) {
        return cached
      }

      // Check Redis
      if (this.redis) {
        const redisCached = await this.redis.get(cacheKey)
        if (redisCached && typeof redisCached === 'object') {
          const diff = redisCached as CachedDiff
          if (this.isValid(diff.cachedAt)) {
            this.memoryCache.set(cacheKey, diff)
            return diff
          }
        }
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
  async setCachedDiff(
    policyId: string,
    fromVersion: number,
    toVersion: number,
    diff: SemanticDiff
  ): Promise<void> {
    const cacheKey = `diff:${policyId}:v${fromVersion}-v${toVersion}`

    const cached: CachedDiff = {
      diff,
      fromVersion,
      toVersion,
      cachedAt: Date.now()
    }

    try {
      await this.setCaches(cacheKey, cached)
    } catch (error) {
      console.error('Diff cache set error:', error)
    }
  }

  /**
   * Invalidate caches for a policy
   */
  async invalidatePolicy(policyId: string): Promise<void> {
    try {
      // Clear memory cache entries
      const keysToDelete: string[] = []
      for (const key of this.memoryCache.keys()) {
        if (key.includes(policyId)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => this.memoryCache.delete(key))

      // Clear Redis entries
      if (this.redis) {
        const pattern = `*${policyId}*`
        // Note: Redis pattern matching might need adjustment based on setup
        await this.redis.eval(
          `
          local keys = redis.call('keys', ARGV[1])
          for i=1,#keys do
            redis.call('del', keys[i])
          end
          return #keys
          `,
          [],
          pattern
        )
      }

      // Clear database cache
      await db.delete(snapshotCache)
        .where(eq(snapshotCache.policyId, policyId))
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }

  /**
   * Warm up cache for a policy
   */
  async warmupPolicy(policyId: string): Promise<void> {
    try {
      // Get latest snapshots
      const latestSnapshots = await db.select()
        .from(snapshots)
        .where(eq(snapshots.policyId, policyId))
        .orderBy(desc(snapshots.version))
        .limit(5)

      // Cache them
      for (const snapshot of latestSnapshots) {
        const snapshotData = await this.loadFullSnapshot(snapshot.id)
        if (snapshotData) {
          await this.setCachedSnapshot(policyId, snapshotData)
        }
      }
    } catch (error) {
      console.error('Cache warmup error:', error)
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number
    memoryHitRate: number
    redisConnected: boolean
  } {
    const calculator = this.memoryCache as any
    const hitRate = calculator.calculatedSize 
      ? (calculator.hits / (calculator.hits + calculator.misses)) * 100
      : 0

    return {
      memorySize: this.memoryCache.size,
      memoryHitRate: Math.round(hitRate),
      redisConnected: !!this.redis
    }
  }

  /**
   * Private helper methods
   */

  private async setCaches(key: string, value: any): Promise<void> {
    // Set in memory cache
    this.memoryCache.set(key, value)

    // Set in Redis with TTL
    if (this.redis) {
      await this.redis.setex(
        key,
        this.ttl * 60, // Convert to seconds
        JSON.stringify(value)
      )
    }
  }

  private async getFromDatabaseCache(
    policyId: string,
    version?: number
  ): Promise<CachedSnapshot | null> {
    try {
      let query = db.select()
        .from(snapshotCache)
        .innerJoin(snapshots, eq(snapshotCache.snapshotId, snapshots.id))
        .where(
          and(
            eq(snapshotCache.policyId, policyId),
            gt(snapshotCache.expiresAt, new Date())
          )
        )

      if (version) {
        query = query.where(eq(snapshots.version, version))
      } else {
        query = query.orderBy(desc(snapshots.version)).limit(1)
      }

      const [result] = await query

      if (!result) return null

      const snapshot: Snapshot = {
        id: result.snapshots.id,
        policyId: result.snapshots.policyId,
        content: result.snapshots.content,
        metadata: JSON.parse(result.snapshots.metadata),
        createdAt: result.snapshots.capturedAt
      }

      return {
        snapshot,
        processedContent: result.snapshot_cache.processedContent,
        summary: result.snapshot_cache.summary || undefined,
        keyPoints: result.snapshot_cache.keyPoints as string[] || undefined,
        privacyScore: result.snapshot_cache.privacyScore || undefined,
        cachedAt: result.snapshot_cache.createdAt.getTime()
      }
    } catch (error) {
      console.error('Database cache lookup error:', error)
      return null
    }
  }

  private async updateDatabaseCache(
    snapshotId: string,
    data: {
      processedContent?: any
      summary?: string
      keyPoints?: string[]
      privacyScore?: number
    }
  ): Promise<void> {
    try {
      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + this.ttl)

      await db.insert(snapshotCache)
        .values({
          policyId: (await db.select({ policyId: snapshots.policyId })
            .from(snapshots)
            .where(eq(snapshots.id, snapshotId))
            .limit(1))[0].policyId,
          snapshotId,
          processedContent: data.processedContent || {},
          summary: data.summary,
          keyPoints: data.keyPoints || [],
          privacyScore: data.privacyScore,
          processingVersion: '1.0',
          expiresAt
        })
        .onConflictDoUpdate({
          target: snapshotCache.snapshotId,
          set: {
            processedContent: data.processedContent || {},
            summary: data.summary,
            keyPoints: data.keyPoints || [],
            privacyScore: data.privacyScore,
            expiresAt,
            updatedAt: new Date()
          }
        })
    } catch (error) {
      console.error('Database cache update error:', error)
    }
  }

  private async loadFullSnapshot(snapshotId: string): Promise<Snapshot | null> {
    try {
      const [result] = await db.select()
        .from(snapshots)
        .where(eq(snapshots.id, snapshotId))
        .limit(1)

      if (!result) return null

      return {
        id: result.id,
        policyId: result.policyId,
        content: result.content,
        metadata: JSON.parse(result.metadata),
        createdAt: result.capturedAt
      }
    } catch (error) {
      console.error('Snapshot load error:', error)
      return null
    }
  }

  private async isLatestVersion(
    policyId: string,
    version: number
  ): Promise<boolean> {
    try {
      const [latest] = await db.select({ version: snapshots.version })
        .from(snapshots)
        .where(eq(snapshots.policyId, policyId))
        .orderBy(desc(snapshots.version))
        .limit(1)

      return latest?.version === version
    } catch (error) {
      return false
    }
  }

  private isValid(cachedAt: number): boolean {
    const age = Date.now() - cachedAt
    return age < this.ttl * 60 * 1000
  }

  /**
   * Batch operations for efficiency
   */
  
  async getCachedSnapshots(
    policyIds: string[]
  ): Promise<Map<string, CachedSnapshot | null>> {
    const results = new Map<string, CachedSnapshot | null>()
    
    // Batch fetch from cache
    const promises = policyIds.map(async (policyId) => {
      const cached = await this.getCachedSnapshot(policyId)
      results.set(policyId, cached)
    })
    
    await Promise.all(promises)
    return results
  }

  async preloadDiffs(
    policyId: string,
    versions: number[]
  ): Promise<void> {
    if (versions.length < 2) return

    // Preload diffs between consecutive versions
    for (let i = 0; i < versions.length - 1; i++) {
      const fromVersion = versions[i + 1] // Older
      const toVersion = versions[i] // Newer
      
      // Check if already cached
      const cached = await this.getCachedDiff(policyId, fromVersion, toVersion)
      if (!cached) {
        // Trigger diff calculation (would be done by diff engine)
        console.log(`Preloading diff: v${fromVersion} -> v${toVersion}`)
      }
    }
  }
}

// Export singleton instance with default config
export const cacheService = PolicyCacheService.getInstance({
  redisUrl: process.env.UPSTASH_REDIS_REST_URL,
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  memoryMax: 100,
  ttlMinutes: 60
})