/**
 * Diff Calculator
 * 
 * Calculates differences between privacy policy snapshots
 */

import * as diff from 'diff'
import { storage } from '@/lib/storage/adapter'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'
import { formatTimestamp } from '@inplain.ai/shared'
import type { DiffMeta } from '@inplain.ai/shared'

export interface DiffCalculationResult {
  additions: number
  deletions: number
  changeCount: number
  changeType: 'minor' | 'moderate' | 'major'
  htmlDiff: string
  textDiff: string
}

export class DiffCalculator {
  /**
   * Calculate diff between two snapshots
   */
  static async calculateDiff(
    slug: string,
    fromSnapshotId: string,
    toSnapshotId: string
  ): Promise<DiffMeta | null> {
    try {
      // Get snapshot content
      const [fromContent, toContent] = await Promise.all([
        storage.getSnapshotContent(slug, fromSnapshotId),
        storage.getSnapshotContent(slug, toSnapshotId)
      ])
      
      if (!fromContent || !toContent) {
        logger.error('Missing snapshot content', {
          slug,
          fromSnapshotId,
          toSnapshotId,
          hasFrom: !!fromContent,
          hasTo: !!toContent
        })
        return null
      }
      
      // Calculate diff
      const diffResult = this.computeDiff(fromContent, toContent)
      
      // Create diff metadata
      const diffId = uuidv4()
      const diff: DiffMeta = {
        id: diffId,
        slug,
        fromSnapshotId,
        toSnapshotId,
        createdAt: formatTimestamp(),
        changeCount: diffResult.changeCount,
        changeType: diffResult.changeType,
        additions: diffResult.additions,
        deletions: diffResult.deletions,
        diffBlobKey: `diffs/${slug}/${diffId}.html`
      }
      
      // Store diff
      await storage.diff.set(slug, diff)
      
      // Store diff content
      await storage.setDiffContent(slug, diffId, {
        htmlDiff: diffResult.htmlDiff
      })
      
      logger.info('Diff calculated', {
        slug,
        diffId,
        changes: diffResult.changeCount,
        type: diffResult.changeType
      })
      
      return diff
    } catch (error) {
      logger.error('Diff calculation error:', error)
      return null
    }
  }
  
  /**
   * Compute the actual diff
   */
  private static computeDiff(
    fromContent: string,
    toContent: string
  ): DiffCalculationResult {
    // Normalize content
    const normalizedFrom = this.normalizeContent(fromContent)
    const normalizedTo = this.normalizeContent(toContent)
    
    // Calculate line diff
    const lineDiff = diff.diffLines(normalizedFrom, normalizedTo)
    
    let additions = 0
    let deletions = 0
    let htmlDiff = '<div class="diff">'
    let textDiff = ''
    
    for (const part of lineDiff) {
      if (part.added) {
        additions += part.count || 0
        htmlDiff += `<div class="diff-addition">${this.escapeHtml(part.value)}</div>`
        textDiff += `+ ${part.value}`
      } else if (part.removed) {
        deletions += part.count || 0
        htmlDiff += `<div class="diff-deletion">${this.escapeHtml(part.value)}</div>`
        textDiff += `- ${part.value}`
      } else {
        // Context lines
        const lines = part.value.split('\n')
        const contextLines = lines.slice(0, 2).concat(lines.slice(-2))
        for (const line of contextLines) {
          if (line.trim()) {
            htmlDiff += `<div class="diff-context">${this.escapeHtml(line)}</div>`
          }
        }
      }
    }
    
    htmlDiff += '</div>'
    
    // Calculate word-level changes for more accurate count
    const wordDiff = diff.diffWords(normalizedFrom, normalizedTo)
    let wordAdditions = 0
    let wordDeletions = 0
    
    for (const part of wordDiff) {
      const wordCount = part.value.split(/\s+/).filter(w => w.length > 0).length
      if (part.added) {
        wordAdditions += wordCount
      } else if (part.removed) {
        wordDeletions += wordCount
      }
    }
    
    // Use word count for change count
    const changeCount = wordAdditions + wordDeletions
    
    // Determine change type
    let changeType: 'minor' | 'moderate' | 'major' = 'minor'
    if (changeCount > 500) {
      changeType = 'major'
    } else if (changeCount > 100) {
      changeType = 'moderate'
    }
    
    return {
      additions: wordAdditions,
      deletions: wordDeletions,
      changeCount,
      changeType,
      htmlDiff,
      textDiff
    }
  }
  
  /**
   * Normalize content for comparison
   */
  private static normalizeContent(content: string): string {
    return content
      // Remove HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters
      .replace(/[^\w\s.,;:!?()-]/g, '')
      // Trim lines
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
  }
  
  /**
   * Escape HTML for safe display
   */
  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return text.replace(/[&<>"']/g, m => map[m] || m)
  }
  
  /**
   * Generate a visual diff representation
   */
  static generateVisualDiff(
    fromContent: string,
    toContent: string
  ): string {
    const wordDiff = diff.diffWords(fromContent, toContent)
    let html = '<div class="visual-diff">'
    
    for (const part of wordDiff) {
      if (part.added) {
        html += `<ins class="diff-added">${this.escapeHtml(part.value)}</ins>`
      } else if (part.removed) {
        html += `<del class="diff-removed">${this.escapeHtml(part.value)}</del>`
      } else {
        html += this.escapeHtml(part.value)
      }
    }
    
    html += '</div>'
    return html
  }
}