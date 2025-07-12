/**
 * Production-Ready Privacy Risk Assessment Engine
 * 
 * Evaluates privacy policies for specific risks and provides
 * actionable risk scores with mitigation strategies.
 */

import { z } from 'zod'
import { logger } from '@/lib/logger'
import { PolicyAnalysis } from './production-grading-engine'

/**
 * Risk categories with severity weights
 */
export const RISK_CATEGORIES = {
  DATA_BREACH: {
    name: 'Data Breach Risk',
    weight: 0.25,
    description: 'Risk of personal data being exposed in a breach',
    factors: [
      { id: 'weak_security', weight: 0.4, threshold: 50 },
      { id: 'excessive_retention', weight: 0.3, threshold: 60 },
      { id: 'third_party_sharing', weight: 0.3, threshold: 70 }
    ]
  },
  IDENTITY_THEFT: {
    name: 'Identity Theft Risk',
    weight: 0.20,
    description: 'Risk of personal information being used for identity theft',
    factors: [
      { id: 'sensitive_data_collection', weight: 0.5, threshold: 40 },
      { id: 'weak_access_controls', weight: 0.3, threshold: 50 },
      { id: 'data_broker_sharing', weight: 0.2, threshold: 30 }
    ]
  },
  SURVEILLANCE: {
    name: 'Surveillance Risk',
    weight: 0.15,
    description: 'Risk of excessive tracking and monitoring',
    factors: [
      { id: 'behavioral_tracking', weight: 0.4, threshold: 60 },
      { id: 'location_tracking', weight: 0.3, threshold: 50 },
      { id: 'cross_site_tracking', weight: 0.3, threshold: 70 }
    ]
  },
  FINANCIAL: {
    name: 'Financial Risk',
    weight: 0.15,
    description: 'Risk of financial loss or fraud',
    factors: [
      { id: 'payment_data_handling', weight: 0.5, threshold: 40 },
      { id: 'transaction_sharing', weight: 0.3, threshold: 50 },
      { id: 'unclear_billing', weight: 0.2, threshold: 60 }
    ]
  },
  REPUTATIONAL: {
    name: 'Reputational Risk',
    weight: 0.10,
    description: 'Risk to personal or professional reputation',
    factors: [
      { id: 'social_media_integration', weight: 0.4, threshold: 70 },
      { id: 'public_profiles', weight: 0.3, threshold: 60 },
      { id: 'data_persistence', weight: 0.3, threshold: 50 }
    ]
  },
  DISCRIMINATION: {
    name: 'Discrimination Risk',
    weight: 0.10,
    description: 'Risk of discriminatory treatment based on data',
    factors: [
      { id: 'demographic_profiling', weight: 0.5, threshold: 40 },
      { id: 'algorithmic_decisions', weight: 0.3, threshold: 50 },
      { id: 'sensitive_inferences', weight: 0.2, threshold: 60 }
    ]
  },
  CHILDREN: {
    name: 'Children\'s Privacy Risk',
    weight: 0.05,
    description: 'Specific risks for minors',
    factors: [
      { id: 'no_age_verification', weight: 0.4, threshold: 30 },
      { id: 'targets_children', weight: 0.4, threshold: 20 },
      { id: 'parental_controls', weight: 0.2, threshold: 50 }
    ]
  }
} as const

/**
 * Risk indicators to detect in policies
 */
