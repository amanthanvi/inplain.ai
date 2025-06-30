/**
 * KV-based Snapshot Manager for Inplain.AI
 * Phase 2: Reliable snapshot system with versioning using KV storage
 */

import { createHash } from 'crypto'
import { compress, decompress } from '@/lib/utils/compression'
import { kv } from '@/app/api/lib/kv-wrapper'
import { EnhancedContentExtractor } from '@/lib/content-extraction/enhanced-extractor'
import type { ExtractedContent } from '@/lib/content-extraction/enhanced-extractor'
import type { SnapshotMeta, DiffMeta } from '@inplain.ai/shared'
import { v4 as uuidv4 } from 'uuid'

export interface EnhancedSnapshotMeta extends Omit<SnapshotMeta, 'contentHash' | 'contentLength'> {
  version: number
  hash: string
  compressed: boolean
  content: string
  contentHash: string
  contentLength: number
  metadata: {
    extractionMethod: string
    quality: number
    language: string
    wordCount: number
    sections: Array<{
      title: string
      level: number
      wordCount: number
    }>
    dates: {
      effective?: string
      lastUpdated?: string
    }
  }
}

export interface EnhancedDiffMeta extends DiffMeta {
  fromVersion: number
  toVersion: number
  changes: DiffChange[]
  summary: DiffSummary
  riskAssessment?: {
    level: 'low' | 'medium' | 'high' | 'critical'
    score: number
  }
}

export interface DiffChange {
  type: 'added' | 'removed' | 'modified'
  section?: string
  oldValue?: string
  newValue?: string
  position: number
}

export interface DiffSummary {
  addedSections: number
  removedSections: number
  modifiedSections: number
  totalChanges: number
  changeRatio: number
}

export class KVSnapshotManager {
  private static instance: KVSnapshotManager
  private compressionThreshold = 10 * 1024 // 10KB
  private maxRetentionDays = 90
  private maxVersions = 30

  private constructor() {}

  static getInstance(): KVSnapshotManager {
    if (!this.instance) {
      this.instance = new KVSnapshotManager()
    }
    return this.instance
  }

