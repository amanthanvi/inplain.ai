import { StorageClient } from '@/app/api/lib/storage'
import { DiffMeta, Summary } from '@inplain.ai/shared'

export interface CompanyMetrics {
  checkInterval: number
  totalChanges: number
  privacyScore: 'Excellent' | 'Good' | 'Fair' | 'Poor'
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical'
  lastChecked?: string
  lastChange?: string
  changeFrequency?: 'Daily' | 'Weekly' | 'Monthly' | 'Rarely'
}

export class MetricsService {
  private storage: StorageClient

  constructor() {
    this.storage = new StorageClient()
  }

  async getCompanyMetrics(slug: string, checkInterval: number): Promise<CompanyMetrics> {
    try {
      // Get all diffs for this company
      const diffs = await this.storage.getLatestDiffs(slug, 100)
      
      // Get latest snapshot to check last update
      const snapshots = await this.storage.getLatestSnapshots(slug, 1)
      const lastSnapshot = snapshots[0]
      
      // Calculate total changes
      const totalChanges = diffs.length
      
      // Calculate privacy score based on recent changes
      const privacyScore = this.calculatePrivacyScore(diffs)
      
      // Calculate risk level based on change patterns
      const riskLevel = this.calculateRiskLevel(diffs)
      
      // Calculate change frequency
      const changeFrequency = this.calculateChangeFrequency(diffs)
      
      return {
        checkInterval: checkInterval / 3600, // Convert to hours
        totalChanges,
        privacyScore,
        riskLevel,
        lastChecked: lastSnapshot?.capturedAt,
        lastChange: diffs[0]?.createdAt,
        changeFrequency
      }
    } catch (error) {
      console.error('Error calculating metrics:', error)
      // Return default metrics if calculation fails
      return {
        checkInterval: checkInterval / 3600,
        totalChanges: 0,
        privacyScore: 'Fair',
        riskLevel: 'Medium'
      }
    }
  }

  private calculatePrivacyScore(diffs: DiffMeta[]): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
    if (diffs.length === 0) return 'Good'
    
    // Check recent changes (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentDiffs = diffs.filter(diff => 
      new Date(diff.createdAt) > thirtyDaysAgo
    )
    
    // Score based on change frequency and type
    let score = 100
    
    // Deduct points for frequent changes
    if (recentDiffs.length > 10) score -= 30
    else if (recentDiffs.length > 5) score -= 20
    else if (recentDiffs.length > 2) score -= 10
    
    // Deduct points for major changes
    const majorChanges = recentDiffs.filter(d => d.changeType === 'major').length
    score -= majorChanges * 15
    
    // Consider change volume
    const avgChangeSize = recentDiffs.reduce((sum, d) => 
      sum + d.additions + d.deletions, 0
    ) / (recentDiffs.length || 1)
    
    if (avgChangeSize > 5000) score -= 20
    else if (avgChangeSize > 1000) score -= 10
    
    // Map score to rating
    if (score >= 85) return 'Excellent'
    if (score >= 70) return 'Good'
    if (score >= 50) return 'Fair'
    return 'Poor'
  }

  private calculateRiskLevel(diffs: DiffMeta[]): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (diffs.length === 0) return 'Low'
    
    // Check recent major changes
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const recentMajorChanges = diffs.filter(diff => 
      new Date(diff.createdAt) > sevenDaysAgo && 
      diff.changeType === 'major'
    ).length
    
    // High frequency of major changes indicates higher risk
    if (recentMajorChanges >= 3) return 'Critical'
    if (recentMajorChanges >= 2) return 'High'
    
    // Check overall change patterns
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const monthlyChanges = diffs.filter(diff => 
      new Date(diff.createdAt) > thirtyDaysAgo
    ).length
    
    if (monthlyChanges > 15) return 'High'
    if (monthlyChanges > 8) return 'Medium'
    
    // Check for large changes
    const hasLargeChanges = diffs.some(d => 
      d.additions + d.deletions > 10000
    )
    
    if (hasLargeChanges) return 'Medium'
    
    return 'Low'
  }

  private calculateChangeFrequency(diffs: DiffMeta[]): 'Daily' | 'Weekly' | 'Monthly' | 'Rarely' {
    if (diffs.length < 2) return 'Rarely'
    
    // Calculate average time between changes
    const sortedDiffs = [...diffs].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    
    let totalDays = 0
    let changeCount = 0
    
    for (let i = 1; i < Math.min(sortedDiffs.length, 10); i++) {
      const prev = sortedDiffs[i-1]
      const curr = sortedDiffs[i]
      if (!prev || !curr) continue
      
      const timeDiff = new Date(prev.createdAt).getTime() - 
                      new Date(curr.createdAt).getTime()
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24)
      totalDays += daysDiff
      changeCount++
    }
    
    const avgDaysBetweenChanges = totalDays / changeCount
    
    if (avgDaysBetweenChanges <= 1) return 'Daily'
    if (avgDaysBetweenChanges <= 7) return 'Weekly'
    if (avgDaysBetweenChanges <= 30) return 'Monthly'
    return 'Rarely'
  }

  async getGlobalMetrics(): Promise<{
    totalCompanies: number
    totalChanges: number
    recentChanges: number
    highRiskCompanies: number
  }> {
    try {
      // This would normally query a database
      // For now, return estimated values
      return {
        totalCompanies: 8,
        totalChanges: 120,
        recentChanges: 15,
        highRiskCompanies: 2
      }
    } catch (error) {
      console.error('Error calculating global metrics:', error)
      return {
        totalCompanies: 0,
        totalChanges: 0,
        recentChanges: 0,
        highRiskCompanies: 0
      }
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService()