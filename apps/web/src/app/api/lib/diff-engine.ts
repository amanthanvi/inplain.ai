import DiffMatchPatch from 'diff-match-patch'
import { calculateChangeType } from '@inplain.ai/shared'

export interface DiffResult {
  patches: any[]
  additions: number
  deletions: number
  changeCount: number
  changeType: 'minor' | 'moderate' | 'major'
  htmlDiff: string
}

export class DiffEngine {
  private dmp: DiffMatchPatch

  constructor() {
    this.dmp = new DiffMatchPatch()
    this.dmp.Diff_Timeout = 2.0
    this.dmp.Diff_EditCost = 4
  }

  computeDiff(oldText: string, newText: string): DiffResult {
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
      htmlDiff
    }
  }

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
}