  /**
   * Create a new snapshot with deduplication
   */
  async createSnapshot(
    slug: string,
    content: string,
    url: string,
    statusCode: number = 200
  ): Promise<EnhancedSnapshotMeta | null> {
    try {
      // Extract structured content
      const extracted = EnhancedContentExtractor.extract(content, url)
      
      // Generate content hash for deduplication
      const contentHash = this.generateHash(extracted.text)
      
      // Check if content already exists (deduplication)
      const existingSnapshot = await this.findByHash(slug, contentHash)
      if (existingSnapshot) {
        console.log(`Duplicate content detected for ${slug}, skipping snapshot`)
        return null
      }
      
      // Get the latest version number
      const latestVersion = await this.getLatestVersion(slug)
      const newVersion = latestVersion + 1
      
      // Compress if needed
      let finalContent = extracted.text
      let compressed = false
      
      if (finalContent.length > this.compressionThreshold) {
        finalContent = await compress(finalContent)
        compressed = true
      }
      
      // Create enhanced snapshot metadata
      const snapshot: EnhancedSnapshotMeta = {
        id: uuidv4(),
        slug,
        url,
        content: finalContent,
        contentType: 'text' as const,
        capturedAt: new Date().toISOString(),
        version: newVersion,
        hash: contentHash,
        compressed,
        contentHash: contentHash,
        contentLength: finalContent.length,
        blobKey: `${slug}/${uuidv4()}`,
        headers: {},
        status: 'processed' as const,
        metadata: {
          extractionMethod: extracted.quality.confidence,
          quality: extracted.quality.score,
          language: extracted.metadata.language,
          wordCount: extracted.metadata.wordCount,
          sections: extracted.metadata.sections.map(s => ({
            title: s.title,
            level: s.level,
            wordCount: s.wordCount
          })),
          dates: {
            effective: extracted.metadata.effectiveDate,
            lastUpdated: extracted.metadata.lastUpdated
          }
        }
      }
      
      // Store snapshot
      const snapshotKey = `snapshot:${slug}:${snapshot.id}`
      await kv.set(snapshotKey, snapshot, {
        ex: 86400 * this.maxRetentionDays // TTL in seconds
      })
      
      // Update version index
      await kv.zadd(`snapshots:${slug}`, {
        score: new Date(snapshot.capturedAt).getTime(),
        member: snapshot.id
      })
      
      // Update version mapping
      await kv.set(`snapshot:${slug}:version:${newVersion}`, snapshot.id, {
        ex: 86400 * this.maxRetentionDays
      })
      
      // Update latest snapshot reference
      await kv.set(`snapshot:${slug}:latest`, snapshot.id, {
        ex: 86400 * this.maxRetentionDays
      })
      
      // Create diff with previous version if exists
      if (latestVersion > 0) {
        const previousSnapshot = await this.getByVersion(slug, latestVersion)
        if (previousSnapshot) {
          await this.createDiff(slug, previousSnapshot.id, snapshot.id)
        }
      }
      
      // Cleanup old snapshots
      await this.cleanupOldSnapshots(slug)
      
      return snapshot
      
    } catch (error) {
      console.error('Error creating snapshot:', error)
      throw new Error(`Failed to create snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get snapshot by ID with decompression
   */
  async getSnapshot(slug: string, snapshotId: string): Promise<EnhancedSnapshotMeta | null> {
    try {
      const snapshot = await kv.get<EnhancedSnapshotMeta>(`snapshot:${slug}:${snapshotId}`)
      
      if (!snapshot) {
        return null
      }
      
      // Decompress content if needed
      if (snapshot.compressed && snapshot.content) {
        snapshot.content = await decompress(snapshot.content)
      }
      
      return snapshot
    } catch (error) {
      console.error('Error retrieving snapshot:', error)
      return null
    }
  }

  /**
   * Get snapshot by version
   */
  async getByVersion(slug: string, version: number): Promise<EnhancedSnapshotMeta | null> {
    try {
      const snapshotId = await kv.get<string>(`snapshot:${slug}:version:${version}`)
      
      if (!snapshotId) {
        return null
      }
      
      return this.getSnapshot(slug, snapshotId)
    } catch (error) {
      console.error('Error retrieving snapshot by version:', error)
      return null
    }
  }

  /**
   * Get latest snapshot
   */
  async getLatestSnapshot(slug: string): Promise<EnhancedSnapshotMeta | null> {
    try {
      const latestId = await kv.get<string>(`snapshot:${slug}:latest`)
      
      if (!latestId) {
        // Fallback to getting from sorted set
        const snapshotIds = await kv.zrange(`snapshots:${slug}`, -1, -1) as string[]
        if (!snapshotIds?.length || !snapshotIds[0]) return null
        return this.getSnapshot(slug, snapshotIds[0])
      }
      
      return this.getSnapshot(slug, latestId)
    } catch (error) {
      console.error('Error retrieving latest snapshot:', error)
      return null
    }
  }

  /**
   * Get multiple snapshots for a company
   */
  async getSnapshots(slug: string, limit: number = 10): Promise<EnhancedSnapshotMeta[]> {
    try {
      const snapshotIds = await kv.zrange(`snapshots:${slug}`, -limit, -1) as string[]
      
      if (!snapshotIds?.length) return []
      
      // Batch get all snapshots
      const snapshots = await Promise.all(
        snapshotIds.map(id => this.getSnapshot(slug, id))
      )
      
      return snapshots.filter(Boolean).reverse() as EnhancedSnapshotMeta[]
    } catch (error) {
      console.error('Error retrieving snapshots:', error)
      return []
    }
  }

  /**
   * Create a diff between two snapshots
   */
  async createDiff(
    slug: string,
    fromSnapshotId: string,
    toSnapshotId: string
  ): Promise<EnhancedDiffMeta> {
    try {
      const [fromSnapshot, toSnapshot] = await Promise.all([
        this.getSnapshot(slug, fromSnapshotId),
        this.getSnapshot(slug, toSnapshotId)
      ])
      
      if (!fromSnapshot || !toSnapshot) {
        throw new Error('One or both snapshots not found')
      }
      
      // Perform diff analysis
      const changes = this.analyzeDiff(
        fromSnapshot.content,
        toSnapshot.content,
        fromSnapshot.metadata.sections,
        toSnapshot.metadata.sections
      )
      
      // Calculate summary
      const summary: DiffSummary = {
        addedSections: changes.filter(c => c.type === 'added').length,
        removedSections: changes.filter(c => c.type === 'removed').length,
        modifiedSections: changes.filter(c => c.type === 'modified').length,
        totalChanges: changes.length,
        changeRatio: changes.length / Math.max(
          fromSnapshot.metadata.sections.length,
          toSnapshot.metadata.sections.length,
          1
        )
      }
      
      // Create diff metadata
      const diff: EnhancedDiffMeta = {
        id: uuidv4(),
        slug,
        fromSnapshotId,
        toSnapshotId,
        fromVersion: fromSnapshot.version,
        toVersion: toSnapshot.version,
        changes,
        summary,
        createdAt: new Date().toISOString(),
        changeCount: changes.length,
        changeType: summary.totalChanges > 10 ? 'major' : summary.totalChanges > 5 ? 'moderate' : 'minor',
        additions: summary.addedSections,
        deletions: summary.removedSections,
        diffBlobKey: `${slug}/diffs/${uuidv4()}`
      }
      
      // Store diff
      const diffKey = `diff:${slug}:${diff.id}`
      await kv.set(diffKey, diff, {
        ex: 86400 * this.maxRetentionDays
      })
      
      // Add to diff index
      await kv.zadd(`diffs:${slug}`, {
        score: new Date(diff.createdAt).getTime(),
        member: diff.id
      })
      
      // Store version-to-version mapping for quick lookup
      await kv.set(
        `diff:${slug}:v${fromSnapshot.version}-v${toSnapshot.version}`,
        diff.id,
        { ex: 86400 * this.maxRetentionDays }
      )
      
      return diff
    } catch (error) {
      console.error('Error creating diff:', error)
      throw new Error(`Failed to create diff: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get diff by ID
   */
  async getDiff(slug: string, diffId: string): Promise<EnhancedDiffMeta | null> {
    try {
      return await kv.get<EnhancedDiffMeta>(`diff:${slug}:${diffId}`)
    } catch (error) {
      console.error('Error retrieving diff:', error)
      return null
    }
  }

  /**
   * Get diff between versions
   */
  async getDiffBetweenVersions(
    slug: string,
    fromVersion: number,
    toVersion: number
  ): Promise<EnhancedDiffMeta | null> {
    try {
      const diffId = await kv.get<string>(`diff:${slug}:v${fromVersion}-v${toVersion}`)
      
      if (!diffId) {
        return null
      }
      
      return this.getDiff(slug, diffId)
    } catch (error) {
      console.error('Error retrieving diff between versions:', error)
      return null
    }
  }

  /**
   * Get diffs for a company
   */
  async getDiffs(slug: string, limit: number = 10): Promise<EnhancedDiffMeta[]> {
    try {
      const diffIds = await kv.zrange(`diffs:${slug}`, -limit, -1) as string[]
      
      if (!diffIds?.length) return []
      
      // Batch get all diffs
      const diffs = await Promise.all(
        diffIds.map(id => this.getDiff(slug, id))
      )
      
      return diffs.filter(Boolean).reverse() as EnhancedDiffMeta[]
    } catch (error) {
      console.error('Error retrieving diffs:', error)
      return []
    }
  }

  /**
   * Clean up old snapshots (retention policy)
   */
  async cleanupOldSnapshots(slug: string): Promise<number> {
    try {
      // Get all snapshot IDs
      const allSnapshotIds = await kv.zrange(`snapshots:${slug}`, 0, -1) as string[]
      
      if (!allSnapshotIds || allSnapshotIds.length <= this.maxVersions) {
        return 0
      }
      
      // Calculate how many to remove
      const toRemove = allSnapshotIds.length - this.maxVersions
      const snapshotsToDelete = allSnapshotIds.slice(0, toRemove)
      
      // Delete old snapshots
      for (const snapshotId of snapshotsToDelete) {
        await kv.del(`snapshot:${slug}:${snapshotId}`)
        // Note: We can't remove from sorted set with current KV client
        // The sorted set will grow but old IDs will point to deleted snapshots
      }
      
      // Clean up version mappings
      const firstSnapshotId = snapshotsToDelete[0]
      if (firstSnapshotId) {
        const snapshot = await this.getSnapshot(slug, firstSnapshotId)
        if (snapshot) {
          for (let v = 1; v < snapshot.version; v++) {
            await kv.del(`snapshot:${slug}:version:${v}`)
          }
        }
      }
      
      return snapshotsToDelete.length
    } catch (error) {
      console.error('Error cleaning up snapshots:', error)
      return 0
    }
  }

  /**
   * Get statistics for a company
   */
  async getStats(slug: string): Promise<{
    totalSnapshots: number
    totalDiffs: number
    oldestSnapshot: Date | null
    newestSnapshot: Date | null
    averageQuality: number
    languages: Record<string, number>
  }> {
    try {
      const [snapshotIds, diffIds, snapshots] = await Promise.all([
        kv.zrange(`snapshots:${slug}`, 0, -1) as Promise<string[]>,
        kv.zrange(`diffs:${slug}`, 0, -1) as Promise<string[]>,
        this.getSnapshots(slug, 100) // Get up to 100 for stats
      ])
      
      const snapshotCount = snapshotIds?.length || 0
      const diffCount = diffIds?.length || 0
      
      if (!snapshots.length) {
        return {
          totalSnapshots: 0,
          totalDiffs: 0,
          oldestSnapshot: null,
          newestSnapshot: null,
          averageQuality: 0,
          languages: {}
        }
      }
      
      const languages: Record<string, number> = {}
      let totalQuality = 0
      
      for (const snapshot of snapshots) {
        totalQuality += snapshot.metadata.quality
        const lang = snapshot.metadata.language
        languages[lang] = (languages[lang] || 0) + 1
      }
      
      const oldestSnapshot = snapshots[snapshots.length - 1]
      const newestSnapshot = snapshots[0]
      
      return {
        totalSnapshots: snapshotCount || 0,
        totalDiffs: diffCount || 0,
        oldestSnapshot: oldestSnapshot ? new Date(oldestSnapshot.capturedAt) : null,
        newestSnapshot: newestSnapshot ? new Date(newestSnapshot.capturedAt) : null,
        averageQuality: totalQuality / snapshots.length,
        languages
      }
    } catch (error) {
      console.error('Error calculating stats:', error)
      return {
        totalSnapshots: 0,
        totalDiffs: 0,
        oldestSnapshot: null,
        newestSnapshot: null,
        averageQuality: 0,
        languages: {}
      }
    }
  }

  /**
   * Private helper methods
   */

  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  private async findByHash(slug: string, hash: string): Promise<EnhancedSnapshotMeta | null> {
    try {
      // Get recent snapshots to check for duplicates
      const recentSnapshots = await this.getSnapshots(slug, 5)
      
      for (const snapshot of recentSnapshots) {
        if (snapshot.hash === hash) {
          return snapshot
        }
      }
      
      return null
    } catch (error) {
      return null
    }
  }

  private async getLatestVersion(slug: string): Promise<number> {
    try {
      const latestSnapshot = await this.getLatestSnapshot(slug)
      return latestSnapshot?.version || 0
    } catch (error) {
      return 0
    }
  }

  private analyzeDiff(
    oldContent: string,
    newContent: string,
    oldSections: Array<{ title: string; level: number }>,
    newSections: Array<{ title: string; level: number }>
  ): DiffChange[] {
    const changes: DiffChange[] = []
    
    // Track section changes
    const oldSectionTitles = new Set(oldSections.map(s => s.title))
    const newSectionTitles = new Set(newSections.map(s => s.title))
    
    // Find added sections
    let position = 0
    for (const section of newSections) {
      if (!oldSectionTitles.has(section.title)) {
        changes.push({
          type: 'added',
          section: section.title,
          newValue: section.title,
          position: position++
        })
      }
    }
    
    // Find removed sections
    for (const section of oldSections) {
      if (!newSectionTitles.has(section.title)) {
        changes.push({
          type: 'removed',
          section: section.title,
          oldValue: section.title,
          position: position++
        })
      }
    }
    
    // Find modified sections (simplified check)
    if (oldContent !== newContent) {
      for (const section of newSections) {
        if (oldSectionTitles.has(section.title)) {
          changes.push({
            type: 'modified',
            section: section.title,
            position: position++
          })
        }
      }
    }
    
    return changes
  }
}

// Export singleton instance
export const kvSnapshotManager = KVSnapshotManager.getInstance()