/**
 * Storage Adapter
 * 
 * Provides a domain-specific API on top of UnifiedStorage
 * for backwards compatibility and cleaner code
 */

import { UnifiedStorage, StorageKeys } from './unified-storage'
import { kv } from '@/app/api/lib/kv-wrapper'
import type { Company, SnapshotMeta, DiffMeta } from '@inplain.ai/shared'

export class StorageAdapter {
  private storage: UnifiedStorage
  
  constructor() {
    this.storage = UnifiedStorage.getInstance()
  }
  
  // Company operations
  company = {
    get: async (slug: string): Promise<Company | null> => {
      const key = StorageKeys.company(slug)
      return this.storage.get<Company>(key)
    },
    
    set: async (slug: string, company: Company): Promise<void> => {
      const key = StorageKeys.company(slug)
      await this.storage.set(key, company, { ttl: 86400 }) // 24 hours
    },
    
    list: async (): Promise<Company[]> => {
      const listKey = StorageKeys.companyList()
      const companies = await this.storage.get<Company[]>(listKey)
      return companies || []
    }
  }
  
  // Snapshot operations
  snapshot = {
    get: async (slug: string, id: string): Promise<SnapshotMeta | null> => {
      const key = StorageKeys.snapshot(slug, id)
      return this.storage.get<SnapshotMeta>(key)
    },
    
    set: async (slug: string, snapshot: SnapshotMeta): Promise<void> => {
      const key = StorageKeys.snapshot(slug, snapshot.id)
      await this.storage.set(key, snapshot, { ttl: 0 }) // No expiry
      
      // Add to sorted set for ordering
      await kv.zadd(`snapshots:${slug}`, {
        score: new Date(snapshot.capturedAt).getTime(),
        member: key
      })
    },
    
    list: async (options: { companySlug: string; limit?: number }): Promise<SnapshotMeta[]> => {
      const { companySlug, limit = 10 } = options
      
      // Get latest snapshot keys from sorted set
      const keys = await kv.zrange(`snapshots:${companySlug}`, -limit, -1)
      if (!keys || keys.length === 0) return []
      
      // Fetch all snapshots
      const snapshots = await Promise.all(
        keys.map(key => {
          if (typeof key === 'string') {
            return this.storage.get<SnapshotMeta>(key)
          }
          return null
        })
      )
      
      return snapshots.filter(Boolean) as SnapshotMeta[]
    }
  }
  
  // Diff operations
  diff = {
    get: async (slug: string, id: string): Promise<DiffMeta | null> => {
      const key = StorageKeys.diff(slug, id)
      return this.storage.get<DiffMeta>(key)
    },
    
    set: async (slug: string, diff: DiffMeta): Promise<void> => {
      const key = StorageKeys.diff(slug, diff.id)
      await this.storage.set(key, diff, { ttl: 0 }) // No expiry
      
      // Add to sorted set for ordering
      await kv.zadd(`diffs:${slug}`, {
        score: new Date(diff.createdAt).getTime(),
        member: key
      })
    },
    
    list: async (options: { companySlug: string; limit?: number }): Promise<DiffMeta[]> => {
      const { companySlug, limit = 10 } = options
      
      // Get latest diff keys from sorted set
      const keys = await kv.zrange(`diffs:${companySlug}`, -limit, -1)
      if (!keys || keys.length === 0) return []
      
      // Fetch all diffs
      const diffs = await Promise.all(
        keys.map(key => {
          if (typeof key === 'string') {
            return this.storage.get<DiffMeta>(key)
          }
          return null
        })
      )
      
      return diffs.filter(Boolean) as DiffMeta[]
    }
  }
  
  // Content operations
  async getSnapshotContent(slug: string, id: string): Promise<string | null> {
    const key = StorageKeys.snapshotContent(slug, id)
    return this.storage.get<string>(key)
  }
  
  async setSnapshotContent(slug: string, id: string, content: string): Promise<void> {
    const key = StorageKeys.snapshotContent(slug, id)
    await this.storage.set(key, content, { ttl: 0, compress: true })
  }
  
  async getDiffContent(slug: string, id: string): Promise<{ htmlDiff: string } | null> {
    const key = StorageKeys.diffContent(slug, id)
    return this.storage.get<{ htmlDiff: string }>(key)
  }
  
  async setDiffContent(slug: string, id: string, content: { htmlDiff: string }): Promise<void> {
    const key = StorageKeys.diffContent(slug, id)
    await this.storage.set(key, content, { ttl: 0, compress: true })
  }
  
  // Analytics operations
  analytics = {
    get: async (slug: string, type: string): Promise<any> => {
      const key = StorageKeys.analysis(slug, type)
      return this.storage.get(key)
    },
    
    set: async (slug: string, type: string, data: any): Promise<void> => {
      const key = StorageKeys.analysis(slug, type)
      await this.storage.set(key, data, { ttl: 3600 }) // 1 hour cache
    }
  }
}

// Export singleton instance
export const storage = new StorageAdapter()