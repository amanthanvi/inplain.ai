import DiffMatchPatch from 'diff-match-patch'
import { calculateChangeType } from '@inplain.ai/shared'

export interface DiffResult {
  patches: any[]
  additions: number
  deletions: number
  changeCount: number
  changeType: 'minor' | 'moderate' | 'major'
  htmlDiff: string
  processingInfo?: {
    chunked: boolean
    totalChunks?: number
    processingTime: number
    memoryUsed?: number
  }
}

export class DiffEngine {
  private dmp: DiffMatchPatch
  private static readonly MAX_CONTENT_SIZE = 1024 * 1024 // 1MB
  private static readonly CHUNK_SIZE = 256 * 1024 // 256KB
  private static readonly MAX_TIMEOUT = 10.0 // Increased timeout for large content

  constructor() {
    this.dmp = new DiffMatchPatch()
    this.dmp.Diff_Timeout = 2.0
    this.dmp.Diff_EditCost = 4
  }

  /**
   * Main diff computation with automatic chunking for large content
   */
  async computeDiff(oldText: string, newText: string): Promise<DiffResult> {
    const startTime = Date.now()
    const maxSize = Math.max(oldText.length, newText.length)
    
    // Check if content requires chunking
    if (maxSize > DiffEngine.MAX_CONTENT_SIZE) {
      console.log(`[DiffEngine] Large content detected (${maxSize} chars), using chunked processing`)
      return this.computeChunkedDiff(oldText, newText, startTime)
    }
    
    // Check memory availability
    if (!this.checkMemoryAvailable(maxSize * 3)) { // Estimate 3x memory usage for diff
      console.warn(`[DiffEngine] Insufficient memory for content size ${maxSize}, using chunked processing`)
      return this.computeChunkedDiff(oldText, newText, startTime)
    }
    
    return this.computeStandardDiff(oldText, newText, startTime)
  }

  /**
   * Standard diff computation for smaller content
   */
  private computeStandardDiff(oldText: string, newText: string, startTime: number): DiffResult {
    const diffs = this.dmp.diff_main(oldText, newText)
    this.dmp.diff_cleanupSemantic(diffs)
    
    const patches = this.dmp.patch_make(oldText, diffs)
    
    let additions = 0
    let deletions = 0
    let changeCount = 0

    diffs.forEach(([op, text]) => {
      if (op === 1) {
        additions += text.length
        changeCount++
      } else if (op === -1) {
        deletions += text.length
        changeCount++
      }
    })

    const total = Math.max(oldText.length, newText.length)
    const changeType = calculateChangeType(additions, deletions, total)
    
    const htmlDiff = this.generateHtmlDiff(diffs)

    return {
      patches,
      additions,
      deletions,
      changeCount,
      changeType,
      htmlDiff,
      processingInfo: {
        chunked: false,
        processingTime: Date.now() - startTime,
        memoryUsed: this.getMemoryUsage()
      }
    }
  }

  /**
   * Chunked diff computation for large content
   */
  private async computeChunkedDiff(oldText: string, newText: string, startTime: number): Promise<DiffResult> {
    const chunkSize = DiffEngine.CHUNK_SIZE
    const maxLength = Math.max(oldText.length, newText.length)
    const totalChunks = Math.ceil(maxLength / chunkSize)
    
    console.log(`[DiffEngine] Processing ${totalChunks} chunks of ${chunkSize} chars each`)
    
    let totalAdditions = 0
    let totalDeletions = 0
    let totalChangeCount = 0
    const allPatches: any[] = []
    const htmlChunks: string[] = []
    
    // Increase timeout for large processing
    const originalTimeout = this.dmp.Diff_Timeout
    this.dmp.Diff_Timeout = DiffEngine.MAX_TIMEOUT
    
    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, maxLength)
        
        const oldChunk = oldText.slice(start, end)
        const newChunk = newText.slice(start, end)
        
        // Process chunk
        const chunkResult = this.computeStandardDiff(oldChunk, newChunk, startTime)
        
        // Accumulate results
        totalAdditions += chunkResult.additions
        totalDeletions += chunkResult.deletions
        totalChangeCount += chunkResult.changeCount
        allPatches.push(...chunkResult.patches)
        htmlChunks.push(chunkResult.htmlDiff)
        
        // Yield to event loop every few chunks to prevent blocking
        if (i % 5 === 0) {
          await new Promise(resolve => setImmediate(resolve))
        }
        