export const RISK_INDICATORS = {
  high_risk: {
    data_brokers: /data broker|information broker|third.party.aggregator/i,
    sells_data: /sell.*(?:personal|user).(?:data|information)/i,
    no_encryption: /not encrypted|unencrypted|plain.?text/i,
    indefinite_retention: /indefinitely|forever|permanent/i,
    broad_sharing: /share.*with.*(?:anyone|everyone|all)/i,
    behavioral_ads: /behavioral advertising|targeted ads|interest.based/i,
    device_fingerprint: /device fingerprint|browser fingerprint/i,
    biometric_data: /biometric|facial recognition|fingerprint/i,
    genetic_data: /genetic|dna|genomic/i,
    precise_location: /precise location|real.time location|gps/i
  },
  medium_risk: {
    analytics: /google analytics|facebook pixel|tracking pixel/i,
    cookies: /third.party cookies|tracking cookies|persistent cookies/i,
    marketing: /marketing partners|advertising partners/i,
    automated_decisions: /automated decision|algorithmic/i,
    international_transfer: /transfer.*(?:abroad|international|overseas)/i,
    social_login: /facebook login|google sign.in|social media/i,
    public_profile: /public profile|publicly available/i,
    ip_logging: /ip address|internet protocol/i
  },
  low_risk: {
    first_party_only: /first.party only|we do not share/i,
    session_only: /session cookies|temporary/i,
    anonymous_analytics: /anonymous analytics|aggregated data/i,
    opt_in_required: /opt.in|explicit consent|affirmative consent/i,
    local_storage: /local storage only|device only/i
  }
}

/**
 * Risk scoring thresholds
 */
export const RISK_LEVELS = {
  CRITICAL: { min: 80, color: '#DC2626', label: 'Critical Risk' },
  HIGH: { min: 60, color: '#EF4444', label: 'High Risk' },
  MEDIUM: { min: 40, color: '#F59E0B', label: 'Medium Risk' },
  LOW: { min: 20, color: '#10B981', label: 'Low Risk' },
  MINIMAL: { min: 0, color: '#059669', label: 'Minimal Risk' }
} as const

/**
 * Risk assessment result schema
 */
export const RiskAssessmentSchema = z.object({
  overall_risk_score: z.number().min(0).max(100),
  risk_level: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'MINIMAL']),
  category_risks: z.record(z.object({
    score: z.number().min(0).max(100),
    level: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'MINIMAL']),
    factors: z.array(z.object({
      id: z.string(),
      detected: z.boolean(),
      severity: z.number().min(0).max(100),
      evidence: z.string().optional()
    })),
    mitigation: z.array(z.string())
  })),
  top_risks: z.array(z.object({
    category: z.string(),
    risk: z.string(),
    severity: z.number(),
    description: z.string()
  })),
  mitigation_plan: z.array(z.object({
    priority: z.enum(['immediate', 'high', 'medium', 'low']),
    action: z.string(),
    risk_reduction: z.number(),
    effort: z.enum(['low', 'medium', 'high'])
  })),
  risk_timeline: z.object({
    immediate: z.array(z.string()),
    short_term: z.array(z.string()),
    long_term: z.array(z.string())
  }),
  comparisons: z.object({
    industry_average: z.number(),
    percentile: z.number(),
    trend: z.enum(['improving', 'stable', 'worsening'])
  }).optional()
})

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>

/**
 * Risk assessment engine
 */
export class RiskAssessmentEngine {
  private static instance: RiskAssessmentEngine
  
  private constructor() {}
  
  static getInstance(): RiskAssessmentEngine {
    if (!this.instance) {
      this.instance = new RiskAssessmentEngine()
    }
    return this.instance
  }
  
  /**
   * Perform comprehensive risk assessment
   */
  async assessRisks(
    policyContent: string,
    policyAnalysis?: PolicyAnalysis,
    options: {
      industry?: string
      companySize?: 'small' | 'medium' | 'large' | 'enterprise'
      region?: string
      previousAssessment?: RiskAssessment
    } = {}
  ): Promise<RiskAssessment> {
    logger.info('Performing risk assessment', { 
      contentLength: policyContent.length,
      hasAnalysis: !!policyAnalysis 
    })
    
    // Assess each risk category
    const categoryRisks: Record<string, any> = {}
    
    for (const [categoryKey, category] of Object.entries(RISK_CATEGORIES)) {
      categoryRisks[categoryKey] = await this.assessCategoryRisk(
        policyContent,
        categoryKey,
        category,
        policyAnalysis
      )
    }
    
    // Calculate overall risk score
    const overallRiskScore = this.calculateOverallRisk(categoryRisks)
    
    // Determine risk level
    const riskLevel = this.getRiskLevel(overallRiskScore)
    
    // Identify top risks
    const topRisks = this.identifyTopRisks(categoryRisks)
    
    // Generate mitigation plan
    const mitigationPlan = this.generateMitigationPlan(
      categoryRisks,
      topRisks,
      policyAnalysis
    )
    
    // Create risk timeline
    const riskTimeline = this.createRiskTimeline(topRisks, mitigationPlan)
    
    // Add comparisons if available
    const comparisons = options.industry ? 
      this.generateComparisons(overallRiskScore, options) : 
      undefined
    
    return RiskAssessmentSchema.parse({
      overall_risk_score: Math.round(overallRiskScore),
      risk_level: riskLevel,
      category_risks: categoryRisks,
      top_risks: topRisks,
      mitigation_plan: mitigationPlan,
      risk_timeline: riskTimeline,
      comparisons
    })
  }
  
