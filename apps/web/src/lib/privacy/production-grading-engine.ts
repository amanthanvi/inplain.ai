/**
 * Production-Ready Privacy Policy Grading Engine
 * 
 * A comprehensive, weighted scoring system that analyzes privacy policies
 * across multiple dimensions to provide accurate, actionable grades.
 */

import { z } from 'zod'
import { logger } from '@/lib/logger'

/**
 * Privacy policy section weights and scoring criteria
 */
export const PRIVACY_DIMENSIONS = {
  DATA_COLLECTION: {
    weight: 0.20,
    name: 'Data Collection Practices',
    description: 'How much data is collected and for what purposes',
    criteria: {
      minimal_collection: { weight: 0.35, description: 'Collects only necessary data' },
      explicit_categories: { weight: 0.25, description: 'Clearly lists data categories' },
      sensitive_data: { weight: 0.25, description: 'Handles sensitive data appropriately' },
      automated_collection: { weight: 0.15, description: 'Transparent about cookies/tracking' }
    }
  },
  USER_CONTROL: {
    weight: 0.25,
    name: 'User Rights & Control',
    description: 'User control over their personal data',
    criteria: {
      access_rights: { weight: 0.20, description: 'Right to access personal data' },
      deletion_rights: { weight: 0.20, description: 'Right to delete personal data' },
      correction_rights: { weight: 0.15, description: 'Right to correct personal data' },
      portability_rights: { weight: 0.15, description: 'Right to data portability' },
      opt_out_ease: { weight: 0.30, description: 'Easy opt-out mechanisms' }
    }
  },
  DATA_SHARING: {
    weight: 0.20,
    name: 'Third-Party Data Sharing',
    description: 'How data is shared with third parties',
    criteria: {
      no_selling: { weight: 0.35, description: 'Does not sell personal data' },
      limited_sharing: { weight: 0.25, description: 'Limited third-party sharing' },
      user_consent: { weight: 0.25, description: 'Requires consent for sharing' },
      partner_vetting: { weight: 0.15, description: 'Vets third-party partners' }
    }
  },
  TRANSPARENCY: {
    weight: 0.15,
    name: 'Transparency & Clarity',
    description: 'How clear and understandable the policy is',
    criteria: {
      plain_language: { weight: 0.30, description: 'Uses plain, simple language' },
      comprehensive: { weight: 0.25, description: 'Comprehensive coverage' },
      examples_provided: { weight: 0.20, description: 'Provides clear examples' },
      contact_info: { weight: 0.25, description: 'Easy to contact for questions' }
    }
  },
  SECURITY: {
    weight: 0.10,
    name: 'Security Measures',
    description: 'Data protection and security practices',
    criteria: {
      encryption: { weight: 0.35, description: 'Uses encryption for data' },
      access_controls: { weight: 0.25, description: 'Strong access controls' },
      breach_notification: { weight: 0.25, description: 'Clear breach notification' },
      security_audits: { weight: 0.15, description: 'Regular security audits' }
    }
  },
  RETENTION: {
    weight: 0.10,
    name: 'Data Retention',
    description: 'How long data is kept',
    criteria: {
      limited_retention: { weight: 0.40, description: 'Limited retention periods' },
      clear_periods: { weight: 0.30, description: 'Clear retention timelines' },
      deletion_policy: { weight: 0.30, description: 'Automatic deletion policy' }
    }
  }
} as const

/**
 * Grade thresholds for converting numeric scores to letter grades
 */
export const GRADE_THRESHOLDS = {
  'A+': 95,
  'A': 90,
  'A-': 87,
  'B+': 83,
  'B': 80,
  'B-': 77,
  'C+': 73,
  'C': 70,
  'C-': 67,
  'D+': 63,
  'D': 60,
  'D-': 57,
  'F': 0
} as const

/**
 * Privacy indicators to look for in policies
 */
