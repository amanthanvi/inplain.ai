import DiffMatchPatch from 'diff-match-patch'
import crypto from 'crypto'

interface ChangeDetectionResult {
  hasSignificantChanges: boolean
  changeCount: number
  additions: number
  deletions: number
  changeType: 'none' | 'minor' | 'moderate' | 'major'
  filteredDiff: string
  contentHash: string
  ignoredChanges: string[]
}

// Patterns to ignore in diff detection
const IGNORE_PATTERNS = [
  // Timestamps and dates
  /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\b/g, // ISO dates
  /\b\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\b/g, // Standard dates
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
  /\b\d{1,2}\/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/\d{4}\b/gi,
  
  // Session/nonce/token patterns
  /\bnonce["\s:=]+["']?[a-zA-Z0-9+\/=_-]{8,}["']?/gi,
  /\bsession[_-]?id["\s:=]+["']?[a-zA-Z0-9+\/=_-]{16,}["']?/gi,
  /\bcsrf[_-]?token["\s:=]+["']?[a-zA-Z0-9+\/=_-]{16,}["']?/gi,
  /\b[a-f0-9]{32,64}\b/g, // Hash values
  
  // Version numbers that auto-increment
  /\bv?\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?/g, // Semantic versions
  /\bbuild[_-]?(\d+|number)["\s:=]+\d+/gi,
  
  // Analytics and tracking IDs
  /\b(ga|gtag|_ga|_gid|fbp|fbc)[=_][a-zA-Z0-9._-]+/gi,
  /\bgoogle[_-]?analytics[_-]?[a-zA-Z0-9]+/gi,
  /\bua-\d+-\d+/gi, // Google Analytics IDs
  
  // Dynamic content markers
  /<!--\s*DYNAMIC[_-]CONTENT[_-]START\s*-->[\s\S]*?<!--\s*DYNAMIC[_-]CONTENT[_-]END\s*-->/gi,
  /\{\{[^}]+\}\}/g, // Template variables
  
  // Whitespace normalization
  /\s+/g, // Will be handled specially
]

// Keywords that indicate significant changes
const SIGNIFICANT_KEYWORDS = {
  high: [
    'collect', 'share', 'sell', 'third party', 'advertiser',
    'personal information', 'personal data', 'sensitive',
    'biometric', 'location', 'track', 'monitor', 'consent'
  ],
  medium: [
    'cookie', 'analytics', 'marketing', 'preference',
    'email', 'communication', 'update', 'change'
  ],
  low: [
    'typo', 'formatting', 'clarification', 'minor',
    'grammatical', 'spelling'
  ]
}

export class SmartDiffEngine {
  private dmp: any

  constructor() {
    this.dmp = new (DiffMatchPatch as any)()
    this.dmp.Diff_Timeout = 2.0 // 2 seconds
  }

  detectChanges(oldContent: string, newContent: string): ChangeDetectionResult {
    // Normalize content before comparison
    const normalizedOld = this.normalizeContent(oldContent)
    const normalizedNew = this.normalizeContent(newContent)

    // Quick hash check
    const oldHash = this.hashContent(normalizedOld)
    const newHash = this.hashContent(normalizedNew)

    if (oldHash === newHash) {
      return {
        hasSignificantChanges: false,
        changeCount: 0,
        additions: 0,
        deletions: 0,
        changeType: 'none',
        filteredDiff: '',
        contentHash: newHash,
        ignoredChanges: []
      }
    }

    // Perform diff
    const diffs = this.dmp.diff_main(normalizedOld, normalizedNew)
    this.dmp.diff_cleanupSemantic(diffs)

    // Analyze diffs
    const analysis = this.analyzeDiffs(diffs, oldContent, newContent)

    return {
      ...analysis,
      contentHash: newHash
    }
  }

