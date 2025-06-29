/**
 * Semantic Diff Engine for Inplain.AI
 * Phase 2: Advanced diff engine with semantic understanding
 */

import { diff_match_patch } from 'diff-match-patch'
import natural from 'natural'
import { UnifiedAIService } from '@/lib/ai/unified-ai-service'

export interface DiffChange {
  type: 'added' | 'removed' | 'modified'
  section?: string
  oldValue?: string
  newValue?: string
  position: number
}

export interface SemanticDiff {
  textChanges: TextChange[]
  semanticChanges: SemanticChange[]
  riskAssessment: RiskAssessment
  summary: DiffSummary
}

export interface TextChange {
  type: 'added' | 'removed' | 'modified'
  text: string
  position: number
  length: number
  section?: string
}

export interface SemanticChange {
  type: 'permission' | 'data_usage' | 'retention' | 'sharing' | 'rights' | 'security'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  oldPolicy?: string
  newPolicy?: string
  impact: string[]
  recommendation?: string
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical'
  score: number // 0-100
  factors: RiskFactor[]
  userImpact: string[]
  legalImplications: string[]
}

export interface RiskFactor {
  factor: string
  weight: number
  contribution: number
  details: string
}

export interface DiffSummary {
  totalChanges: number
  addedWords: number
  removedWords: number
  modifiedSections: string[]
  keyHighlights: string[]
  readingTime: {
    old: number
    new: number
    difference: number
  }
}

export class SemanticDiffEngine {
  private static instance: SemanticDiffEngine
  private dmp: any // diff_match_patch instance
  private tokenizer: any
  private tfidf: any
  private aiService?: UnifiedAIService

  private constructor() {
    // @ts-ignore
    this.dmp = new diff_match_patch()
    this.dmp.Diff_Timeout = 2.0 // 2 seconds
    this.dmp.Diff_EditCost = 4
    
    // Initialize NLP tools
    try {
      this.tokenizer = new natural.WordTokenizer()
      this.tfidf = new natural.TfIdf()
    } catch (error) {
      console.warn('Natural language processing not available:', error)
      // Fallback tokenizer
      this.tokenizer = {
        tokenize: (text: string) => text.split(/\s+/)
      }
    }
  }

  static getInstance(): SemanticDiffEngine {
    if (!this.instance) {
      this.instance = new SemanticDiffEngine()
    }
    return this.instance
  }