  /**
   * Assess risk for a specific category
   */
  private async assessCategoryRisk(
    content: string,
    categoryKey: string,
    category: typeof RISK_CATEGORIES[keyof typeof RISK_CATEGORIES],
    analysis?: PolicyAnalysis
  ): Promise<any> {
    const factors: Array<{
      id: string
      detected: boolean
      severity: number
      evidence?: string
    }> = []
    
    let categoryScore = 0
    
    // Assess each risk factor
    for (const factor of category.factors) {
      const assessment = this.assessRiskFactor(
        content,
        categoryKey,
        factor,
        analysis
      )
      
      factors.push(assessment)
      
      if (assessment.detected) {
        categoryScore += assessment.severity * factor.weight
      }
    }
    
    // Apply category-specific adjustments
    categoryScore = this.applyCategoryAdjustments(
      categoryScore,
      categoryKey,
      content,
      analysis
    )
    
    // Generate mitigation strategies
    const mitigation = this.generateCategoryMitigation(
      categoryKey,
      factors,
      categoryScore
    )
    
    const level = this.getRiskLevel(categoryScore)
    
    return {
      score: Math.round(categoryScore),
      level,
      factors,
      mitigation
    }
  }
  
  /**
   * Assess individual risk factor
   */
  private assessRiskFactor(
    content: string,
    categoryKey: string,
    factor: { id: string; weight: number; threshold: number },
    analysis?: PolicyAnalysis
  ): {
    id: string
    detected: boolean
    severity: number
    evidence?: string
  } {
    let detected = false
    let severity = 0
    let evidence: string | undefined
    
    // Factor-specific detection logic
    switch (`${categoryKey}_${factor.id}`) {
      case 'DATA_BREACH_weak_security':
        const securityScore = analysis?.dimension_scores?.SECURITY?.score || 50
        detected = securityScore < factor.threshold
        severity = detected ? (factor.threshold - securityScore) * 2 : 0
        evidence = detected ? 'Weak security measures detected' : undefined
        break
        
      case 'DATA_BREACH_excessive_retention':
        for (const pattern of Object.values(RISK_INDICATORS.high_risk)) {
          const match = content.match(pattern)
          if (match && pattern.source.includes('indefinite')) {
            detected = true
            severity = 80
            evidence = match[0]
            break
          }
        }
        break
        
      case 'IDENTITY_THEFT_sensitive_data_collection':
        const sensitivePatterns = [
          /social security/i,
          /ssn/i,
          /driver'?s license/i,
          /passport/i,
          /bank account/i,
          /credit card/i
        ]
        
        for (const pattern of sensitivePatterns) {
          const match = content.match(pattern)
          if (match) {
            detected = true
            severity = Math.max(severity, 70)
            evidence = match[0]
          }
        }
        break
        
      case 'SURVEILLANCE_behavioral_tracking':
        for (const [key, pattern] of Object.entries(RISK_INDICATORS.high_risk)) {
          if (key.includes('behavioral') || key.includes('fingerprint')) {
            const match = content.match(pattern)
            if (match) {
              detected = true
              severity = 75
              evidence = match[0]
              break
            }
          }
        }
        break
        
      case 'FINANCIAL_payment_data_handling':
        const paymentPatterns = [
          /payment (?:card|information|details)/i,
          /credit card/i,
          /billing information/i,
          /financial (?:information|data)/i
        ]
        
        for (const pattern of paymentPatterns) {
          if (pattern.test(content)) {
            detected = true
            // Check if encryption is mentioned nearby
            const encrypted = /encrypt/i.test(content)
            severity = encrypted ? 40 : 80
            evidence = `Payment data collection ${encrypted ? 'with' : 'without'} encryption`
            break
          }
        }
        break
        
      case 'CHILDREN_no_age_verification':
        detected = !/age verification|verify.*age|13 years|coppa/i.test(content)
        if (detected) {
          severity = 60
          evidence = 'No age verification mentioned'
        }
        break
        
      default:
        // Generic pattern-based detection
        ({ detected, severity, evidence } = this.genericRiskDetection(
          content,
          factor.id
        ))
    }
    
    return {
      id: factor.id,
      detected,
      severity: Math.min(100, severity),
      evidence
    }
  }
  
