import { kv } from '@vercel/kv'
import { logger } from '@/lib/logger'
import { notificationService } from '@/lib/notifications/notification-service'
import { policyScraper } from '@/lib/scraper/policy-scraper'
import { circuitBreakers } from '@/lib/resilience/circuit-breaker'
// Use simple hash function for edge runtime compatibility
function createSimpleHash(data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16)
}

export interface PolicySnapshot {
  url: string
  companySlug: string
  content: string
  hash: string
  timestamp: string
  metadata?: {
    lastModified?: string
    contentLength?: number
    title?: string
  }
}

export interface PolicyChange {
  companySlug: string
  url: string
  previousHash: string
  currentHash: string
  changeType: 'content' | 'structure' | 'minor'
  changedSections: string[]
  timestamp: string
  diffUrl?: string
}

export class PolicyMonitor {
  private readonly checksumAlgorithm = 'sha256'
  
  /**
   * Check a policy for changes
   */
  async checkPolicy(
    companySlug: string,
    policyUrl: string
  ): Promise<PolicyChange | null> {
    try {
      // Get current policy content
      const currentContent = await circuitBreakers.externalAPI.execute(
        () => policyScraper.scrapePolicy(policyUrl),
        async () => {
          logger.warn('Policy scraping circuit breaker open', { companySlug })
          return null
        }
      )

      if (!currentContent) {
        logger.error('Failed to scrape policy', { companySlug, policyUrl })
        return null
      }

      // Calculate hash of current content
      const currentHash = this.calculateHash(currentContent.text)

      // Get previous snapshot
      const previousSnapshot = await this.getLatestSnapshot(companySlug)

      // If no previous snapshot, save current one
      if (!previousSnapshot) {
        await this.saveSnapshot({
          url: policyUrl,
          companySlug,
          content: currentContent.text,
          hash: currentHash,
          timestamp: new Date().toISOString(),
          metadata: {
            title: currentContent.title,
            contentLength: currentContent.text.length
          }
        })
        
        logger.info('Initial policy snapshot saved', { companySlug })
        return null
      }

      // Compare hashes
      if (previousSnapshot.hash === currentHash) {
        logger.debug('No policy changes detected', { companySlug })
        return null
      }

      // Analyze changes
      const change = await this.analyzeChanges(
        companySlug,
        policyUrl,
        previousSnapshot,
        {
          content: currentContent.text,
          hash: currentHash
        }
      )

      // Save new snapshot
      await this.saveSnapshot({
        url: policyUrl,
        companySlug,
        content: currentContent.text,
        hash: currentHash,
        timestamp: new Date().toISOString(),
        metadata: {
          title: currentContent.title,
          contentLength: currentContent.text.length
        }
      })

      // Record change
      await this.recordChange(change)

      return change
    } catch (error) {
      logger.error('Policy monitoring error', { error, companySlug })
      return null
    }
  }

