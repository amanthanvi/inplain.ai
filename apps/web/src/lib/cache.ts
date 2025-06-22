import { kv } from '@vercel/kv';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  revalidate?: number; // Stale-while-revalidate in seconds
}

export class CacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly STALE_WHILE_REVALIDATE = 300; // 5 minutes

  /**
   * Get a value from cache with stale-while-revalidate support
   */
  static async get<T>(key: string): Promise<{ value: T | null; stale: boolean }> {
    try {
      const cached = await kv.get<{ value: T; expires: number; staleUntil: number }>(
        `cache:${key}`
      );

      if (!cached) {
        return { value: null, stale: false };
      }

      const now = Date.now();
      
      // If still fresh, return it
      if (now < cached.expires) {
        return { value: cached.value, stale: false };
      }

      // If stale but within revalidation window, return stale value
      if (now < cached.staleUntil) {
        return { value: cached.value, stale: true };
      }

      // Expired
      return { value: null, stale: false };
    } catch (error) {
      console.error('Cache get error:', error);
      return { value: null, stale: false };
    }
  }

  /**
   * Set a value in cache with options
   */
  static async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.DEFAULT_TTL;
      const revalidate = options.revalidate || this.STALE_WHILE_REVALIDATE;
      
      const now = Date.now();
      const cacheData = {
        value,
        expires: now + (ttl * 1000),
        staleUntil: now + ((ttl + revalidate) * 1000)
      };

      await kv.set(`cache:${key}`, cacheData, {
        ex: ttl + revalidate
      });

      // Store tags for invalidation
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          await kv.sadd(`cache:tag:${tag}`, key);
          await kv.expire(`cache:tag:${tag}`, 86400); // 24 hours
        }
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Invalidate cache by key
   */
  static async invalidate(key: string): Promise<void> {
    try {
      await kv.del(`cache:${key}`);
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }

  /**
   * Invalidate cache by tag
   */
  static async invalidateTag(tag: string): Promise<void> {
    try {
      const keys = await kv.smembers(`cache:tag:${tag}`);
      
      if (keys && keys.length > 0) {
        const pipeline = kv.pipeline();
        for (const key of keys) {
          pipeline.del(`cache:${key}`);
        }
        pipeline.del(`cache:tag:${tag}`);
        await pipeline.exec();
      }
    } catch (error) {
      console.error('Cache invalidate tag error:', error);
    }
  }

  /**
   * Wrap a function with caching
   */
  static async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const { value, stale } = await this.get<T>(key);
    
    if (value && !stale) {
      return value;
    }

    // If we have a stale value, return it and revalidate in background
    if (value && stale) {
      // Revalidate in background
      fn().then(newValue => {
        this.set(key, newValue, options).catch(console.error);
      }).catch(console.error);
      
      return value;
    }

    // No cache, fetch fresh
    const freshValue = await fn();
    await this.set(key, freshValue, options);
    return freshValue;
  }

  /**
   * Cache warming for critical paths
   */
  static async warm(keys: { key: string; fn: () => Promise<any>; options?: CacheOptions }[]): Promise<void> {
    await Promise.all(
      keys.map(({ key, fn, options }) =>
        fn()
          .then(value => this.set(key, value, options))
          .catch(error => console.error(`Cache warm error for ${key}:`, error))
      )
    );
  }

  /**
   * Get cache stats
   */
  static async getStats(): Promise<{
    keys: number;
    memory: string;
    hitRate: number;
  }> {
    try {
      // Vercel KV doesn't expose Redis INFO command directly
      // We'll estimate based on cache keys
      const cacheKeys = await kv.keys('cache:*');
      const keyCount = cacheKeys?.length || 0;
      
      // Estimate memory usage (rough approximation)
      const avgValueSize = 1024; // 1KB average
      const estimatedMemory = (keyCount * avgValueSize) / (1024 * 1024); // Convert to MB
      
      // Calculate hit rate from our performance metrics
      // This would need to be tracked separately in production
      const hitRate = 75; // Placeholder - implement actual tracking
      
      return {
        keys: keyCount,
        memory: `${estimatedMemory.toFixed(2)} MB (est)`,
        hitRate
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { keys: 0, memory: '0 MB', hitRate: 0 };
    }
  }
}

// Cache key builders for consistency
export const CacheKeys = {
  snapshot: (slug: string, id: string) => `snapshot:${slug}:${id}`,
  latestSnapshots: (slug: string) => `snapshots:latest:${slug}`,
  analysis: (slug: string, snapshotId: string, mode: string) => 
    `analysis:${slug}:${snapshotId}:${mode}`,
  diff: (slug: string, fromId: string, toId: string) => 
    `diff:${slug}:${fromId}:${toId}`,
  summary: (summaryId: string) => `summary:${summaryId}`,
  companyData: (slug: string) => `company:${slug}`,
  userSession: (sessionId: string) => `session:${sessionId}`,
  apiResponse: (endpoint: string, params: string) => `api:${endpoint}:${params}`,
  searchResults: (query: string) => `search:${query}`,
  feedData: (page: number) => `feed:${page}`
};

// Cache tags for invalidation groups
export const CacheTags = {
  company: (slug: string) => `company:${slug}`,
  analysis: 'analysis',
  snapshots: 'snapshots',
  diffs: 'diffs',
  user: (userId: string) => `user:${userId}`,
  api: 'api'
};