  /**
   * Generic risk detection based on patterns
   */
  private genericRiskDetection(
    content: string,
    factorId: string
  ): {
    detected: boolean
    severity: number
    evidence?: string
  } {
    let maxSeverity = 0
    let detectedEvidence: string | undefined
    
    // Check high risk indicators
    for (const [key, pattern] of Object.entries(RISK_INDICATORS.high_risk)) {
      if (factorId.toLowerCase().includes(key.toLowerCase())) {
        const match = content.match(pattern)
        if (match) {
          maxSeverity = Math.max(maxSeverity, 80)
          detectedEvidence = match[0]
        }
      }
    }
    
    // Check medium risk indicators
    for (const [key, pattern] of Object.entries(RISK_INDICATORS.medium_risk)) {
      if (factorId.toLowerCase().includes(key.toLowerCase())) {
        const match = content.match(pattern)
        if (match) {
          maxSeverity = Math.max(maxSeverity, 50)
          if (!detectedEvidence) detectedEvidence = match[0]
        }
      }
    }
    
    return {
      detected: maxSeverity > 0,
      severity: maxSeverity,
      evidence: detectedEvidence
    }
  }
  
  /**
   * Apply category-specific risk adjustments
   */
  private applyCategoryAdjustments(
    score: number,
    categoryKey: string,
    content: string,
    analysis?: PolicyAnalysis
  ): number {
    let adjustedScore = score
    
    switch (categoryKey) {
      case 'DATA_BREACH':
        // Increase risk if no breach notification mentioned
        if (!/breach notification|notify.*breach/i.test(content)) {
          adjustedScore *= 1.2
        }
        break
        
      case 'IDENTITY_THEFT':
        // Decrease risk if strong authentication mentioned
        if (/two.factor|multi.factor|2fa|mfa/i.test(content)) {
          adjustedScore *= 0.8
        }
        break
        
      case 'SURVEILLANCE':
        // Increase risk for social media companies
        if (/social.*media|social.*network/i.test(content)) {
          adjustedScore *= 1.3
        }
        break
        
      case 'FINANCIAL':
        // Decrease risk if PCI compliance mentioned
        if (/pci.dss|pci complian/i.test(content)) {
          adjustedScore *= 0.7
        }
        break
        
      case 'CHILDREN':
        // Increase risk if targets children
        if (/children|kids|minors|youth/i.test(content)) {
          adjustedScore *= 1.5
        }
        break
    }
    
    return Math.min(100, adjustedScore)
  }
  
