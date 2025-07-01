/**
 * Storage Migration Utilities
 * 
 * Helpers for migrating from legacy storage patterns to the unified storage system
 */

import { storage, StorageKeys, StorageOptions } from './unified-storage'
import { kv } from '@/app/api/lib/kv-wrapper'
import { logger } from '@/lib/logger'

export class StorageMigrator {
  /**
   * Migrate keys from old pattern to new pattern
   */
  static async migrateKeys(
    oldPattern: string,
    transformer: (oldKey: string) => { newKey: string; options?: StorageOptions } | null
  ): Promise<{ migrated: number; failed: number }> {
    const stats = { migrated: 0, failed: 0 }
    
    try {
      const oldKeys = await kv.keys(oldPattern)
      
      if (!oldKeys || oldKeys.length === 0) {
        logger.info('No keys found to migrate', { pattern: oldPattern })
        return stats
      }
      
      logger.info('Starting key migration', { pattern: oldPattern, count: oldKeys.length })
      
      // Process in batches to avoid memory issues
      const batchSize = 100
      for (let i = 0; i < oldKeys.length; i += batchSize) {
        const batch = oldKeys.slice(i, i + batchSize)
        
        await Promise.all(batch.map(async (oldKey) => {
          try {
            // Get transformation
            const transform = transformer(oldKey)
            if (!transform) {
              logger.debug('Skipping key - no transformation', { oldKey })
              return
            }
            
            // Get old value
            const value = await kv.get(oldKey)
            if (value === null) {
              logger.debug('Skipping key - null value', { oldKey })
              return
            }
            
            // Set with new key
            await storage.set(transform.newKey, value, transform.options)
            
            // Delete old key
            await kv.del(oldKey)
            
            stats.migrated++
            logger.debug('Migrated key', { oldKey, newKey: transform.newKey })
          } catch (error) {
            stats.failed++
            logger.error('Failed to migrate key', { oldKey, error })
          }
        }))
      }
      
      logger.info('Key migration completed', stats)
      return stats
    } catch (error) {
      logger.error('Key migration failed', { pattern: oldPattern, error })
      return stats
    }
  }
  
  /**
   * Common migration transformers
   */
  static transformers = {
    /**
     * Migrate old snapshot keys
     * From: snapshot/{slug}/{id} or snapshot:{slug}:{id}
     * To: snapshot:slug:id
     */
    snapshot: (oldKey: string) => {
      const match = oldKey.match(/snapshot[:/]([^:/]+)[:/](.+)/)
      if (!match) return null
      
      const [, slug, id] = match
      return {
        newKey: StorageKeys.snapshot(slug!, id!),
        options: { ttl: 30 * 24 * 60 * 60 } // 30 days
      }
    },
    
    /**
     * Migrate old diff keys
     * From: diff/{slug}/{id} or diff-{slug}-{id}
     * To: diff:slug:id
     */
    diff: (oldKey: string) => {
      const match = oldKey.match(/diff[:/\-]([^:/\-]+)[:/\-](.+)/)
      if (!match) return null
      
      const [, slug, id] = match
      return {
        newKey: StorageKeys.diff(slug!, id!),
        options: { ttl: 30 * 24 * 60 * 60 } // 30 days
      }
    },
    
    /**
     * Migrate old cache keys
     * From: cache/{domain}/{key} or {domain}-cache-{key}
     * To: cache:domain:key
     */
    cache: (oldKey: string) => {
      const match = oldKey.match(/(?:cache[:/])?([^:/\-]+)(?:[:/\-]cache[:/\-])?([^:/\-]+)/)
      if (!match) return null
      
      const [, domain, key] = match
      return {
        newKey: StorageKeys.cache(domain!, key!),
        options: { ttl: 60 * 60 } // 1 hour default for cache
      }
    },
    
    /**
     * Migrate company data
     * From: company-{slug} or companies:{slug}
     * To: company:slug
     */
    company: (oldKey: string) => {
      const match = oldKey.match(/(?:company|companies)[:\-](.+)/)
      if (!match) return null
      
      const [, slug] = match
      return {
        newKey: StorageKeys.company(slug!),
        options: { ttl: 7 * 24 * 60 * 60 } // 7 days
      }
    }
  }
  
