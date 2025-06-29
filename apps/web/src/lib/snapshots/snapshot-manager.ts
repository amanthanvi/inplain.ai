/**
 * Snapshot Manager for Inplain.AI
 * Phase 2: Reliable snapshot system with versioning and deduplication
 */

import { createHash } from 'crypto'
import { compress, decompress } from '@/lib/utils/compression'
import { kv } from '@/app/api/lib/kv-wrapper'
import { OptimizedStorageClient } from '@/app/api/lib/storage-optimized'
import { EnhancedContentExtractor } from '@/lib/content-extraction/enhanced-extractor'
import type { ExtractedContent } from '@/lib/content-extraction/enhanced-extractor'
import type { SnapshotMeta, DiffMeta } from '@inplain.ai/shared'

export interface SnapshotMetadata {
  version: number
  hash: string
  size: number
  compressed: boolean
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
    captured: string
    effective?: string
    lastUpdated?: string
  }
  source: {
    url: string
    statusCode: number
    headers: Record<string, string>
  }
}

export interface Snapshot {
  id: string
  policyId: string
  content: string
  metadata: SnapshotMetadata
  createdAt: Date
}

export interface SnapshotDiff {
  id: string
  fromSnapshotId: string
  toSnapshotId: string
  changes: DiffChange[]
  summary: {
    addedSections: number
    removedSections: number
    modifiedSections: number
    totalChanges: number
    changeRatio: number
  }
  createdAt: Date
}

export interface DiffChange {
  type: 'added' | 'removed' | 'modified'
  section?: string
  oldValue?: string
  newValue?: string
  position: number
}

export class SnapshotManager {
  private static instance: SnapshotManager
  private compressionThreshold = 10 * 1024 // 10KB

  private constructor() {}

  static getInstance(): SnapshotManager {
    if (!this.instance) {
      this.instance = new SnapshotManager()
    }
    return this.instance
  }