export const PRIVACY_INDICATORS = {
  // Positive indicators (good for privacy)
  positive: {
    data_minimization: [
      /only collect\s+(?:the\s+)?(?:necessary|essential|required)/i,
      /data minimization/i,
      /limited data collection/i,
      /we do not collect unnecessary/i
    ],
    user_rights: [
      /you (?:can|may|have the right to) (?:access|request|obtain)/i,
      /right to (?:erasure|deletion|be forgotten)/i,
      /data portability/i,
      /opt[- ]?out/i,
      /unsubscribe/i
    ],
    no_selling: [
      /(?:do not|don't|never|will not) sell (?:your )?(?:personal )?(?:data|information)/i,
      /we do not sell/i,
      /never sell your/i
    ],
    encryption: [
      /encrypt(?:ed|ion|s)?/i,
      /secure sockets layer/i,
      /transport layer security/i,
      /SSL\/TLS/i,
      /end-to-end encryption/i
    ],
    transparency: [
      /we are transparent/i,
      /clear(?:ly)? (?:explain|describe|state)/i,
      /you can contact us/i,
      /privacy (?:officer|team) (?:at|via)/i
    ],
    limited_retention: [
      /delete(?:d)? after/i,
      /retain(?:ed)? (?:for|only)/i,
      /automatic(?:ally)? delete/i,
      /retention period/i
    ]
  },
  // Negative indicators (bad for privacy)
  negative: {
    excessive_collection: [
      /collect all/i,
      /any and all information/i,
      /comprehensive data/i,
      /extensive information/i
    ],
    data_selling: [
      /may sell/i,
      /sell (?:your )?(?:personal )?(?:data|information) to/i,
      /monetize your data/i,
      /share with advertisers/i
    ],
    vague_purposes: [
      /various purposes/i,
      /other purposes/i,
      /any purpose/i,
      /as we see fit/i
    ],
    unlimited_retention: [
      /indefinitely/i,
      /no limit/i,
      /as long as (?:necessary|needed|we want)/i,
      /forever/i
    ],
    weak_security: [
      /cannot guarantee/i,
      /no method.*100%/i,
      /absolute security/i,
      /may be intercepted/i
    ],
    third_party_tracking: [
      /third[- ]?party (?:cookies|trackers|analytics)/i,
      /behavioral advertising/i,
      /cross[- ]?site tracking/i,
      /device fingerprinting/i
    ]
  },
  // Critical red flags
  red_flags: {
    no_opt_out: /no opt[- ]?out/i,
    sells_to_brokers: /data broker/i,
    changes_without_notice: /change.*without notice/i,
    no_deletion: /cannot delete/i,
    shares_with_government: /government request/i
  }
}

/**
 * Industry-specific scoring adjustments
 */
export const INDUSTRY_FACTORS = {
  healthcare: { multiplier: 1.2, reason: 'Handles sensitive health data' },
  finance: { multiplier: 1.15, reason: 'Handles financial data' },
  education: { multiplier: 1.1, reason: 'May handle minor data' },
  social_media: { multiplier: 1.1, reason: 'Extensive data collection' },
  ecommerce: { multiplier: 1.0, reason: 'Standard retail practices' },
  news_media: { multiplier: 0.95, reason: 'Limited data collection' },
  government: { multiplier: 1.0, reason: 'Subject to regulations' }
}

/**
 * Comprehensive privacy policy analysis result
 */
export const PolicyAnalysisSchema = z.object({
  overall_score: z.number().min(0).max(100),
  letter_grade: z.string(),
  dimension_scores: z.record(z.object({
    score: z.number().min(0).max(100),
    criteria_scores: z.record(z.number().min(0).max(100)),
    findings: z.array(z.string())
  })),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  red_flags: z.array(z.string()),
  recommendations: z.array(z.object({
    priority: z.enum(['high', 'medium', 'low']),
    action: z.string(),
    impact: z.string()
  })),
  compliance: z.object({
    gdpr: z.boolean(),
    ccpa: z.boolean(),
    coppa: z.boolean(),
    hipaa: z.boolean().optional()
  }),
  metadata: z.object({
    analysis_version: z.string(),
    analyzed_at: z.string(),
    word_count: z.number(),
    readability_score: z.number(),
    industry: z.string().optional()
  })
})

export type PolicyAnalysis = z.infer<typeof PolicyAnalysisSchema>

/**
 * Main privacy policy grading engine
 */
export class PrivacyGradingEngine {
  private static instance: PrivacyGradingEngine
  
  private constructor() {}
  
  static getInstance(): PrivacyGradingEngine {
    if (!this.instance) {
      this.instance = new PrivacyGradingEngine()
    }
    return this.instance
  }
  
  /**
   * Analyze a privacy policy and generate comprehensive scores
   */
  async analyzePolicy(
    content: string,
    options: {
      company?: string
      industry?: keyof typeof INDUSTRY_FACTORS | 'technology'
      url?: string
    } = {}
  ): Promise<PolicyAnalysis> {
    logger.info('Analyzing privacy policy', { 
      company: options.company,
      contentLength: content.length 
    })
    
    // Pre-process content
    const processedContent = this.preprocessContent(content)
    
    // Analyze each dimension
    const dimensionScores: Record<string, any> = {}
    
    for (const [key, dimension] of Object.entries(PRIVACY_DIMENSIONS)) {
      dimensionScores[key] = await this.analyzeDimension(
        processedContent,
        key,
        dimension
      )
    }
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(dimensionScores)
    
    // Apply industry factor if applicable
    const industryKey = options.industry as keyof typeof INDUSTRY_FACTORS
    const adjustedScore = options.industry && INDUSTRY_FACTORS[industryKey]
      ? Math.min(100, overallScore * INDUSTRY_FACTORS[industryKey].multiplier)
      : overallScore
    
    // Generate letter grade
    const letterGrade = this.getLetterGrade(adjustedScore)
    
    // Extract findings
    const { strengths, weaknesses, redFlags } = this.extractFindings(
      processedContent,
      dimensionScores
    )
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      dimensionScores,
      weaknesses,
      redFlags
    )
    
    // Check compliance
    const compliance = this.checkCompliance(processedContent, dimensionScores)
    
    // Calculate metadata
    const metadata = {
      analysis_version: '2.0.0',
      analyzed_at: new Date().toISOString(),
      word_count: processedContent.split(/\s+/).length,
      readability_score: this.calculateReadability(processedContent),
      industry: options.industry
    }
    
    return PolicyAnalysisSchema.parse({
      overall_score: Math.round(adjustedScore),
      letter_grade: letterGrade,
      dimension_scores: dimensionScores,
      strengths,
      weaknesses,
      red_flags: redFlags,
      recommendations,
      compliance,
      metadata
    })
  }
  
  /**
   * Preprocess content for analysis
   */
  private preprocessContent(content: string): string {
    // Remove extra whitespace
    let processed = content.replace(/\s+/g, ' ').trim()
    
    // Remove common boilerplate
    processed = processed.replace(/last updated:.*?\d{4}/gi, '')
    processed = processed.replace(/effective date:.*?\d{4}/gi, '')
    
    // Normalize quotes and punctuation
    processed = processed.replace(/[""]/g, '"')
    processed = processed.replace(/['']/g, "'")
    
    return processed
  }
  
  /**
   * Analyze a specific privacy dimension
   */
  private async analyzeDimension(
    content: string,
    dimensionKey: string,
    dimension: typeof PRIVACY_DIMENSIONS[keyof typeof PRIVACY_DIMENSIONS]
  ): Promise<any> {
    const criteriaScores: Record<string, number> = {}
    const findings: string[] = []
    
    // Analyze each criterion
    for (const [criterionKey, criterion] of Object.entries(dimension.criteria)) {
      const score = this.analyzeCriterion(
        content,
        dimensionKey,
        criterionKey,
        criterion
      )
      
      criteriaScores[criterionKey] = score
      
      if (score >= 80) {
        findings.push(`Strong: ${criterion.description}`)
      } else if (score <= 40) {
        findings.push(`Weak: ${criterion.description}`)
      }
    }
    
    // Calculate dimension score
    const dimensionScore = Object.entries(criteriaScores).reduce(
      (total, [key, score]) => {
        const criterion = dimension.criteria[key as keyof typeof dimension.criteria] as any
        const weight = criterion ? criterion.weight : 0
        return total + (score * weight)
      },
      0
    )
    
    return {
      score: Math.round(dimensionScore),
      criteria_scores: criteriaScores,
      findings
    }
  }
  
  /**
   * Analyze a specific criterion using pattern matching and heuristics
   */
  private analyzeCriterion(
    content: string,
    dimensionKey: string,
    criterionKey: string,
    criterion: { weight: number; description: string }
  ): number {
    let score = 50 // Start at neutral
    
    // Apply specific analysis based on dimension and criterion
    const analysisKey = `${dimensionKey}_${criterionKey}`
    
    switch (analysisKey) {
      case 'DATA_COLLECTION_minimal_collection':
        score = this.analyzeMinimalCollection(content)
        break
      
      case 'DATA_COLLECTION_explicit_categories':
        score = this.analyzeExplicitCategories(content)
        break
      
      case 'DATA_COLLECTION_sensitive_data':
        score = this.analyzeSensitiveData(content)
        break
      
      case 'USER_CONTROL_opt_out_ease':
        score = this.analyzeOptOutEase(content)
        break
      
      case 'USER_CONTROL_deletion_rights':
        score = this.analyzeDeletionRights(content)
        break
      
      case 'DATA_SHARING_no_selling':
        score = this.analyzeNoSelling(content)
        break
      
      case 'TRANSPARENCY_plain_language':
        score = this.analyzePlainLanguage(content)
        break
      
      case 'SECURITY_encryption':
        score = this.analyzeEncryption(content)
        break
      
      case 'RETENTION_limited_retention':
        score = this.analyzeLimitedRetention(content)
        break
      
      default:
        // Generic pattern-based analysis
        score = this.genericPatternAnalysis(content, dimensionKey, criterionKey)
    }
    
    return Math.max(0, Math.min(100, score))
  }
  
  /**
   * Specific analysis methods for key criteria
   */
  
  private analyzeMinimalCollection(content: string): number {
    let score = 50
    
    // Check for positive indicators
    for (const pattern of PRIVACY_INDICATORS.positive.data_minimization) {
      if (pattern.test(content)) score += 15
    }
    
    // Check for negative indicators
    for (const pattern of PRIVACY_INDICATORS.negative.excessive_collection) {
      if (pattern.test(content)) score -= 20
    }
    
    // Check if specific data types are listed
    const dataTypes = content.match(/we collect:?(.*?)(?:\.|;|\n)/gi)
    if (dataTypes && dataTypes.length > 0) score += 10
    
    return score
  }
  
  private analyzeExplicitCategories(content: string): number {
    let score = 30
    
    // Look for explicit data category listings
    const categories = [
      /personal information/i,
      /contact information/i,
      /usage data/i,
      /device information/i,
      /location data/i,
      /payment information/i
    ]
    
    let foundCategories = 0
    for (const category of categories) {
      if (category.test(content)) {
        foundCategories++
        score += 10
      }
    }
    
    // Bonus for comprehensive categorization
    if (foundCategories >= 4) score += 20
    
    return score
  }
  
  private analyzeSensitiveData(content: string): number {
    let score = 70
    
    const sensitiveTypes = [
      /health information/i,
      /medical data/i,
      /financial information/i,
      /social security/i,
      /biometric/i,
      /genetic/i
    ]
    
    let handlesSensitive = false
    for (const type of sensitiveTypes) {
      if (type.test(content)) {
        handlesSensitive = true
        // Check if special protections are mentioned
        if (/special protection|additional security|extra care/i.test(content)) {
          score += 10
        } else {
          score -= 10
        }
      }
    }
    
    // If no sensitive data mentioned, that's good
    if (!handlesSensitive) score = 85
    
    return score
  }
  
  private analyzeOptOutEase(content: string): number {
    let score = 40
    
    // Check for opt-out mechanisms
    if (/opt[- ]?out/i.test(content)) score += 20
    if (/unsubscribe/i.test(content)) score += 15
    if (/preference center/i.test(content)) score += 20
    if (/one[- ]?click/i.test(content)) score += 15
    
    // Check for difficulty indicators
    if (/mail us|send a letter/i.test(content)) score -= 20
    if (/may take.*days/i.test(content)) score -= 10
    
    return score
  }
  
  private analyzeDeletionRights(content: string): number {
    let score = 30
    
    // Positive indicators
    if (/right to (?:erasure|deletion|be forgotten)/i.test(content)) score += 30
    if (/delete your (?:account|data|information)/i.test(content)) score += 20
    if (/request deletion/i.test(content)) score += 15
    
    // Negative indicators
    if (/cannot delete/i.test(content)) score -= 30
    if (/may retain/i.test(content)) score -= 10
    
    return score
  }
  
  private analyzeNoSelling(content: string): number {
    let score = 50
    
    // Strong positive
    for (const pattern of PRIVACY_INDICATORS.positive.no_selling) {
      if (pattern.test(content)) {
        score = 90
        break
      }
    }
    
    // Strong negative
    for (const pattern of PRIVACY_INDICATORS.negative.data_selling) {
      if (pattern.test(content)) {
        score = 20
        break
      }
    }
    
    return score
  }
  
  private analyzePlainLanguage(content: string): number {
    // Calculate readability score
    const readability = this.calculateReadability(content)
    
    // Convert Flesch Reading Ease to our scale
    // 90-100: Very Easy (5th grade) -> 90-100
    // 80-90: Easy (6th grade) -> 80-90
    // 70-80: Fairly Easy (7th grade) -> 70-80
    // 60-70: Standard (8-9th grade) -> 60-70
    // 50-60: Fairly Difficult -> 40-60
    // 30-50: Difficult -> 20-40
    // 0-30: Very Difficult -> 0-20
    
    if (readability >= 70) return 85
    if (readability >= 60) return 70
    if (readability >= 50) return 50
    if (readability >= 40) return 30
    return 20
  }
  
  private analyzeEncryption(content: string): number {
    let score = 30
    
    for (const pattern of PRIVACY_INDICATORS.positive.encryption) {
      if (pattern.test(content)) {
        score += 25
      }
    }
    
    // Specific encryption mentions
    if (/AES[- ]?256/i.test(content)) score += 15
    if (/at rest and in transit/i.test(content)) score += 20
    
    return Math.min(100, score)
  }
  
  private analyzeLimitedRetention(content: string): number {
    let score = 40
    
    for (const pattern of PRIVACY_INDICATORS.positive.limited_retention) {
      if (pattern.test(content)) score += 20
    }
    
    for (const pattern of PRIVACY_INDICATORS.negative.unlimited_retention) {
      if (pattern.test(content)) score -= 30
    }
    
    // Look for specific time periods
    if (/\d+\s*(?:days?|months?|years?)/i.test(content)) score += 15
    
    return score
  }
  
  private genericPatternAnalysis(content: string, dimension: string, criterion: string): number {
    // Fallback pattern analysis
    let score = 50
    
    // Use positive indicators
    for (const [category, patterns] of Object.entries(PRIVACY_INDICATORS.positive)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) score += 5
      }
    }
    
    // Use negative indicators
    for (const [category, patterns] of Object.entries(PRIVACY_INDICATORS.negative)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) score -= 5
      }
    }
    
    return score
  }
  
  /**
   * Calculate overall score from dimension scores
   */
  private calculateOverallScore(dimensionScores: Record<string, any>): number {
    let totalScore = 0
    
    for (const [key, dimension] of Object.entries(PRIVACY_DIMENSIONS)) {
      const dimensionScore = dimensionScores[key]?.score || 0
      totalScore += dimensionScore * dimension.weight
    }
    
    return totalScore
  }
  
  /**
   * Convert numeric score to letter grade
   */
  private getLetterGrade(score: number): string {
    for (const [grade, threshold] of Object.entries(GRADE_THRESHOLDS)) {
      if (score >= threshold) return grade
    }
    return 'F'
  }
  
  /**
   * Extract key findings from the analysis
   */
  private extractFindings(
    content: string,
    dimensionScores: Record<string, any>
  ): {
    strengths: string[]
    weaknesses: string[]
    redFlags: string[]
  } {
    const strengths: string[] = []
    const weaknesses: string[] = []
    const redFlags: string[] = []
    
    // Check for red flags
    for (const [flag, pattern] of Object.entries(PRIVACY_INDICATORS.red_flags)) {
      if (pattern.test(content)) {
        redFlags.push(this.formatRedFlag(flag))
      }
    }
    
    // Extract strengths and weaknesses from dimension scores
    for (const [dimension, data] of Object.entries(dimensionScores)) {
      if (data.score >= 80) {
        strengths.push(`Strong ${PRIVACY_DIMENSIONS[dimension as keyof typeof PRIVACY_DIMENSIONS].name}`)
      } else if (data.score <= 50) {
        weaknesses.push(`Weak ${PRIVACY_DIMENSIONS[dimension as keyof typeof PRIVACY_DIMENSIONS].name}`)
      }
      
      // Add specific findings
      strengths.push(...data.findings.filter((f: string) => f.startsWith('Strong:')))
      weaknesses.push(...data.findings.filter((f: string) => f.startsWith('Weak:')))
    }
    
    return { strengths, weaknesses, redFlags }
  }
  
  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    dimensionScores: Record<string, any>,
    weaknesses: string[],
    redFlags: string[]
  ): Array<{
    priority: 'high' | 'medium' | 'low'
    action: string
    impact: string
  }> {
    const recommendations: Array<{
      priority: 'high' | 'medium' | 'low'
      action: string
      impact: string
    }> = []
    
    // High priority for red flags
    for (const flag of redFlags) {
      recommendations.push({
        priority: 'high',
        action: `Address issue: ${flag}`,
        impact: 'Critical privacy concern that needs immediate attention'
      })
    }
    
    // Medium priority for low-scoring dimensions
    for (const [dimension, data] of Object.entries(dimensionScores)) {
      if (data.score < 50) {
        const dimConfig = PRIVACY_DIMENSIONS[dimension as keyof typeof PRIVACY_DIMENSIONS]
        recommendations.push({
          priority: 'medium',
          action: `Improve ${dimConfig.name}`,
          impact: `Will improve overall privacy score by ${Math.round(dimConfig.weight * 30)}%`
        })
      }
    }
    
    // Low priority for moderate improvements
    for (const [dimension, data] of Object.entries(dimensionScores)) {
      if (data.score >= 50 && data.score < 70) {
        const dimConfig = PRIVACY_DIMENSIONS[dimension as keyof typeof PRIVACY_DIMENSIONS]
        recommendations.push({
          priority: 'low',
          action: `Enhance ${dimConfig.name}`,
          impact: `Will improve user trust and compliance`
        })
      }
    }
    
    return recommendations.slice(0, 5) // Top 5 recommendations
  }
  
  /**
   * Check regulatory compliance
   */
  private checkCompliance(
    content: string,
    dimensionScores: Record<string, any>
  ): {
    gdpr: boolean
    ccpa: boolean
    coppa: boolean
    hipaa?: boolean
  } {
    const compliance = {
      gdpr: false,
      ccpa: false,
      coppa: false,
      hipaa: undefined as boolean | undefined
    }
    
    // GDPR compliance indicators
    const gdprChecks = [
      /gdpr/i.test(content),
      /general data protection regulation/i.test(content),
      /legal basis/i.test(content),
      /data protection officer/i.test(content),
      dimensionScores.USER_CONTROL?.score >= 70,
      dimensionScores.TRANSPARENCY?.score >= 70
    ]
    compliance.gdpr = gdprChecks.filter(Boolean).length >= 3
    
    // CCPA compliance indicators
    const ccpaChecks = [
      /ccpa/i.test(content),
      /california consumer privacy/i.test(content),
      /do not sell/i.test(content),
      /opt[- ]?out.*sale/i.test(content),
      dimensionScores.USER_CONTROL?.score >= 60
    ]
    compliance.ccpa = ccpaChecks.filter(Boolean).length >= 3
    
    // COPPA compliance indicators
    const coppaChecks = [
      /coppa/i.test(content),
      /children.*privacy/i.test(content),
      /under 13/i.test(content),
      /parental consent/i.test(content)
    ]
    compliance.coppa = coppaChecks.filter(Boolean).length >= 2
    
    // HIPAA (only if health-related)
    if (/health|medical|patient/i.test(content)) {
      const hipaaChecks = [
        /hipaa/i.test(content),
        /health insurance portability/i.test(content),
        /protected health information/i.test(content),
        dimensionScores.SECURITY?.score >= 80
      ]
      compliance.hipaa = hipaaChecks.filter(Boolean).length >= 2
    }
    
    return compliance
  }
  
  /**
   * Calculate readability score (Flesch Reading Ease)
   */
  private calculateReadability(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = text.split(/\s+/).filter(w => w.length > 0)
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0)
    
    if (sentences.length === 0 || words.length === 0) return 0
    
    const avgWordsPerSentence = words.length / sentences.length
    const avgSyllablesPerWord = syllables / words.length
    
    // Flesch Reading Ease formula
    const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
    
    return Math.max(0, Math.min(100, score))
  }
  
  /**
   * Count syllables in a word
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '')
    if (word.length <= 3) return 1
    
    const vowels = 'aeiouy'
    let count = 0
    let previousWasVowel = false
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i] || '')
      if (isVowel && !previousWasVowel) count++
      previousWasVowel = isVowel
    }
    
    // Adjust for silent e
    if (word.endsWith('e')) count--
    
    // Ensure at least one syllable
    return Math.max(1, count)
  }
  
  /**
   * Format red flag for display
   */
  private formatRedFlag(flag: string): string {
    const flagMessages: Record<string, string> = {
      no_opt_out: 'No clear opt-out mechanism provided',
      sells_to_brokers: 'May sell data to data brokers',
      changes_without_notice: 'Can change policy without user notice',
      no_deletion: 'No clear data deletion process',
      shares_with_government: 'Shares data with government on request'
    }
    
    return flagMessages[flag] || flag.replace(/_/g, ' ')
  }
}

// Export singleton instance
export const privacyGradingEngine = PrivacyGradingEngine.getInstance()