  /**
   * Generate mitigation strategies for a risk category
   */
  private generateCategoryMitigation(
    categoryKey: string,
    factors: Array<{ id: string; detected: boolean; severity: number }>,
    score: number
  ): string[] {
    const mitigation: string[] = []
    
    if (score < 30) return ['Continue monitoring for changes']
    
    // Category-specific mitigation
    switch (categoryKey) {
      case 'DATA_BREACH':
        if (score > 60) {
          mitigation.push('Enable two-factor authentication immediately')
          mitigation.push('Review and limit data sharing permissions')
          mitigation.push('Request data deletion for unused services')
        }
        break
        
      case 'IDENTITY_THEFT':
        if (score > 50) {
          mitigation.push('Use unique passwords for this service')
          mitigation.push('Monitor credit reports regularly')
          mitigation.push('Limit personal information shared')
        }
        break
        
      case 'SURVEILLANCE':
        mitigation.push('Adjust privacy settings to maximum')
        mitigation.push('Use privacy-focused browser extensions')
        mitigation.push('Regularly clear cookies and tracking data')
        break
        
      case 'FINANCIAL':
        mitigation.push('Use virtual credit cards if possible')
        mitigation.push('Enable transaction notifications')
        mitigation.push('Review billing statements regularly')
        break
        
      case 'CHILDREN':
        mitigation.push('Enable parental controls')
        mitigation.push('Review content filtering settings')
        mitigation.push('Monitor child\'s activity regularly')
        break
    }
    
    // Factor-specific mitigation
    for (const factor of factors) {
      if (factor.detected && factor.severity > 60) {
        mitigation.push(this.getFactorMitigation(factor.id))
      }
    }
    
    return [...new Set(mitigation)].slice(0, 5) // Remove duplicates, limit to 5
  }
  
  /**
   * Get mitigation for specific risk factor
   */
  private getFactorMitigation(factorId: string): string {
    const mitigations: Record<string, string> = {
      weak_security: 'Enable all available security features',
      excessive_retention: 'Request periodic data deletion',
      third_party_sharing: 'Opt out of data sharing where possible',
      sensitive_data_collection: 'Provide minimum required information only',
      behavioral_tracking: 'Use tracking protection tools',
      location_tracking: 'Disable location services for this app',
      payment_data_handling: 'Use payment services like PayPal instead',
      no_age_verification: 'Supervise children\'s use of this service',
      data_broker_sharing: 'Submit opt-out requests to data brokers'
    }
    
    return mitigations[factorId] || 'Review and adjust privacy settings'
  }
  
  /**
   * Calculate overall risk score
   */
  private calculateOverallRisk(categoryRisks: Record<string, any>): number {
    let totalRisk = 0
    
    for (const [categoryKey, category] of Object.entries(RISK_CATEGORIES)) {
      const categoryRisk = categoryRisks[categoryKey]
      if (categoryRisk) {
        totalRisk += categoryRisk.score * category.weight
      }
    }
    
    return totalRisk
  }
  
  /**
   * Determine risk level from score
   */
  private getRiskLevel(score: number): keyof typeof RISK_LEVELS {
    for (const [level, config] of Object.entries(RISK_LEVELS)) {
      if (score >= config.min) {
        return level as keyof typeof RISK_LEVELS
      }
    }
    return 'MINIMAL'
  }
  