  /**
   * Create a new snapshot with deduplication
   */
  async createSnapshot(
    policyId: string,
    content: string,
    url: string,
    statusCode: number = 200,
    headers: Record<string, string> = {}
  ): Promise<Snapshot | null> {
    try {
      // Extract structured content
      const extracted = EnhancedContentExtractor.extract(content, url)
      
      // Generate content hash for deduplication
      const contentHash = this.generateHash(extracted.text)
      
      // Check if content already exists (deduplication)
      const existingSnapshot = await this.findByHash(policyId, contentHash)
      if (existingSnapshot) {
        console.log(`Duplicate content detected for policy ${policyId}, skipping snapshot`)
        return null
      }
      
      // Get the latest version number
      const latestVersion = await this.getLatestVersion(policyId)
      const newVersion = latestVersion + 1
      
      // Compress if needed
      let finalContent = extracted.text
      let compressed = false
      
      if (finalContent.length > this.compressionThreshold) {
        finalContent = await compress(finalContent)
        compressed = true
      }
      
      // Create metadata
      const metadata: SnapshotMetadata = {
        version: newVersion,
        hash: contentHash,
        size: content.length,
        compressed,
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
          captured: new Date().toISOString(),
          effective: extracted.metadata.effectiveDate,
          lastUpdated: extracted.metadata.lastUpdated
        },
        source: {
          url,
          statusCode,
          headers
        }
      }
      
      // Store in database
      const [snapshot] = await db.insert(snapshots).values({
        policyId,
        content: finalContent,
        metadata: JSON.stringify(metadata),
        version: newVersion,
        hash: contentHash,
        compressed,
        capturedAt: new Date()
      }).returning()
      
      // Update policy with latest snapshot
      await db.update(policies)
        .set({
          latestSnapshotId: snapshot.id,
          lastCheckedAt: new Date()
        })
        .where(eq(policies.id, policyId))
      
      // Create diff with previous version if exists
      if (latestVersion > 0) {
        const previousSnapshot = await this.getByVersion(policyId, latestVersion)
        if (previousSnapshot) {
          await this.createDiff(previousSnapshot.id, snapshot.id)
        }
      }
      
      return {
        id: snapshot.id,
        policyId: snapshot.policyId,
        content: finalContent,
        metadata,
        createdAt: snapshot.capturedAt
      }
      
    } catch (error) {
      console.error('Error creating snapshot:', error)
      throw new Error(`Failed to create snapshot: ${error.message}`)
    }
  }

  /**
   * Get snapshot by ID with decompression
   */
  async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
    try {
      const [snapshot] = await db.select()
        .from(snapshots)
        .where(eq(snapshots.id, snapshotId))
        .limit(1)
      
      if (!snapshot) {
        return null
      }
      
      const metadata = JSON.parse(snapshot.metadata) as SnapshotMetadata
      
      // Decompress content if needed
      let content = snapshot.content
      if (metadata.compressed) {
        content = await decompress(content)
      }
      
      return {
        id: snapshot.id,
        policyId: snapshot.policyId,
        content,
        metadata,
        createdAt: snapshot.capturedAt
      }
    } catch (error) {
      console.error('Error retrieving snapshot:', error)
      throw new Error(`Failed to retrieve snapshot: ${error.message}`)
    }
  }

  /**
   * Get snapshot by version
   */
  async getByVersion(policyId: string, version: number): Promise<Snapshot | null> {
    try {
      const [snapshot] = await db.select()
        .from(snapshots)
        .where(and(
          eq(snapshots.policyId, policyId),
          eq(snapshots.version, version)
        ))
        .limit(1)
      
      if (!snapshot) {
        return null
      }
      
      return this.getSnapshot(snapshot.id)
    } catch (error) {
      console.error('Error retrieving snapshot by version:', error)
      return null
    }
  }

  /**
   * Get all snapshots for a policy
   */
  async getPolicySnapshots(
    policyId: string,
    limit: number = 10
  ): Promise<Snapshot[]> {
    try {
      const results = await db.select()
        .from(snapshots)
        .where(eq(snapshots.policyId, policyId))
        .orderBy(desc(snapshots.version))
        .limit(limit)
      
      const snapshotPromises = results.map(s => this.getSnapshot(s.id))
      const snapshots = await Promise.all(snapshotPromises)
      
      return snapshots.filter(s => s !== null) as Snapshot[]
    } catch (error) {
      console.error('Error retrieving policy snapshots:', error)
      return []
    }
  }

  /**
   * Create a diff between two snapshots
   */
  async createDiff(
    fromSnapshotId: string,
    toSnapshotId: string
  ): Promise<SnapshotDiff> {
    try {
      const [fromSnapshot, toSnapshot] = await Promise.all([
        this.getSnapshot(fromSnapshotId),
        this.getSnapshot(toSnapshotId)
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
      const summary = {
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
      
      // Store diff in database
      const [diff] = await db.insert(diffs).values({
        fromSnapshotId,
        toSnapshotId,
        policyId: fromSnapshot.policyId,
        changes: JSON.stringify(changes),
        summary: JSON.stringify(summary),
        createdAt: new Date()
      }).returning()
      
      return {
        id: diff.id,
        fromSnapshotId,
        toSnapshotId,
        changes,
        summary,
        createdAt: diff.createdAt
      }
    } catch (error) {
      console.error('Error creating diff:', error)
      throw new Error(`Failed to create diff: ${error.message}`)
    }
  }

  /**
   * Get diffs for a policy
   */
  async getPolicyDiffs(
    policyId: string,
    limit: number = 10
  ): Promise<SnapshotDiff[]> {
    try {
      const results = await db.select()
        .from(diffs)
        .where(eq(diffs.policyId, policyId))
        .orderBy(desc(diffs.createdAt))
        .limit(limit)
      
      return results.map(d => ({
        id: d.id,
        fromSnapshotId: d.fromSnapshotId,
        toSnapshotId: d.toSnapshotId,
        changes: JSON.parse(d.changes),
        summary: JSON.parse(d.summary),
        createdAt: d.createdAt
      }))
    } catch (error) {
      console.error('Error retrieving policy diffs:', error)
      return []
    }
  }

  /**
   * Clean up old snapshots (retention policy)
   */
  async cleanupOldSnapshots(
    policyId: string,
    keepVersions: number = 30,
    keepDays: number = 90
  ): Promise<number> {
    try {
      // Get cutoff date
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - keepDays)
      
      // Get snapshots to keep
      const keepSnapshots = await db.select({ id: snapshots.id })
        .from(snapshots)
        .where(eq(snapshots.policyId, policyId))
        .orderBy(desc(snapshots.version))
        .limit(keepVersions)
      
      const keepIds = keepSnapshots.map(s => s.id)
      
      // Delete old snapshots
      const result = await db.delete(snapshots)
        .where(and(
          eq(snapshots.policyId, policyId),
          lt(snapshots.capturedAt, cutoffDate),
          // Keep recent versions even if old
          keepIds.length > 0 ? not(inArray(snapshots.id, keepIds)) : undefined
        ))
      
      return result.rowCount || 0
    } catch (error) {
      console.error('Error cleaning up snapshots:', error)
      return 0
    }
  }

  /**
   * Analyze differences between two contents
   */
  private analyzeDiff(
    oldContent: string,
    newContent: string,
    oldSections: Array<{ title: string; level: number }>,
    newSections: Array<{ title: string; level: number }>
  ): DiffChange[] {
    const changes: DiffChange[] = []
    
    // Simple line-based diff for now
    // TODO: Implement more sophisticated diff algorithm
    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')
    
    // Track section changes
    const oldSectionTitles = new Set(oldSections.map(s => s.title))
    const newSectionTitles = new Set(newSections.map(s => s.title))
    
    // Find added sections
    for (const section of newSections) {
      if (!oldSectionTitles.has(section.title)) {
        changes.push({
          type: 'added',
          section: section.title,
          newValue: section.title,
          position: newSections.indexOf(section)
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
          position: oldSections.indexOf(section)
        })
      }
    }
    
    // Basic content change detection
    if (oldContent !== newContent) {
      // Find modified sections by comparing content
      for (const section of newSections) {
        if (oldSectionTitles.has(section.title)) {
          // Section exists in both, check if content changed
          // This is simplified - real implementation would compare section content
          changes.push({
            type: 'modified',
            section: section.title,
            position: newSections.indexOf(section)
          })
        }
      }
    }
    
    return changes
  }

  /**
   * Generate hash for content deduplication
   */
  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  /**
   * Find snapshot by content hash
   */
  private async findByHash(
    policyId: string,
    hash: string
  ): Promise<Snapshot | null> {
    try {
      const [snapshot] = await db.select()
        .from(snapshots)
        .where(and(
          eq(snapshots.policyId, policyId),
          eq(snapshots.hash, hash)
        ))
        .orderBy(desc(snapshots.version))
        .limit(1)
      
      return snapshot ? this.getSnapshot(snapshot.id) : null
    } catch (error) {
      return null
    }
  }

  /**
   * Get latest version number for a policy
   */
  private async getLatestVersion(policyId: string): Promise<number> {
    try {
      const [result] = await db.select({ version: snapshots.version })
        .from(snapshots)
        .where(eq(snapshots.policyId, policyId))
        .orderBy(desc(snapshots.version))
        .limit(1)
      
      return result?.version || 0
    } catch (error) {
      return 0
    }
  }

  /**
   * Export snapshots for backup
   */
  async exportSnapshots(policyId: string): Promise<{
    policy: string
    snapshots: Snapshot[]
    diffs: SnapshotDiff[]
  }> {
    try {
      const [snapshots, diffs] = await Promise.all([
        this.getPolicySnapshots(policyId, 1000), // Export all
        this.getPolicyDiffs(policyId, 1000)
      ])
      
      return {
        policy: policyId,
        snapshots,
        diffs
      }
    } catch (error) {
      console.error('Error exporting snapshots:', error)
      throw new Error(`Failed to export snapshots: ${error.message}`)
    }
  }

  /**
   * Get snapshot statistics
   */
  async getStats(policyId: string): Promise<{
    totalSnapshots: number
    totalSize: number
    averageQuality: number
    languages: Record<string, number>
    retentionInfo: {
      oldestSnapshot: Date | null
      newestSnapshot: Date | null
    }
  }> {
    try {
      const snapshots = await this.getPolicySnapshots(policyId, 1000)
      
      if (snapshots.length === 0) {
        return {
          totalSnapshots: 0,
          totalSize: 0,
          averageQuality: 0,
          languages: {},
          retentionInfo: {
            oldestSnapshot: null,
            newestSnapshot: null
          }
        }
      }
      
      const stats = {
        totalSnapshots: snapshots.length,
        totalSize: snapshots.reduce((sum, s) => sum + s.metadata.size, 0),
        averageQuality: snapshots.reduce((sum, s) => sum + s.metadata.quality, 0) / snapshots.length,
        languages: {} as Record<string, number>,
        retentionInfo: {
          oldestSnapshot: snapshots[snapshots.length - 1].createdAt,
          newestSnapshot: snapshots[0].createdAt
        }
      }
      
      // Count languages
      for (const snapshot of snapshots) {
        const lang = snapshot.metadata.language
        stats.languages[lang] = (stats.languages[lang] || 0) + 1
      }
      
      return stats
    } catch (error) {
      console.error('Error calculating stats:', error)
      throw error
    }
  }
}

// Export singleton instance
export const snapshotManager = SnapshotManager.getInstance()