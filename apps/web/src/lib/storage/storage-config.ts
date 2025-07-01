/**
 * Centralized Storage Configuration
 * 
 * Defines consistent TTL values, cache policies, and storage behaviors
 * across the entire application
 */

export const StorageConfig = {
  // TTL Values (in seconds)
  ttl: {
    // Long-term storage
    snapshot: 30 * 24 * 60 * 60,        // 30 days
    snapshotContent: 30 * 24 * 60 * 60, // 30 days
    diff: 30 * 24 * 60 * 60,            // 30 days
    diffContent: 30 * 24 * 60 * 60,     // 30 days
    
    // Medium-term storage
    company: 7 * 24 * 60 * 60,          // 7 days
    analysis: 7 * 24 * 60 * 60,         // 7 days
    summary: 7 * 24 * 60 * 60,          // 7 days
    
    // Short-term storage
    cache: 60 * 60,                     // 1 hour
    apiResponse: 5 * 60,                // 5 minutes
    userSession: 24 * 60 * 60,          // 24 hours
    
    // Temporary storage
    temp: 60,                           // 1 minute
    lock: 30,                           // 30 seconds
  },
  
  // Stale-while-revalidate times (in seconds)
  staleWhileRevalidate: {
    snapshot: 5 * 60,                   // 5 minutes
    diff: 5 * 60,                       // 5 minutes
    company: 60,                        // 1 minute
    analysis: 10 * 60,                  // 10 minutes
    apiResponse: 30,                    // 30 seconds
  },
  
  // Size limits
  limits: {
    maxValueSize: 512 * 1024,           // 512KB (Vercel KV limit)
    chunkSize: 400 * 1024,              // 400KB chunks
    maxChunks: 50,                      // Maximum 50 chunks (~20MB total)
    maxCacheKeys: 10000,                // Maximum cached keys
  },
  
  // Retention policies
  retention: {
    maxSnapshotsPerCompany: 100,
    maxDiffsPerCompany: 50,
    maxAnalysesPerCompany: 20,
    maxCacheEntriesPerDomain: 1000,
  },
  
  // Cache tags for organized invalidation
  tags: {
    // Entity-based tags
    company: (slug: string) => `company:${slug}`,
    snapshot: (slug: string) => `snapshot:${slug}`,
    diff: (slug: string) => `diff:${slug}`,
    analysis: (slug: string) => `analysis:${slug}`,
    user: (userId: string) => `user:${userId}`,
    
    // Type-based tags
    types: {
      companies: 'companies',
      snapshots: 'snapshots',
      diffs: 'diffs',
      analyses: 'analyses',
      cache: 'cache',
      temporary: 'temp',
    },
    
    // Feature-based tags
    features: {
      ai: 'ai-responses',
      notifications: 'notifications',
      watchlist: 'watchlist',
      feedback: 'feedback',
    }
  },
  
  // Compression settings
  compression: {
    enabled: true,
    minSize: 10 * 1024,                 // Compress values larger than 10KB
    algorithm: 'gzip' as const,
  },
  
  // Cache warming settings
  cacheWarming: {
    enabled: true,
    endpoints: [
      '/api/companies',
      '/api/diffs',
      '/api/health',
    ],
    interval: 5 * 60 * 1000,            // 5 minutes
  },
  
  // Error handling
  errorHandling: {
    retryAttempts: 3,
    retryDelay: 1000,                   // 1 second
    backoffMultiplier: 2,
    maxRetryDelay: 30000,               // 30 seconds
    fallbackToMemory: true,
  },
  
  // Performance settings
  performance: {
    batchSize: 100,                     // Max items per batch operation
    parallelRequests: 10,               // Max parallel storage requests
    timeout: 10000,                     // 10 seconds timeout
  }
} as const

/**
 * Get TTL for a specific storage type
 */
export function getTTL(type: keyof typeof StorageConfig.ttl): number {
  return StorageConfig.ttl[type] || StorageConfig.ttl.cache
}

/**
 * Get stale-while-revalidate time for a specific type
 */
export function getStaleTime(type: keyof typeof StorageConfig.staleWhileRevalidate): number {
  return StorageConfig.staleWhileRevalidate[type] || 0
}

/**
 * Check if a value should be compressed based on size
 */
export function shouldCompress(size: number): boolean {
  return StorageConfig.compression.enabled && size >= StorageConfig.compression.minSize
}

/**
 * Get cache tags for an entity
 */
export function getCacheTags(
  type: 'company' | 'snapshot' | 'diff' | 'analysis' | 'user',
  identifier: string
): string[] {
  const entityTag = StorageConfig.tags[type](identifier)
  const typeTag = StorageConfig.tags.types[`${type}s` as keyof typeof StorageConfig.tags.types] || type
  
  return [entityTag, typeTag]
}

export type StorageConfigType = typeof StorageConfig