  /**
   * Identify top risks
   */
  private identifyTopRisks(
    categoryRisks: Record<string, any>
  ): Array<{
    category: string
    risk: string
    severity: number
    description: string
  }> {
    const risks: Array<{
      category: string
      risk: string
      severity: number
      description: string
    }> = []
    
    for (const [categoryKey, categoryData] of Object.entries(categoryRisks)) {
      if (categoryData.score > 40) {
        const category = RISK_CATEGORIES[categoryKey as keyof typeof RISK_CATEGORIES]
        
        // Add category-level risk
        risks.push({
          category: category.name,
          risk: `High ${category.name}`,
          severity: categoryData.score,
          description: category.description
        })
        
        // Add significant factor risks
        for (const factor of categoryData.factors) {
          if (factor.detected && factor.severity > 60) {
            risks.push({
              category: category.name,
              risk: this.formatFactorRisk(factor.id),
              severity: factor.severity,
              description: factor.evidence || 'Detected in privacy policy'
            })
          }
        }
      }
    }
    
    // Sort by severity and return top risks
    return risks
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 5)
  }
  
  /**
   * Format factor ID for display
   */
  private formatFactorRisk(factorId: string): string {
    return factorId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  
  /**
   * Generate comprehensive mitigation plan
   */
  private generateMitigationPlan(
    categoryRisks: Record<string, any>,
    topRisks: Array<any>,
    analysis?: PolicyAnalysis
  ): Array<{
    priority: 'immediate' | 'high' | 'medium' | 'low'
    action: string
    risk_reduction: number
    effort: 'low' | 'medium' | 'high'
  }> {
    const plan: Array<{
      priority: 'immediate' | 'high' | 'medium' | 'low'
      action: string
      risk_reduction: number
      effort: 'low' | 'medium' | 'high'
    }> = []
    
    // Immediate actions for critical risks
    for (const risk of topRisks) {
      if (risk.severity > 80) {
        plan.push({
          priority: 'immediate',
          action: `Address ${risk.risk}`,
          risk_reduction: Math.round(risk.severity * 0.3),
          effort: 'low'
        })
      }
    }
    
    // High priority actions
    for (const [categoryKey, categoryData] of Object.entries(categoryRisks)) {
      if (categoryData.score > 60 && categoryData.score <= 80) {
        const topMitigation = categoryData.mitigation[0]
        if (topMitigation) {
          plan.push({
            priority: 'high',
            action: topMitigation,
            risk_reduction: Math.round(categoryData.score * 0.2),
            effort: 'medium'
          })
        }
      }
    }
    
    // Medium priority improvements
    if (analysis && analysis.recommendations) {
      for (const rec of analysis.recommendations) {
        if (rec.priority === 'medium') {
          plan.push({
            priority: 'medium',
            action: rec.action,
            risk_reduction: 10,
            effort: 'medium'
          })
        }
      }
    }
    
    // Low priority maintenance
    plan.push({
      priority: 'low',
      action: 'Regular privacy checkups every 3 months',
      risk_reduction: 5,
      effort: 'low'
    })
    
    return plan.slice(0, 8) // Limit to 8 actions
  }
  
  /**
   * Create risk timeline
   */
  private createRiskTimeline(
    topRisks: Array<any>,
    mitigationPlan: Array<any>
  ): {
    immediate: string[]
    short_term: string[]
    long_term: string[]
  } {
    const timeline = {
      immediate: [] as string[],
      short_term: [] as string[],
      long_term: [] as string[]
    }
    
    // Immediate (within 24 hours)
    timeline.immediate = mitigationPlan
      .filter(m => m.priority === 'immediate')
      .map(m => m.action)
      .slice(0, 3)
    
    // Short term (within 1 week)
    timeline.short_term = mitigationPlan
      .filter(m => m.priority === 'high')
      .map(m => m.action)
      .slice(0, 3)
    
    // Long term (ongoing)
    timeline.long_term = [
      'Monitor for privacy policy changes',
      'Review and update privacy settings quarterly',
      'Stay informed about new privacy features'
    ]
    
    return timeline
  }
  
  /**
   * Generate industry comparisons
   */
  private generateComparisons(
    score: number,
    options: { industry?: string }
  ): {
    industry_average: number
    percentile: number
    trend: 'improving' | 'stable' | 'worsening'
  } {
    // Industry averages (mock data - in production, this would come from aggregated data)
    const industryAverages: Record<string, number> = {
      social_media: 65,
      finance: 45,
      healthcare: 40,
      ecommerce: 50,
      technology: 55,
      education: 35,
      default: 50
    }
    
    const average = industryAverages[options.industry || 'default'] || 50
    
    // Calculate percentile
    const percentile = Math.round(
      100 - (score / 100) * 100
    ) // Inverted because lower risk is better
    
    // Determine trend (in production, compare with historical data)
    const trend = 'stable' // Would compare with previous assessments
    
    return {
      industry_average: average,
      percentile: Math.max(1, Math.min(99, percentile)),
      trend
    }
  }
}

// Export singleton instance
export const riskAssessmentEngine = RiskAssessmentEngine.getInstance()