  /**
   * Perform comprehensive semantic diff analysis
   */
  async analyze(
    oldContent: string,
    newContent: string,
    oldSections: Array<{ title: string; content: string }>,
    newSections: Array<{ title: string; content: string }>
  ): Promise<SemanticDiff> {
    try {
      // Perform text-level diff
      const textChanges = this.computeTextChanges(oldContent, newContent, oldSections, newSections)
      
      // Extract semantic changes using AI
      const semanticChanges = await this.extractSemanticChanges(
        oldContent,
        newContent,
        textChanges
      )
      
      // Assess risk and impact
      const riskAssessment = this.assessRisk(semanticChanges, textChanges)
      
      // Generate summary
      const summary = this.generateSummary(
        textChanges,
        semanticChanges,
        oldContent,
        newContent
      )
      
      return {
        textChanges,
        semanticChanges,
        riskAssessment,
        summary
      }
    } catch (error) {
      console.error('Semantic diff analysis error:', error)
      throw new Error(`Failed to analyze diff: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Compute text-level changes with section awareness
   */
  private computeTextChanges(
    oldContent: string,
    newContent: string,
    oldSections: Array<{ title: string; content: string }>,
    newSections: Array<{ title: string; content: string }>
  ): TextChange[] {
    const changes: TextChange[] = []
    
    // Create section maps
    const oldSectionMap = new Map(oldSections.map(s => [s.title, s.content]))
    const newSectionMap = new Map(newSections.map(s => [s.title, s.content]))
    
    // Find section-level changes
    const allSections = new Set([...oldSectionMap.keys(), ...newSectionMap.keys()])
    
    for (const section of allSections) {
      const oldSection = oldSectionMap.get(section) || ''
      const newSection = newSectionMap.get(section) || ''
      
      if (!oldSection && newSection) {
        // Section added
        changes.push({
          type: 'added',
          text: newSection,
          position: newContent.indexOf(newSection),
          length: newSection.length,
          section
        })
      } else if (oldSection && !newSection) {
        // Section removed
        changes.push({
          type: 'removed',
          text: oldSection,
          position: oldContent.indexOf(oldSection),
          length: oldSection.length,
          section
        })
      } else if (oldSection !== newSection) {
        // Section modified - use character-level diff
        const diffs = this.dmp.diff_main(oldSection, newSection)
        this.dmp.diff_cleanupSemantic(diffs)
        
        let position = newContent.indexOf(newSection)
        for (const [op, text] of diffs) {
          if (op === -1) {
            changes.push({
              type: 'removed',
              text,
              position,
              length: text.length,
              section
            })
          } else if (op === 1) {
            changes.push({
              type: 'added',
              text,
              position,
              length: text.length,
              section
            })
            position += text.length
          } else {
            position += text.length
          }
        }
      }
    }
    
    return changes
  }

  /**
   * Extract semantic changes using AI analysis
   */
  private async extractSemanticChanges(
    oldContent: string,
    newContent: string,
    textChanges: TextChange[]
  ): Promise<SemanticChange[]> {
    try {
      // Initialize AI service if needed
      if (!this.aiService) {
        const apiKey = process.env.OPENROUTER_API_KEY
        if (apiKey) {
          this.aiService = UnifiedAIService.getInstance(apiKey)
        } else {
          // Fallback to rule-based detection if no API key
          return this.detectSemanticChangesRuleBased(textChanges, oldContent, newContent)
        }
      }
      
      // Use AI to identify semantic changes
      const result = await this.aiService.analyze(
        `Old Policy:\n${oldContent}\n\nNew Policy:\n${newContent}`,
        {
          task: 'differential' as const,
          useTools: true,
          model: 'claude-3-opus-20240229' // Use best model for accuracy
        }
      )
      
      if (!result || typeof result !== 'object' || !('content' in result)) {
        // Fallback to rule-based detection
        return this.detectSemanticChangesRuleBased(textChanges, oldContent, newContent)
      }
      
      // Parse AI response
      const analysis = result.content
      const semanticChanges: SemanticChange[] = []
      
      // Simple parsing - in reality, you'd parse the AI response more carefully
      // For now, fallback to rule-based detection
      return this.detectSemanticChangesRuleBased(textChanges, oldContent, newContent)
    } catch (error) {
      console.error('AI semantic analysis failed:', error)
      // Fallback to rule-based detection
      return this.detectSemanticChangesRuleBased(textChanges, oldContent, newContent)
    }
  }

  /**
   * Rule-based semantic change detection (fallback)
   */
  private detectSemanticChangesRuleBased(
    textChanges: TextChange[],
    oldContent: string,
    newContent: string
  ): SemanticChange[] {
    const semanticChanges: SemanticChange[] = []
    
    // Define patterns for different types of changes
    const patterns = {
      permission: /\b(permission|consent|authorize|allow|grant)\b/i,
      data_usage: /\b(use|process|analyze|share|sell|transfer)\s+(your|personal|user)?\s*(data|information)\b/i,
      retention: /\b(retain|keep|store|delete|remove)\s+(for|data|information)\b/i,
      sharing: /\b(share|disclose|provide|third.party|partner|affiliate)\b/i,
      rights: /\b(right|opt.out|access|correct|delete|portability)\b/i,
      security: /\b(encrypt|secure|protect|breach|incident|vulnerability)\b/i
    }
    
    // Analyze each text change
    for (const change of textChanges) {
      if (change.type === 'removed' || change.type === 'added') {
        const text = change.text.toLowerCase()
        
        for (const [type, pattern] of Object.entries(patterns)) {
          if (pattern.test(text)) {
            // Extract context
            const context = this.extractContext(
              change.type === 'removed' ? oldContent : newContent,
              change.position,
              100
            )
            
            semanticChanges.push({
              type: type as SemanticChange['type'],
              severity: this.assessTextSeverity(text, type),
              description: `${change.type === 'removed' ? 'Removed' : 'Added'} ${type.replace('_', ' ')} clause`,
              oldPolicy: change.type === 'removed' ? context : undefined,
              newPolicy: change.type === 'added' ? context : undefined,
              impact: this.assessTextImpact(text, type),
              recommendation: this.generateTextRecommendation(change.type, type)
            })
          }
        }
      }
    }
    
    return semanticChanges
  }

  /**
   * Assess overall risk from changes
   */
  private assessRisk(
    semanticChanges: SemanticChange[],
    textChanges: TextChange[]
  ): RiskAssessment {
    const factors: RiskFactor[] = []
    let totalScore = 0
    
    // Factor 1: Number of high-severity changes
    const highSeverityCount = semanticChanges.filter(c => 
      c.severity === 'high' || c.severity === 'critical'
    ).length
    
    if (highSeverityCount > 0) {
      const factor = {
        factor: 'High severity changes',
        weight: 0.3,
        contribution: Math.min(highSeverityCount * 20, 100),
        details: `${highSeverityCount} high/critical severity changes detected`
      }
      factors.push(factor)
      totalScore += factor.weight * factor.contribution
    }
    
    // Factor 2: Data usage changes
    const dataUsageChanges = semanticChanges.filter(c => 
      c.type === 'data_usage' || c.type === 'sharing'
    ).length
    
    if (dataUsageChanges > 0) {
      const factor = {
        factor: 'Data usage modifications',
        weight: 0.25,
        contribution: Math.min(dataUsageChanges * 25, 100),
        details: `${dataUsageChanges} changes to data usage or sharing policies`
      }
      factors.push(factor)
      totalScore += factor.weight * factor.contribution
    }
    
    // Factor 3: User rights changes
    const rightsChanges = semanticChanges.filter(c => c.type === 'rights').length
    
    if (rightsChanges > 0) {
      const factor = {
        factor: 'User rights modifications',
        weight: 0.25,
        contribution: Math.min(rightsChanges * 30, 100),
        details: `${rightsChanges} changes to user rights or opt-out options`
      }
      factors.push(factor)
      totalScore += factor.weight * factor.contribution
    }
    
    // Factor 4: Overall change volume
    const changeRatio = textChanges.length / Math.max(semanticChanges.length, 1)
    const volumeFactor = {
      factor: 'Change volume',
      weight: 0.2,
      contribution: Math.min(changeRatio * 10, 100),
      details: `${textChanges.length} text changes across ${semanticChanges.length} semantic changes`
    }
    factors.push(volumeFactor)
    totalScore += volumeFactor.weight * volumeFactor.contribution
    
    // Determine overall risk level
    let overallRisk: RiskAssessment['overallRisk']
    if (totalScore >= 75) {
      overallRisk = 'critical'
    } else if (totalScore >= 50) {
      overallRisk = 'high'
    } else if (totalScore >= 25) {
      overallRisk = 'medium'
    } else {
      overallRisk = 'low'
    }
    
    // Generate user impact and legal implications
    const userImpact = this.generateUserImpact(semanticChanges)
    const legalImplications = this.generateLegalImplications(semanticChanges)
    
    return {
      overallRisk,
      score: Math.round(totalScore),
      factors,
      userImpact,
      legalImplications
    }
  }

  /**
   * Generate comprehensive diff summary
   */
  private generateSummary(
    textChanges: TextChange[],
    semanticChanges: SemanticChange[],
    oldContent: string,
    newContent: string
  ): DiffSummary {
    // Calculate word counts
    const oldWords = this.tokenizer.tokenize(oldContent).length
    const newWords = this.tokenizer.tokenize(newContent).length
    
    const addedWords = textChanges
      .filter(c => c.type === 'added')
      .reduce((sum, c) => sum + this.tokenizer.tokenize(c.text).length, 0)
    
    const removedWords = textChanges
      .filter(c => c.type === 'removed')
      .reduce((sum, c) => sum + this.tokenizer.tokenize(c.text).length, 0)
    
    // Identify modified sections
    const modifiedSections = [...new Set(
      textChanges
        .filter(c => c.section)
        .map(c => c.section!)
    )]
    
    // Generate key highlights
    const keyHighlights = this.generateKeyHighlights(semanticChanges)
    
    // Calculate reading time (200 words per minute)
    const oldReadingTime = Math.ceil(oldWords / 200)
    const newReadingTime = Math.ceil(newWords / 200)
    
    return {
      totalChanges: textChanges.length,
      addedWords,
      removedWords,
      modifiedSections,
      keyHighlights,
      readingTime: {
        old: oldReadingTime,
        new: newReadingTime,
        difference: newReadingTime - oldReadingTime
      }
    }
  }

  /**
   * Helper methods
   */
  
  private categorizeChange(category: string): SemanticChange['type'] {
    const categoryMap: Record<string, SemanticChange['type']> = {
      'Data Collection': 'data_usage',
      'Data Sharing': 'sharing',
      'Data Retention': 'retention',
      'User Rights': 'rights',
      'Security': 'security',
      'Consent': 'permission'
    }
    
    return categoryMap[category] || 'data_usage'
  }
  
  private assessSeverity(
    sentiment: string,
    category: string
  ): SemanticChange['severity'] {
    if (sentiment === 'negative' && ['Data Sharing', 'User Rights'].includes(category)) {
      return 'high'
    }
    if (sentiment === 'negative') {
      return 'medium'
    }
    if (sentiment === 'positive' && category === 'User Rights') {
      return 'low'
    }
    return 'medium'
  }
  
  private assessTextSeverity(text: string, type: string): SemanticChange['severity'] {
    // Simple heuristic based on keywords
    const criticalKeywords = /\b(sell|unlimited|indefinite|waive|irrevocable)\b/i
    const highKeywords = /\b(share|transfer|disclose|third.party|marketing)\b/i
    
    if (criticalKeywords.test(text)) return 'critical'
    if (highKeywords.test(text)) return 'high'
    if (type === 'rights' || type === 'security') return 'medium'
    return 'low'
  }
  
  private extractImpact(change: any): string[] {
    const impacts: string[] = []
    
    if (change.category === 'Data Sharing' && change.sentiment === 'negative') {
      impacts.push('Your data may be shared with more third parties')
    }
    if (change.category === 'User Rights' && change.sentiment === 'negative') {
      impacts.push('Reduced control over your personal data')
    }
    if (change.category === 'Data Retention') {
      impacts.push('Changes to how long your data is stored')
    }
    if (change.category === 'Security') {
      impacts.push('Updates to data protection measures')
    }
    
    return impacts
  }
  
  private assessTextImpact(text: string, type: string): string[] {
    const impacts: string[] = []
    
    if (type === 'data_usage' || type === 'sharing') {
      impacts.push('Changes to how your data is used or shared')
    }
    if (type === 'rights') {
      impacts.push('Modifications to your privacy rights')
    }
    if (type === 'retention') {
      impacts.push('Updates to data retention policies')
    }
    
    return impacts
  }
  
  private generateRecommendation(change: any): string {
    if (change.sentiment === 'negative' && change.category === 'User Rights') {
      return 'Review the new terms carefully and consider opting out if available'
    }
    if (change.category === 'Data Sharing' && change.sentiment === 'negative') {
      return 'Check privacy settings and limit data sharing where possible'
    }
    return 'Review the changes and update your privacy preferences accordingly'
  }
  
  private generateTextRecommendation(
    changeType: string,
    semanticType: string
  ): string {
    if (changeType === 'removed' && semanticType === 'rights') {
      return 'Important rights may have been removed - review carefully'
    }
    if (changeType === 'added' && semanticType === 'sharing') {
      return 'New data sharing practices added - review and adjust settings'
    }
    return 'Review the changes carefully'
  }
  
  private extractContext(content: string, position: number, length: number): string {
    const start = Math.max(0, position - length)
    const end = Math.min(content.length, position + length)
    return content.substring(start, end).trim()
  }
  
  private generateUserImpact(changes: SemanticChange[]): string[] {
    const impacts = new Set<string>()
    
    for (const change of changes) {
      change.impact.forEach(i => impacts.add(i))
      
      // Add specific impacts based on change type
      if (change.type === 'data_usage' && change.severity !== 'low') {
        impacts.add('Your personal data may be used in new ways')
      }
      if (change.type === 'sharing' && change.severity === 'high') {
        impacts.add('Increased sharing of your data with third parties')
      }
      if (change.type === 'rights' && change.oldPolicy && !change.newPolicy) {
        impacts.add('Some privacy rights have been removed or limited')
      }
    }
    
    return Array.from(impacts)
  }
  
  private generateLegalImplications(changes: SemanticChange[]): string[] {
    const implications = new Set<string>()
    
    for (const change of changes) {
      if (change.type === 'rights') {
        implications.add('Changes may affect your legal rights under privacy laws')
      }
      if (change.type === 'sharing' && change.severity === 'high') {
        implications.add('New data sharing practices may require additional consent under GDPR/CCPA')
      }
      if (change.type === 'retention') {
        implications.add('Data retention changes may impact your right to deletion')
      }
    }
    
    return Array.from(implications)
  }
  
  private generateKeyHighlights(changes: SemanticChange[]): string[] {
    const highlights: string[] = []
    
    // Sort by severity and take top 5
    const topChanges = changes
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        return severityOrder[b.severity] - severityOrder[a.severity]
      })
      .slice(0, 5)
    
    for (const change of topChanges) {
      highlights.push(change.description)
    }
    
    return highlights
  }

  /**
   * Generate visual diff representation
   */
  generateVisualDiff(
    oldContent: string,
    newContent: string
  ): Array<{ type: 'equal' | 'insert' | 'delete'; text: string }> {
    const diffs = this.dmp.diff_main(oldContent, newContent)
    this.dmp.diff_cleanupSemantic(diffs)
    
    return diffs.map(([op, text]: [number, string]) => ({
      type: op === 0 ? 'equal' : op === 1 ? 'insert' : 'delete',
      text
    }))
  }

  /**
   * Generate diff statistics
   */
  getStatistics(diff: SemanticDiff): {
    changePercentage: number
    severityDistribution: Record<string, number>
    typeDistribution: Record<string, number>
    estimatedImpact: 'minimal' | 'moderate' | 'significant' | 'major'
  } {
    const total = diff.semanticChanges.length
    
    // Calculate severity distribution
    const severityDistribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }
    
    // Calculate type distribution
    const typeDistribution: Record<string, number> = {
      permission: 0,
      data_usage: 0,
      retention: 0,
      sharing: 0,
      rights: 0,
      security: 0
    }
    
    for (const change of diff.semanticChanges) {
      const severity = change.severity as keyof typeof severityDistribution
      const type = change.type as keyof typeof typeDistribution
      
      if (severity in severityDistribution) {
        severityDistribution[severity] = (severityDistribution[severity] || 0) + 1
      }
      if (type in typeDistribution) {
        typeDistribution[type] = (typeDistribution[type] || 0) + 1
      }
    }
    
    // Calculate change percentage
    const changePercentage = (diff.summary.addedWords + diff.summary.removedWords) / 
      (diff.summary.totalChanges * 10) * 100
    
    // Estimate impact
    let estimatedImpact: 'minimal' | 'moderate' | 'significant' | 'major'
    const criticalCount = severityDistribution.critical || 0
    const highCount = severityDistribution.high || 0
    
    if (diff.riskAssessment.overallRisk === 'critical' || criticalCount > 2) {
      estimatedImpact = 'major'
    } else if (diff.riskAssessment.overallRisk === 'high' || highCount > 3) {
      estimatedImpact = 'significant'
    } else if (diff.riskAssessment.overallRisk === 'medium' || total > 5) {
      estimatedImpact = 'moderate'
    } else {
      estimatedImpact = 'minimal'
    }
    
    return {
      changePercentage: Math.round(changePercentage),
      severityDistribution,
      typeDistribution,
      estimatedImpact
    }
  }
}

// Export singleton instance
export const semanticDiffEngine = SemanticDiffEngine.getInstance()