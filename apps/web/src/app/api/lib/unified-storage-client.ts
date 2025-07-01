/**
 * Unified Storage Client
 * 
 * High-level business logic for snapshot and diff management
 * Built on top of the unified storage system
 */

import { storage, StorageKeys, StorageOptions } from '@/lib/storage/unified-storage'
import { 
  SnapshotMeta, 
  SnapshotMetaSchema, 
  DiffMeta, 
  DiffMetaSchema,
  type Company
} from '@inplain.ai/shared'
import { HashUtils } from '@/lib/utils/hash'
import { logger } from '@/lib/logger'
import { formatTimestamp } from '@inplain.ai/shared'

export interface StorageClientOptions {
  cacheEnabled?: boolean
  cacheTTL?: number
  compressionEnabled?: boolean
}

export interface SnapshotContent {
  text: string
  html?: string
  extractedAt: string
  metadata?: Record<string, any>
}

export interface ExtractedContent {
  content: string
  html?: string
  timestamp?: string
  url?: string
  statusCode?: number
  title?: string
  metadata?: Record<string, any>
}

export interface DiffContent {
  patches: any[]
  htmlDiff: string
  fromSnapshot: string
  toSnapshot: string
  generatedAt: string
  additions?: number
  deletions?: number
  changeCount?: number
  ignoredChanges?: any[]
  hasSignificantChanges?: boolean
}

export class UnifiedStorageClient {
  private readonly options: Required<StorageClientOptions>
  
  constructor(options: StorageClientOptions = {}) {
    this.options = {
      cacheEnabled: true,
      cacheTTL: 3600, // 1 hour
      compressionEnabled: true,
      ...options
    }
  }
  
  // Snapshot Operations
  
  async saveSnapshot(snapshot: SnapshotMeta): Promise<void> {
    try {
      // Validate snapshot
      const validated = SnapshotMetaSchema.parse(snapshot)
      
      // Store snapshot metadata
      await storage.set(
        StorageKeys.snapshot(validated.slug, validated.id),
        validated,
        {
          ttl: 30 * 24 * 60 * 60, // 30 days
          tags: ['snapshot', `company:${validated.slug}`]
        }
      )
      
      // Update company's snapshot list
      const listKey = StorageKeys.snapshot(validated.slug, 'list')
      const list = await storage.get<string[]>(listKey) || []
      
      // Add to list if not already present
      if (!list.includes(validated.id)) {
        list.unshift(validated.id) // Add to beginning
        
        // Keep only latest 100 snapshots
        if (list.length > 100) {
          list.splice(100)
        }
        
        await storage.set(listKey, list, {
          ttl: 30 * 24 * 60 * 60,
          tags: ['snapshot-list', `company:${validated.slug}`]
        })
      }
      
      logger.info('Snapshot saved', { 
        slug: validated.slug, 
        id: validated.id 
      })
    } catch (error) {
      logger.error('Failed to save snapshot', { snapshot, error })
      throw error
    }
  }
  
  async getSnapshot(slug: string, id: string): Promise<SnapshotMeta | null> {
    const key = StorageKeys.snapshot(slug, id)
    
    if (this.options.cacheEnabled) {
      return storage.withCache(
        key,
        async () => this.fetchSnapshot(slug, id),
        {
          ttl: this.options.cacheTTL,
          staleWhileRevalidate: 300 // 5 minutes
        }
      )
    }
    
    return this.fetchSnapshot(slug, id)
  }
  
  private async fetchSnapshot(slug: string, id: string): Promise<SnapshotMeta | null> {
    const snapshot = await storage.get<SnapshotMeta>(
      StorageKeys.snapshot(slug, id)
    )
    
    if (!snapshot) return null
    
    try {
      return SnapshotMetaSchema.parse(snapshot)
    } catch (error) {
      logger.error('Invalid snapshot data', { slug, id, error })
      return null
    }
  }
  
  async getLatestSnapshot(slug: string): Promise<SnapshotMeta | null> {
    const snapshots = await this.getLatestSnapshots(slug, 1)
    return snapshots[0] || null
  }
  
  async getLatestSnapshots(slug: string, limit: number = 10): Promise<SnapshotMeta[]> {
    try {
      // Get snapshot list
      const listKey = StorageKeys.snapshot(slug, 'list')
      const list = await storage.get<string[]>(listKey) || []
      
      if (list.length === 0) return []
      
      // Get requested snapshots
      const ids = list.slice(0, limit)
      const keys = ids.map(id => StorageKeys.snapshot(slug, id))
      const snapshots = await storage.mget<SnapshotMeta>(keys)
      
      // Filter out nulls and validate
      return snapshots
        .filter((s): s is SnapshotMeta => s !== null)
        .map(s => {
          try {
            return SnapshotMetaSchema.parse(s)
          } catch {
            return null
          }
        })
        .filter((s): s is SnapshotMeta => s !== null)
    } catch (error) {
      logger.error('Failed to get latest snapshots', { slug, limit, error })
      return []
    }
  }
  