  private normalizeContent(content: string): string {
    let normalized = content

    // Apply ignore patterns
    for (const pattern of IGNORE_PATTERNS) {
      if (pattern.toString() === '/\\s+/g') {
        // Special handling for whitespace
        normalized = normalized.replace(/\s+/g, ' ').trim()
      } else {
        normalized = normalized.replace(pattern, '[IGNORED]')
      }
    }

    // Remove common boilerplate
    normalized = this.removeBoilerplate(normalized)

    return normalized
  }

  private removeBoilerplate(content: string): string {
    // Remove common header/footer boilerplate
    const boilerplatePatterns = [
      /<!DOCTYPE[^>]*>/gi,
      /<script[^>]*>[^<]*<\/script>/gi,
      /<style[^>]*>[^<]*<\/style>/gi,
      /<!--[^>]*-->/g,
      /<meta[^>]*>/gi,
    ]

    let cleaned = content
    for (const pattern of boilerplatePatterns) {
      cleaned = cleaned.replace(pattern, '')
    }

    return cleaned
  }

  private analyzeDiffs(diffs: any[], oldContent: string, newContent: string): Omit<ChangeDetectionResult, 'contentHash'> {
    let additions = 0
    let deletions = 0
    let significantChanges = 0
    const ignoredChanges: string[] = []
    
    // Filter out non-significant diffs
    const filteredDiffs = diffs.filter(([op, text]) => {
      if (op === 0) return true // Keep unchanged text
      
      // Check if this change is just whitespace
      if (text.trim().length === 0) {
        ignoredChanges.push('Whitespace change')
        return false
      }
      
      // Check if this change matches ignored patterns
      for (const pattern of IGNORE_PATTERNS) {
        if (pattern.test(text)) {
          ignoredChanges.push(`Ignored pattern: ${pattern.source.substring(0, 30)}...`)
          return false
        }
      }
      
      // Count significant changes
      if (op === 1) additions += text.length
      if (op === -1) deletions += text.length
      significantChanges++
      
      return true
    })

    const hasSignificantChanges = significantChanges > 0
    const changeCount = Math.floor((additions + deletions) / 50) // Rough word count

    // Determine change type based on keywords and change volume
    const changeType = this.determineChangeType(filteredDiffs, additions, deletions)

    // Generate filtered HTML diff
    const filteredDiff = this.generateHtmlDiff(filteredDiffs)

    return {
      hasSignificantChanges,
      changeCount,
      additions: Math.floor(additions / 5), // Rough word count
      deletions: Math.floor(deletions / 5),
      changeType,
      filteredDiff,
      ignoredChanges: [...new Set(ignoredChanges)] // Remove duplicates
    }
  }

  private determineChangeType(
    diffs: any[], 
    additions: number, 
    deletions: number
  ): 'none' | 'minor' | 'moderate' | 'major' {
    if (diffs.length === 0) return 'none'

    // Check for high-impact keywords
    const diffText = diffs.map(([, text]) => text).join(' ').toLowerCase()
    
    for (const keyword of SIGNIFICANT_KEYWORDS.high) {
      if (diffText.includes(keyword)) {
        return 'major'
      }
    }

    // Check change volume
    const totalChanges = additions + deletions
    if (totalChanges > 1000) return 'major'
    if (totalChanges > 200) return 'moderate'
    
    // Check for medium-impact keywords
    for (const keyword of SIGNIFICANT_KEYWORDS.medium) {
      if (diffText.includes(keyword)) {
        return 'moderate'
      }
    }

    return 'minor'
  }

  private generateHtmlDiff(diffs: any[]): string {
    let html = ''
    
    for (const [op, text] of diffs) {
      switch (op) {
        case -1: // Deletion
          html += `<del class="diff-deletion">${this.escapeHtml(text)}</del>`
          break
        case 1: // Addition
          html += `<ins class="diff-addition">${this.escapeHtml(text)}</ins>`
          break
        default: // No change
          html += this.escapeHtml(text)
      }
    }
    
    return html
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  private escapeHtml(text: string): string {
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
   * Compare two content hashes to quickly determine if content has changed
   */
  static quickCompare(hash1: string, hash2: string): boolean {
    return hash1 === hash2
  }
}