  /**
   * Monitor multiple policies
   */
  async monitorPolicies(
    policies: Array<{ companySlug: string; url: string }>
  ): Promise<PolicyChange[]> {
    const changes: PolicyChange[] = []
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 5
    for (let i = 0; i < policies.length; i += batchSize) {
      const batch = policies.slice(i, i + batchSize)
      
      const batchPromises = batch.map(policy =>
        this.checkPolicy(policy.companySlug, policy.url)
      )
      
      const batchResults = await Promise.all(batchPromises)
      
      batchResults.forEach(change => {
        if (change) {
          changes.push(change)
        }
      })
      
      // Small delay between batches
      if (i + batchSize < policies.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return changes
  }

  /**
   * Analyze changes between two policy versions
   */
  private async analyzeChanges(
    companySlug: string,
    url: string,
    previousSnapshot: PolicySnapshot,
    current: { content: string; hash: string }
  ): Promise<PolicyChange> {
    // Simple change detection - can be enhanced with AI
    const previousLines = previousSnapshot.content.split('\n')
    const currentLines = current.content.split('\n')
    
    const changedSections: string[] = []
    let changeType: 'content' | 'structure' | 'minor' = 'minor'
    
    // Detect structural changes
    const structuralKeywords = ['chapter', 'section', 'article', 'clause']
    const previousStructure = previousLines.filter(line => 
      structuralKeywords.some(keyword => line.toLowerCase().includes(keyword))
    )
    const currentStructure = currentLines.filter(line => 
      structuralKeywords.some(keyword => line.toLowerCase().includes(keyword))
    )
    
    if (previousStructure.length !== currentStructure.length) {
      changeType = 'structure'
      changedSections.push('Document structure modified')
    }
    
    // Detect content changes in key sections
    const importantKeywords = [
      'data collection', 'sharing', 'third party', 'retention',
      'rights', 'cookies', 'tracking', 'consent', 'children'
    ]
    
    for (const keyword of importantKeywords) {
      const previousMentions = previousLines.filter(line => 
        line.toLowerCase().includes(keyword)
      ).length
      const currentMentions = currentLines.filter(line => 
        line.toLowerCase().includes(keyword)
      ).length
      
      if (previousMentions !== currentMentions) {
        changeType = changeType === 'minor' ? 'content' : changeType
        changedSections.push(`Changes related to "${keyword}"`)
      }
    }
    
    // Calculate change percentage
    const changePercentage = Math.abs(
      (current.content.length - previousSnapshot.content.length) / 
      previousSnapshot.content.length
    ) * 100
    
    if (changePercentage > 20) {
      changeType = 'content'
      changedSections.push('Significant content changes (>20%)')
    }
    
    return {
      companySlug,
      url,
      previousHash: previousSnapshot.hash,
      currentHash: current.hash,
      changeType,
      changedSections: [...new Set(changedSections)], // Remove duplicates
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Calculate hash of content
   */
  private calculateHash(content: string): string {
    // Normalize content before hashing (remove extra whitespace, etc.)
    const normalized = content
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
    
    return createSimpleHash(normalized)
  }

  /**
   * Get the latest snapshot for a company
   */
  private async getLatestSnapshot(
    companySlug: string
  ): Promise<PolicySnapshot | null> {
    const key = `policy:snapshot:${companySlug}:latest`
    return await kv.get<PolicySnapshot>(key)
  }

  /**
   * Save a policy snapshot
   */
  private async saveSnapshot(snapshot: PolicySnapshot): Promise<void> {
    const latestKey = `policy:snapshot:${snapshot.companySlug}:latest`
    const historyKey = `policy:snapshot:${snapshot.companySlug}:${snapshot.timestamp}`
    
    // Save to history
    await kv.set(historyKey, snapshot, { ex: 90 * 24 * 60 * 60 }) // 90 days
    
    // Update latest
    await kv.set(latestKey, snapshot)
    
    // Add to company's snapshot list
    await kv.zadd(
      `policy:snapshots:${snapshot.companySlug}`,
      { score: Date.now(), member: historyKey }
    )
    
    // Keep only last 10 snapshots
    await kv.zremrangebyrank(
      `policy:snapshots:${snapshot.companySlug}`,
      0,
      -11
    )
  }

  /**
   * Record a policy change
   */
  private async recordChange(change: PolicyChange): Promise<void> {
    const changeKey = `policy:change:${change.companySlug}:${change.timestamp}`
    
    // Save change record
    await kv.set(changeKey, change, { ex: 365 * 24 * 60 * 60 }) // 1 year
    
    // Add to company's change history
    await kv.zadd(
      `policy:changes:${change.companySlug}`,
      { score: Date.now(), member: changeKey }
    )
    
    // Add to global change feed
    await kv.zadd(
      'policy:changes:all',
      { score: Date.now(), member: changeKey }
    )
    
    // Notify users watching this company
    await this.notifyWatchers(change)
    
    logger.info('Policy change recorded', {
      companySlug: change.companySlug,
      changeType: change.changeType,
      sections: change.changedSections
    })
  }

  /**
   * Notify users watching a company about policy changes
   */
  private async notifyWatchers(change: PolicyChange): Promise<void> {
    try {
      await notificationService.notifyPolicyChange({
        companySlug: change.companySlug,
        changeType: change.changeType,
        timestamp: change.timestamp,
        severity: change.changeType === 'structure' ? 'high' : 
                 change.changeType === 'content' ? 'medium' : 'low'
      })
    } catch (error) {
      logger.error('Failed to notify watchers', { error, change })
    }
  }

  /**
   * Get recent changes across all companies
   */
  async getRecentChanges(limit: number = 10): Promise<PolicyChange[]> {
    const changeKeys = await kv.zrange('policy:changes:all', -limit, -1, {
      rev: true
    })
    
    const changes: PolicyChange[] = []
    for (const key of changeKeys) {
      const change = await kv.get<PolicyChange>(key as string)
      if (change) {
        changes.push(change)
      }
    }
    
    return changes
  }

  /**
   * Get change history for a company
   */
  async getCompanyChanges(
    companySlug: string,
    limit: number = 20
  ): Promise<PolicyChange[]> {
    const changeKeys = await kv.zrange(
      `policy:changes:${companySlug}`,
      -limit,
      -1,
      { rev: true }
    )
    
    const changes: PolicyChange[] = []
    for (const key of changeKeys) {
      const change = await kv.get<PolicyChange>(key as string)
      if (change) {
        changes.push(change)
      }
    }
    
    return changes
  }
}

// Export singleton instance
export const policyMonitor = new PolicyMonitor()