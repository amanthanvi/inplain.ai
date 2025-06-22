import { kv } from '@vercel/kv'
import { SnapshotMeta, DiffMeta, Summary } from '@policydiff/shared'
import { CacheService, CacheKeys, CacheTags } from '@/lib/cache'
import { DatabaseOptimizer } from '@/lib/db-optimizer'

export class OptimizedStorageClient {
  async getSnapshot(slug: string, snapshotId: string): Promise<SnapshotMeta | null> {
    return CacheService.wrap(
      CacheKeys.snapshot(slug, snapshotId),
      async () => {
        return kv.get<SnapshotMeta>(`snapshot:${slug}:${snapshotId}`)
      },
      { ttl: 86400, tags: [CacheTags.company(slug), CacheTags.snapshots] }
    )
  }

  async getLatestSnapshots(slug: string, limit = 2): Promise<SnapshotMeta[]> {
    return CacheService.wrap(
      CacheKeys.latestSnapshots(slug),
      async () => {
        const snapshotIds = await kv.zrange<string[]>(`snapshots:${slug}`, -limit, -1)
        
        if (!snapshotIds?.length) return []
        
        // Batch get all snapshots
        const snapshots = await DatabaseOptimizer.batchGet<SnapshotMeta>(
          snapshotIds.map(id => `snapshot:${slug}:${id}`)
        )
        
        return snapshots.filter(Boolean).reverse() as SnapshotMeta[]
      },
      { 
        ttl: 300, // 5 minutes - shorter because this changes frequently
        tags: [CacheTags.company(slug), CacheTags.snapshots],
        revalidate: 60 // 1 minute stale-while-revalidate
      }
    )
  }

  async saveSnapshot(snapshot: SnapshotMeta): Promise<void> {
    const key = `snapshot:${snapshot.slug}:${snapshot.id}`
    
    // Save snapshot
    await kv.set(key, snapshot, {
      ex: 86400 * 90 // 90 days
    })
    
    // Update index
    await kv.zadd(`snapshots:${snapshot.slug}`, {
      score: new Date(snapshot.capturedAt).getTime(),
      member: snapshot.id
    })
    
    // Invalidate relevant caches
    await Promise.all([
      CacheService.invalidateTag(CacheTags.company(snapshot.slug)),
      CacheService.invalidateTag(CacheTags.snapshots),
      CacheService.invalidate(CacheKeys.latestSnapshots(snapshot.slug))
    ])
  }

  async getSnapshotContent(blobKey: string): Promise<string | null> {
    // Content is large, so we use a shorter TTL and no tags
    return CacheService.wrap(
      `content:${blobKey}`,
      async () => {
        if (blobKey.startsWith('content:') || blobKey.startsWith('diff-content:')) {
          return kv.get<string>(blobKey)
        }
        
        // Legacy blob storage fallback
        try {
          const response = await fetch(blobKey)
          if (!response.ok) return null
          return response.text()
        } catch {
          return null
        }
      },
      { ttl: 1800 } // 30 minutes for content
    )
  }

  async getDiff(diffId: string): Promise<DiffMeta | null> {
    const parts = diffId.split(':')
    if (parts.length < 4) return null
    
    const [, slug, fromId, toId] = parts
    
    return CacheService.wrap(
      CacheKeys.diff(slug!, fromId!, toId!),
      async () => {
        return kv.get<DiffMeta>(`diff:${diffId}`)
      },
      { ttl: 86400, tags: [CacheTags.company(slug!), CacheTags.diffs] }
    )
  }

  async getLatestDiffs(slug: string, limit = 10): Promise<DiffMeta[]> {
    return CacheService.wrap(
      `diffs:latest:${slug}:${limit}`,
      async () => {
        const keys = await kv.zrange<string[]>(`diffs:${slug}`, -limit, -1)
        if (!keys?.length) return []
        
        const diffs = await DatabaseOptimizer.batchGet<DiffMeta>(keys)
        return diffs.filter(Boolean).reverse() as DiffMeta[]
      },
      { ttl: 600, tags: [CacheTags.company(slug), CacheTags.diffs] }
    )
  }

  async getSummary(summaryId: string): Promise<Summary | null> {
    return CacheService.wrap(
      CacheKeys.summary(summaryId),
      async () => {
        return kv.get<Summary>(`summary:${summaryId}`)
      },
      { ttl: 86400 } // Summaries don't change
    )
  }

  async saveSummary(summary: Summary): Promise<void> {
    await kv.set(`summary:${summary.id}`, summary, {
      ex: 86400 * 30
    })
  }

  async getDiffContent(blobKey: string): Promise<any | null> {
    return CacheService.wrap(
      `diff-content:${blobKey}`,
      async () => {
        if (blobKey.includes('diff-content:') || !blobKey.startsWith('http')) {
          const kvKey = blobKey.replace('diffs/', 'diff-content:')
          return kv.get(kvKey)
        }
        
        try {
          const response = await fetch(blobKey)
          if (!response.ok) return null
          const text = await response.text()
          return JSON.parse(text)
        } catch {
          return null
        }
      },
      { ttl: 3600 }
    )
  }

  async saveDiffContent(blobKey: string, content: any): Promise<void> {
    const kvKey = blobKey.replace('diffs/', 'diff-content:')
    await kv.set(kvKey, content, { ex: 86400 * 30 })
  }

  async getAllCompanySlugs(): Promise<string[]> {
    return CacheService.wrap(
      'companies:slugs',
      async () => {
        const pattern = 'snapshots:*'
        const keys = await kv.keys(pattern)
        
        if (!keys) return []
        
        const slugs = keys
          .map(key => key.match(/^snapshots:(.+)$/)?.[1])
          .filter(Boolean) as string[]
        
        return [...new Set(slugs)]
      },
      { ttl: 3600 } // 1 hour
    )
  }

  // Batch operations for performance
  async batchGetSnapshots(requests: { slug: string; id: string }[]): Promise<(SnapshotMeta | null)[]> {
    const keys = requests.map(r => `snapshot:${r.slug}:${r.id}`)
    return DatabaseOptimizer.batchGet<SnapshotMeta>(keys)
  }

  async preloadCompanyData(slug: string): Promise<void> {
    // Preload all data for a company page
    await Promise.all([
      this.getLatestSnapshots(slug, 5),
      this.getLatestDiffs(slug, 10),
      CacheService.warm([
        {
          key: CacheKeys.analysis(slug, 'latest', 'expert'),
          fn: async () => kv.get(`analysis-advanced:${slug}:latest:expert:premium`)
        }
      ])
    ])
  }
}