        // Log progress for large operations
        if (totalChunks > 10 && i % Math.ceil(totalChunks / 10) === 0) {
          console.log(`[DiffEngine] Processed ${i + 1}/${totalChunks} chunks (${Math.round((i + 1) / totalChunks * 100)}%)`)
        }
      }
    } finally {
      // Restore original timeout
      this.dmp.Diff_Timeout = originalTimeout
    }
    
    const total = Math.max(oldText.length, newText.length)
    const changeType = calculateChangeType(totalAdditions, totalDeletions, total)
    
    return {
      patches: allPatches,
      additions: totalAdditions,
      deletions: totalDeletions,
      changeCount: totalChangeCount,
      changeType,
      htmlDiff: htmlChunks.join(''),
      processingInfo: {
        chunked: true,
        totalChunks,
        processingTime: Date.now() - startTime,
        memoryUsed: this.getMemoryUsage()
      }
    }
  }

  /**
   * Memory-efficient HTML diff generation with streaming
   */
  private generateHtmlDiff(diffs: Array<[number, string]>): string {
    let html = ''
    
    diffs.forEach(([op, text]) => {
      const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
      
      if (op === 1) {
        html += `<ins class="diff-addition">${escapedText}</ins>`
      } else if (op === -1) {
        html += `<del class="diff-deletion">${escapedText}</del>`
      } else {
        html += escapedText
      }
    })
    
    return html
  }

  applyPatches(text: string, patches: any[]): string {
    const [newText, results] = this.dmp.patch_apply(patches, text)
    const allSuccessful = results.every(r => r)
    
    if (!allSuccessful) {
      throw new Error('Failed to apply some patches')
    }
    
    return newText
  }

  /**
   * Check if sufficient memory is available for the operation
   */
  private checkMemoryAvailable(estimatedSize: number): boolean {
    try {
      // In browser environment, we can't check memory usage
      if (typeof process === 'undefined') {
        return estimatedSize < DiffEngine.MAX_CONTENT_SIZE * 2
      }

      const usage = process.memoryUsage()
      const availableHeap = usage.heapTotal - usage.heapUsed
      const requiredMemory = estimatedSize + (100 * 1024 * 1024) // 100MB buffer
      
      return availableHeap > requiredMemory
    } catch {
      // If we can't check memory, be conservative
      return estimatedSize < DiffEngine.MAX_CONTENT_SIZE
    }
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    try {
      if (typeof process === 'undefined') {
        return 0
      }
      return process.memoryUsage().heapUsed
    } catch {
      return 0
    }
  }

  /**
   * Create a memory-efficient diff for very large content
   */
  async computeLargeDiff(oldText: string, newText: string): Promise<DiffResult> {
    console.log(`[DiffEngine] Computing large diff for content sizes: old=${oldText.length}, new=${newText.length}`)
    
    // For extremely large content, use line-based diffing first
    if (oldText.length > 5 * 1024 * 1024 || newText.length > 5 * 1024 * 1024) {
      return this.computeLineDiff(oldText, newText)
    }
    
    return this.computeDiff(oldText, newText)
  }

  /**
   * Line-based diff for extremely large content
   */
  private async computeLineDiff(oldText: string, newText: string): Promise<DiffResult> {
    const startTime = Date.now()
    
    // Split into lines for more efficient processing
    const oldLines = oldText.split('\n')
    const newLines = newText.split('\n')
    
    // Use diff-match-patch on line arrays instead of character arrays
    const lineDiffs = this.dmp.diff_main(oldLines.join('\n'), newLines.join('\n'))
    this.dmp.diff_cleanupSemantic(lineDiffs)
    
    let additions = 0
    let deletions = 0
    let changeCount = 0
    
    lineDiffs.forEach(([op, text]) => {
      if (op === 1) {
        additions += text.length
        changeCount++
      } else if (op === -1) {
        deletions += text.length
        changeCount++
      }
    })
    
    const total = Math.max(oldText.length, newText.length)
    const changeType = calculateChangeType(additions, deletions, total)
    
    // Generate simplified HTML for line diffs
    const htmlDiff = this.generateLineHtmlDiff(lineDiffs)
    
    return {
      patches: this.dmp.patch_make(oldText, lineDiffs),
      additions,
      deletions,
      changeCount,
      changeType,
      htmlDiff,
      processingInfo: {
        chunked: true,
        totalChunks: Math.ceil(Math.max(oldLines.length, newLines.length) / 100),
        processingTime: Date.now() - startTime,
        memoryUsed: this.getMemoryUsage()
      }
    }
  }

  /**
   * Generate HTML diff for line-based comparison
   */
  private generateLineHtmlDiff(diffs: Array<[number, string]>): string {
    const lines: string[] = []
    
    diffs.forEach(([op, text]) => {
      const textLines = text.split('\n')
      
      textLines.forEach(line => {
        const escapedLine = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        
        if (op === 1) {
          lines.push(`<div class="diff-line diff-addition">+ ${escapedLine}</div>`)
        } else if (op === -1) {
          lines.push(`<div class="diff-line diff-deletion">- ${escapedLine}</div>`)
        } else {
          lines.push(`<div class="diff-line">${escapedLine}</div>`)
        }
      })
    })
    
    return lines.join('\n')
  }
}