  /**
   * Run all common migrations
   */
  static async runCommonMigrations(): Promise<void> {
    const migrations = [
      { pattern: 'snapshot*', transformer: this.transformers.snapshot },
      { pattern: 'diff*', transformer: this.transformers.diff },
      { pattern: '*cache*', transformer: this.transformers.cache },
      { pattern: 'company*', transformer: this.transformers.company },
      { pattern: 'companies:*', transformer: this.transformers.company }
    ]
    
    const results = []
    
    for (const { pattern, transformer } of migrations) {
      logger.info('Running migration', { pattern })
      const result = await this.migrateKeys(pattern, transformer)
      results.push({ pattern, ...result })
    }
    
    logger.info('All migrations completed', { results })
  }
  
  /**
   * Validate storage consistency
   */
  static async validateStorage(): Promise<{
    valid: boolean
    issues: string[]
  }> {
    const issues: string[] = []
    
    try {
      // Check for orphaned chunks
      const chunkKeys = await kv.keys('*:chunk:*')
      if (chunkKeys && chunkKeys.length > 0) {
        for (const chunkKey of chunkKeys) {
          const baseKey = chunkKey.replace(/:chunk:\d+$/, '')
          const metadata = await kv.get(`${baseKey}:meta`)
          
          if (!metadata) {
            issues.push(`Orphaned chunk found: ${chunkKey}`)
          }
        }
      }
      
      // Check for metadata without base keys
      const metaKeys = await kv.keys('*:meta')
      if (metaKeys && metaKeys.length > 0) {
        for (const metaKey of metaKeys) {
          const baseKey = metaKey.replace(/:meta$/, '')
          const exists = await kv.exists(baseKey)
          
          if (!exists) {
            issues.push(`Orphaned metadata found: ${metaKey}`)
          }
        }
      }
      
      // Check for invalid key patterns
      const allKeys = await kv.keys('*')
      if (allKeys && allKeys.length > 0) {
        const validPrefixes = [
          'snapshot:', 'diff:', 'cache:', 'company:', 
          'analysis:', 'user:', 'tag:', 'feedback:',
          'watchlist:', 'notification:', 'session:'
        ]
        
        for (const key of allKeys) {
          // Skip special keys
          if (key.includes(':meta') || key.includes(':chunk:') || key.includes(':stale')) {
            continue
          }
          
          const hasValidPrefix = validPrefixes.some(prefix => key.startsWith(prefix))
          if (!hasValidPrefix) {
            issues.push(`Invalid key pattern: ${key}`)
          }
        }
      }
      
      return {
        valid: issues.length === 0,
        issues
      }
    } catch (error) {
      logger.error('Storage validation failed', { error })
      return {
        valid: false,
        issues: ['Validation failed: ' + error]
      }
    }
  }
  
  /**
   * Clean up orphaned or invalid storage entries
   */
  static async cleanup(dryRun: boolean = true): Promise<{
    cleaned: number
    errors: number
  }> {
    const stats = { cleaned: 0, errors: 0 }
    
    try {
      const validation = await this.validateStorage()
      
      if (validation.valid) {
        logger.info('Storage is valid, no cleanup needed')
        return stats
      }
      
      logger.info('Starting storage cleanup', { 
        issues: validation.issues.length,
        dryRun 
      })
      
      for (const issue of validation.issues) {
        try {
          // Extract key from issue message
          const keyMatch = issue.match(/: (.+)$/)
          if (!keyMatch) continue
          
          const key = keyMatch[1]!
          
          if (dryRun) {
            logger.info('Would delete key', { key, issue })
            stats.cleaned++
          } else {
            await kv.del(key)
            logger.info('Deleted key', { key, issue })
            stats.cleaned++
          }
        } catch (error) {
          stats.errors++
          logger.error('Failed to clean up key', { issue, error })
        }
      }
      
      logger.info('Storage cleanup completed', { ...stats, dryRun })
      return stats
    } catch (error) {
      logger.error('Storage cleanup failed', { error })
      return stats
    }
  }
}