  async saveSnapshotContent(
    blobKey: string, 
    content: SnapshotContent | ExtractedContent
  ): Promise<void> {
    try {
      // Convert ExtractedContent to SnapshotContent if needed
      const snapshotContent: SnapshotContent = 'text' in content
        ? content as SnapshotContent
        : {
            text: content.content,
            html: content.html,
            extractedAt: content.timestamp || formatTimestamp(),
            metadata: {
              url: content.url,
              statusCode: content.statusCode,
              title: content.title,
              ...content.metadata
            }
          }
      
      // Extract slug and id from blobKey
      const match = blobKey.match(/snapshots\/([^/]+)\/(.+)/)
      if (!match) {
        throw new Error('Invalid blob key format')
      }
      
      const [, slug, id] = match
      if (!slug || !id) {
        throw new Error('Invalid blob key components')
      }
      const contentKey = StorageKeys.snapshotContent(slug, id)
      
      // Generate content hash for deduplication
      const contentHash = await HashUtils.hashContent(snapshotContent.text)
      
      // Check if content already exists
      const existingHash = await storage.get<string>(`${contentKey}:hash`)
      if (existingHash === contentHash) {
        logger.debug('Snapshot content unchanged, skipping save', { blobKey })
        return
      }
      
      // Save content with compression if large
      await storage.set(contentKey, snapshotContent, {
        ttl: 30 * 24 * 60 * 60, // 30 days
        compress: this.options.compressionEnabled,
        tags: ['snapshot-content', `company:${slug}`]
      })
      
      // Save content hash
      await storage.set(`${contentKey}:hash`, contentHash, {
        ttl: 30 * 24 * 60 * 60
      })
      
      logger.info('Snapshot content saved', { blobKey, size: snapshotContent.text.length })
    } catch (error) {
      logger.error('Failed to save snapshot content', { blobKey, error })
      throw error
    }
  }
  
  async getSnapshotContent(blobKey: string): Promise<string | null> {
    try {
      const match = blobKey.match(/snapshots\/([^/]+)\/(.+)/)
      if (!match) return null
      
      const [, slug, id] = match
      if (!slug || !id) {
        throw new Error('Invalid blob key components')
      }
      const contentKey = StorageKeys.snapshotContent(slug, id)
      
      const content = await storage.get<SnapshotContent>(contentKey)
      return content?.text || null
    } catch (error) {
      logger.error('Failed to get snapshot content', { blobKey, error })
      return null
    }
  }
  
  // Diff Operations
  
  async saveDiff(diff: DiffMeta): Promise<void> {
    try {
      const validated = DiffMetaSchema.parse(diff)
      
      // Store diff metadata
      await storage.set(
        StorageKeys.diff(validated.slug, validated.id),
        validated,
        {
          ttl: 30 * 24 * 60 * 60, // 30 days
          tags: ['diff', `company:${validated.slug}`]
        }
      )
      
      // Update company's diff list
      const listKey = StorageKeys.diff(validated.slug, 'list')
      const list = await storage.get<string[]>(listKey) || []
      
      if (!list.includes(validated.id)) {
        list.unshift(validated.id)
        
        // Keep only latest 50 diffs
        if (list.length > 50) {
          list.splice(50)
        }
        
        await storage.set(listKey, list, {
          ttl: 30 * 24 * 60 * 60,
          tags: ['diff-list', `company:${validated.slug}`]
        })
      }
      
      logger.info('Diff saved', { slug: validated.slug, id: validated.id })
    } catch (error) {
      logger.error('Failed to save diff', { diff, error })
      throw error
    }
  }
  
  async getDiff(slug: string, id: string): Promise<DiffMeta | null> {
    const key = StorageKeys.diff(slug, id)
    
    if (this.options.cacheEnabled) {
      return storage.withCache(
        key,
        async () => this.fetchDiff(slug, id),
        {
          ttl: this.options.cacheTTL,
          staleWhileRevalidate: 300
        }
      )
    }
    
    return this.fetchDiff(slug, id)
  }
  
  private async fetchDiff(slug: string, id: string): Promise<DiffMeta | null> {
    const diff = await storage.get<DiffMeta>(StorageKeys.diff(slug, id))
    
    if (!diff) return null
    
    try {
      return DiffMetaSchema.parse(diff)
    } catch (error) {
      logger.error('Invalid diff data', { slug, id, error })
      return null
    }
  }
  
  async getLatestDiffs(slug: string, limit: number = 10): Promise<DiffMeta[]> {
    try {
      const listKey = StorageKeys.diff(slug, 'list')
      const list = await storage.get<string[]>(listKey) || []
      
      if (list.length === 0) return []
      
      const ids = list.slice(0, limit)
      const keys = ids.map(id => StorageKeys.diff(slug, id))
      const diffs = await storage.mget<DiffMeta>(keys)
      
      return diffs
        .filter((d): d is DiffMeta => d !== null)
        .map(d => {
          try {
            return DiffMetaSchema.parse(d)
          } catch {
            return null
          }
        })
        .filter((d): d is DiffMeta => d !== null)
    } catch (error) {
      logger.error('Failed to get latest diffs', { slug, limit, error })
      return []
    }
  }
  
  async saveDiffContent(blobKey: string, content: DiffContent): Promise<void> {
    try {
      const match = blobKey.match(/diffs\/([^/]+)\/(.+)/)
      if (!match) {
        throw new Error('Invalid diff blob key format')
      }
      
      const [, slug, id] = match
      if (!slug || !id) {
        throw new Error('Invalid blob key components')
      }
      const contentKey = StorageKeys.diffContent(slug, id)
      
      await storage.set(contentKey, content, {
        ttl: 30 * 24 * 60 * 60,
        compress: this.options.compressionEnabled,
        tags: ['diff-content', `company:${slug}`]
      })
      
      logger.info('Diff content saved', { blobKey })
    } catch (error) {
      logger.error('Failed to save diff content', { blobKey, error })
      throw error
    }
  }
  
  async getDiffContent(blobKey: string): Promise<DiffContent | null> {
    try {
      const match = blobKey.match(/diffs\/([^/]+)\/(.+)/)
      if (!match) return null
      
      const [, slug, id] = match
      if (!slug || !id) {
        throw new Error('Invalid blob key components')
      }
      const contentKey = StorageKeys.diffContent(slug, id)
      
      return await storage.get<DiffContent>(contentKey)
    } catch (error) {
      logger.error('Failed to get diff content', { blobKey, error })
      return null
    }
  }
  
  // Company Operations
  
  async saveCompany(company: Company): Promise<void> {
    await storage.set(
      StorageKeys.company(company.slug),
      company,
      {
        ttl: 7 * 24 * 60 * 60, // 7 days
        tags: ['company']
      }
    )
    
    // Update company list
    const listKey = StorageKeys.companyList()
    const list = await storage.get<string[]>(listKey) || []
    
    if (!list.includes(company.slug)) {
      list.push(company.slug)
      await storage.set(listKey, list, {
        ttl: 7 * 24 * 60 * 60,
        tags: ['company-list']
      })
    }
  }
  
  async getCompany(slug: string): Promise<Company | null> {
    return storage.get<Company>(StorageKeys.company(slug))
  }
  
  async getCompanies(limit?: number): Promise<Company[]> {
    const listKey = StorageKeys.companyList()
    const list = await storage.get<string[]>(listKey) || []
    
    const slugs = limit ? list.slice(0, limit) : list
    const keys = slugs.map(slug => StorageKeys.company(slug))
    const companies = await storage.mget<Company>(keys)
    
    return companies.filter((c): c is Company => c !== null)
  }
  
  // Cache Management
  
  async invalidateCompanyCache(slug: string): Promise<void> {
    await storage.invalidateByTags([`company:${slug}`])
  }
  
  async invalidateAllCaches(): Promise<void> {
    await storage.invalidateByTags([
      'company', 'snapshot', 'diff', 
      'snapshot-content', 'diff-content'
    ])
  }
  
  // Summary Operations (for backward compatibility)
  
  async saveSummary(
    slug: string, 
    summaryType: string, 
    summary: any
  ): Promise<void> {
    const key = StorageKeys.analysis(slug, summaryType)
    
    await storage.set(key, summary, {
      ttl: 7 * 24 * 60 * 60, // 7 days
      tags: ['analysis', `company:${slug}`]
    })
  }
  
  async getSummary(slug: string, summaryType: string): Promise<any | null> {
    const key = StorageKeys.analysis(slug, summaryType)
    return storage.get(key)
  }
}

// Export a default instance
export const unifiedStorageClient = new UnifiedStorageClient()

// Also export for custom configurations
export default UnifiedStorageClient