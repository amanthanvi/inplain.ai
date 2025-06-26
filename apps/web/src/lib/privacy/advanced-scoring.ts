// Advanced Privacy Scoring Algorithm
// Implements a multi-dimensional scoring system based on privacy principles

export interface PrivacyDimension {
  name: string
  weight: number
  score: number
  factors: PrivacyFactor[]
  rationale: string
}

export interface PrivacyFactor {
  name: string
  impact: 'positive' | 'negative' | 'neutral'
  score: number
  evidence: string[]
  severity: 'critical' | 'high' | 'medium' | 'low'
}

export interface PrivacyScoreResult {
  overallScore: number
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F'
  dimensions: PrivacyDimension[]
  strengths: string[]
  weaknesses: string[]
  improvements: string[]
  comparison: {
    industryAverage: number
    percentile: number
    trend: 'improving' | 'stable' | 'declining'
  }
  breakdown: {
    dataMinimization: number
    purposeLimitation: number
    transparency: number
    userControl: number
    security: number
    accountability: number
    lawfulness: number
  }
  certifications: string[]
  flags: {
    darkPatterns: boolean
    excessiveTracking: boolean
    thirdPartyRisks: boolean
    unclearConsent: boolean
    dataRetention: boolean
  }
}

// Scoring weights based on privacy principles
const DIMENSION_WEIGHTS = {
  dataMinimization: 0.15,
  purposeLimitation: 0.15,
  transparency: 0.20,
  userControl: 0.20,
  security: 0.15,
  accountability: 0.10,
  lawfulness: 0.05
}

// Industry benchmarks for comparison
const INDUSTRY_BENCHMARKS: Record<string, { average: number; topQuartile: number }> = {
  technology: { average: 65, topQuartile: 80 },
  'social-media': { average: 55, topQuartile: 70 },
  'e-commerce': { average: 60, topQuartile: 75 },
  finance: { average: 70, topQuartile: 85 },
  healthcare: { average: 75, topQuartile: 90 },
  entertainment: { average: 60, topQuartile: 75 },
  education: { average: 65, topQuartile: 80 },
  transportation: { average: 60, topQuartile: 75 },
  'food-delivery': { average: 55, topQuartile: 70 },
  gaming: { average: 50, topQuartile: 65 }
}

export class AdvancedPrivacyScorer {
  constructor(private policyAnalysis: any) {}

  calculateScore(options?: {
    industry?: string
    previousScores?: number[]
    companySize?: 'small' | 'medium' | 'large' | 'enterprise'
    jurisdiction?: string[]
  }): PrivacyScoreResult {
    const dimensions = this.evaluateDimensions()
    const overallScore = this.calculateOverallScore(dimensions)
    const grade = this.calculateGrade(overallScore)
    const breakdown = this.getScoreBreakdown(dimensions)
    const flags = this.detectPrivacyFlags()
    
    // Calculate industry comparison
    const industryData = INDUSTRY_BENCHMARKS[options?.industry || 'technology']
    const percentile = this.calculatePercentile(overallScore, industryData)
    const trend = this.calculateTrend(overallScore, options?.previousScores)

    // Identify strengths and weaknesses
    const { strengths, weaknesses } = this.identifyStrengthsWeaknesses(dimensions)
    const improvements = this.generateImprovements(dimensions, flags)
    const certifications = this.detectCertifications()

    return {
      overallScore,
      grade,
      dimensions,
      strengths,
      weaknesses,
      improvements,
      comparison: {
        industryAverage: industryData.average,
        percentile,
        trend
      },
      breakdown,
      certifications,
      flags
    }
  }

  private evaluateDimensions(): PrivacyDimension[] {
    return [
      this.evaluateDataMinimization(),
      this.evaluatePurposeLimitation(),
      this.evaluateTransparency(),
      this.evaluateUserControl(),
      this.evaluateSecurity(),
      this.evaluateAccountability(),
      this.evaluateLawfulness()
    ]
  }

  private evaluateDataMinimization(): PrivacyDimension {
    const factors: PrivacyFactor[] = []
    let totalScore = 0

    // Check for minimal data collection
    const dataTypes = this.policyAnalysis.dataCollection?.types || []
    const dataCount = dataTypes.length

    if (dataCount < 5) {
      factors.push({
        name: 'Limited data collection',
        impact: 'positive',
        score: 20,
        evidence: ['Collects fewer than 5 types of personal data'],
        severity: 'low'
      })
      totalScore += 20
    } else if (dataCount > 15) {
      factors.push({
        name: 'Extensive data collection',
        impact: 'negative',
        score: -20,
        evidence: [`Collects ${dataCount} different types of personal data`],
        severity: 'high'
      })
      totalScore -= 20
    }

    // Check for sensitive data
    const sensitiveData = dataTypes.filter((type: string) => 
      ['health', 'biometric', 'genetic', 'financial', 'location', 'children'].some(s => type.includes(s))
    )
    
    if (sensitiveData.length === 0) {
      factors.push({
        name: 'No sensitive data collection',
        impact: 'positive',
        score: 25,
        evidence: ['Does not collect sensitive personal data'],
        severity: 'low'
      })
      totalScore += 25
    } else {
      factors.push({
        name: 'Sensitive data collection',
        impact: 'negative',
        score: -15 * sensitiveData.length,
        evidence: sensitiveData.map((d: string) => `Collects ${d} data`),
        severity: 'critical'
      })
      totalScore -= 15 * sensitiveData.length
    }

    // Check for data collection justification
    if (this.policyAnalysis.dataCollection?.justified) {
      factors.push({
        name: 'Justified data collection',
        impact: 'positive',
        score: 15,
        evidence: ['Provides clear justification for each data type collected'],
        severity: 'low'
      })
      totalScore += 15
    }

    // Anonymous data usage
    if (this.policyAnalysis.dataCollection?.anonymization) {
      factors.push({
        name: 'Data anonymization',
        impact: 'positive',
        score: 20,
        evidence: ['Implements data anonymization techniques'],
        severity: 'low'
      })
      totalScore += 20
    }

    return {
      name: 'Data Minimization',
      weight: DIMENSION_WEIGHTS.dataMinimization,
      score: Math.max(0, Math.min(100, 50 + totalScore)),
      factors,
      rationale: 'Evaluates whether the service collects only necessary data'
    }
  }

  private evaluatePurposeLimitation(): PrivacyDimension {
    const factors: PrivacyFactor[] = []
    let totalScore = 0

    // Check for clear purposes
    const purposes = this.policyAnalysis.purposes || []
    if (purposes.length > 0 && purposes.every((p: any) => p.specific)) {
      factors.push({
        name: 'Specific purposes defined',
        impact: 'positive',
        score: 20,
        evidence: ['All data collection purposes are specifically defined'],
        severity: 'low'
      })
      totalScore += 20
    }

    // Check for purpose creep
    if (this.policyAnalysis.purposeCreep) {
      factors.push({
        name: 'Purpose creep detected',
        impact: 'negative',
        score: -25,
        evidence: ['Policy allows expanding data use beyond original purposes'],
        severity: 'high'
      })
      totalScore -= 25
    }

    // Secondary use restrictions
    if (this.policyAnalysis.secondaryUse?.restricted) {
      factors.push({
        name: 'Secondary use restrictions',
        impact: 'positive',
        score: 15,
        evidence: ['Restricts secondary use of personal data'],
        severity: 'low'
      })
      totalScore += 15
    }

    // Marketing use
    if (this.policyAnalysis.marketingUse?.optIn) {
      factors.push({
        name: 'Opt-in marketing',
        impact: 'positive',
        score: 15,
        evidence: ['Requires explicit opt-in for marketing use'],
        severity: 'low'
      })
      totalScore += 15
    } else if (this.policyAnalysis.marketingUse?.optOut) {
      factors.push({
        name: 'Opt-out marketing',
        impact: 'neutral',
        score: 0,
        evidence: ['Allows opt-out from marketing use'],
        severity: 'medium'
      })
    }

    return {
      name: 'Purpose Limitation',
      weight: DIMENSION_WEIGHTS.purposeLimitation,
      score: Math.max(0, Math.min(100, 50 + totalScore)),
      factors,
      rationale: 'Assesses whether data is used only for stated purposes'
    }
  }

  private evaluateTransparency(): PrivacyDimension {
    const factors: PrivacyFactor[] = []
    let totalScore = 0

    // Policy clarity
    if (this.policyAnalysis.readability?.score > 80) {
      factors.push({
        name: 'Clear and readable policy',
        impact: 'positive',
        score: 20,
        evidence: ['Policy is written in clear, understandable language'],
        severity: 'low'
      })
      totalScore += 20
    } else if (this.policyAnalysis.readability?.score < 50) {
      factors.push({
        name: 'Complex policy language',
        impact: 'negative',
        score: -15,
        evidence: ['Policy uses complex legal jargon'],
        severity: 'medium'
      })
      totalScore -= 15
    }

    // Data flow transparency
    if (this.policyAnalysis.dataFlow?.visualized) {
      factors.push({
        name: 'Visual data flow',
        impact: 'positive',
        score: 15,
        evidence: ['Provides visual representation of data flows'],
        severity: 'low'
      })
      totalScore += 15
    }

    // Third-party transparency
    if (this.policyAnalysis.thirdParties?.named) {
      factors.push({
        name: 'Named third parties',
        impact: 'positive',
        score: 20,
        evidence: ['Specifically names all third-party data recipients'],
        severity: 'low'
      })
      totalScore += 20
    } else if (this.policyAnalysis.thirdParties?.categories) {
      factors.push({
        name: 'Third-party categories',
        impact: 'neutral',
        score: 5,
        evidence: ['Lists categories of third-party recipients'],
        severity: 'medium'
      })
      totalScore += 5
    }

    // Contact information
    if (this.policyAnalysis.contact?.dpo) {
      factors.push({
        name: 'DPO contact available',
        impact: 'positive',
        score: 10,
        evidence: ['Provides Data Protection Officer contact'],
        severity: 'low'
      })
      totalScore += 10
    }

    return {
      name: 'Transparency',
      weight: DIMENSION_WEIGHTS.transparency,
      score: Math.max(0, Math.min(100, 50 + totalScore)),
      factors,
      rationale: 'Measures how clearly privacy practices are communicated'
    }
  }

  private evaluateUserControl(): PrivacyDimension {
    const factors: PrivacyFactor[] = []
    let totalScore = 0

    // Access rights
    if (this.policyAnalysis.userRights?.access?.easy) {
      factors.push({
        name: 'Easy data access',
        impact: 'positive',
        score: 15,
        evidence: ['Provides easy mechanism for data access requests'],
        severity: 'low'
      })
      totalScore += 15
    }

    // Deletion rights
    if (this.policyAnalysis.userRights?.deletion?.automated) {
      factors.push({
        name: 'Automated deletion',
        impact: 'positive',
        score: 20,
        evidence: ['Offers automated account and data deletion'],
        severity: 'low'
      })
      totalScore += 20
    } else if (this.policyAnalysis.userRights?.deletion?.available) {
      factors.push({
        name: 'Manual deletion available',
        impact: 'neutral',
        score: 5,
        evidence: ['Allows data deletion through manual request'],
        severity: 'medium'
      })
      totalScore += 5
    }

    // Portability
    if (this.policyAnalysis.userRights?.portability?.machineReadable) {
      factors.push({
        name: 'Data portability',
        impact: 'positive',
        score: 15,
        evidence: ['Provides data in machine-readable format'],
        severity: 'low'
      })
      totalScore += 15
    }

    // Consent management
    if (this.policyAnalysis.consent?.granular) {
      factors.push({
        name: 'Granular consent',
        impact: 'positive',
        score: 20,
        evidence: ['Offers granular consent options for different purposes'],
        severity: 'low'
      })
      totalScore += 20
    }

    // Privacy dashboard
    if (this.policyAnalysis.privacyTools?.dashboard) {
      factors.push({
        name: 'Privacy dashboard',
        impact: 'positive',
        score: 15,
        evidence: ['Provides centralized privacy control dashboard'],
        severity: 'low'
      })
      totalScore += 15
    }

    return {
      name: 'User Control',
      weight: DIMENSION_WEIGHTS.userControl,
      score: Math.max(0, Math.min(100, 50 + totalScore)),
      factors,
      rationale: 'Evaluates user control over their personal data'
    }
  }

  private evaluateSecurity(): PrivacyDimension {
    const factors: PrivacyFactor[] = []
    let totalScore = 0

    // Encryption
    if (this.policyAnalysis.security?.encryption?.atRest && this.policyAnalysis.security?.encryption?.inTransit) {
      factors.push({
        name: 'Comprehensive encryption',
        impact: 'positive',
        score: 25,
        evidence: ['Encrypts data both at rest and in transit'],
        severity: 'low'
      })
      totalScore += 25
    } else if (this.policyAnalysis.security?.encryption?.inTransit) {
      factors.push({
        name: 'Transit encryption only',
        impact: 'neutral',
        score: 10,
        evidence: ['Encrypts data only in transit'],
        severity: 'medium'
      })
      totalScore += 10
    }

    // Access controls
    if (this.policyAnalysis.security?.accessControls?.mfa) {
      factors.push({
        name: 'Multi-factor authentication',
        impact: 'positive',
        score: 15,
        evidence: ['Supports multi-factor authentication'],
        severity: 'low'
      })
      totalScore += 15
    }

    // Security audits
    if (this.policyAnalysis.security?.audits?.regular) {
      factors.push({
        name: 'Regular security audits',
        impact: 'positive',
        score: 20,
        evidence: ['Conducts regular security audits'],
        severity: 'low'
      })
      totalScore += 20
    }

    // Breach notification
    if (this.policyAnalysis.security?.breachNotification?.within72Hours) {
      factors.push({
        name: 'Timely breach notification',
        impact: 'positive',
        score: 15,
        evidence: ['Commits to breach notification within 72 hours'],
        severity: 'low'
      })
      totalScore += 15
    }

    // ISO certifications
    if (this.policyAnalysis.security?.certifications?.includes('ISO27001')) {
      factors.push({
        name: 'ISO 27001 certified',
        impact: 'positive',
        score: 20,
        evidence: ['Holds ISO 27001 security certification'],
        severity: 'low'
      })
      totalScore += 20
    }

    return {
      name: 'Security',
      weight: DIMENSION_WEIGHTS.security,
      score: Math.max(0, Math.min(100, 50 + totalScore)),
      factors,
      rationale: 'Assesses technical and organizational security measures'
    }
  }

  private evaluateAccountability(): PrivacyDimension {
    const factors: PrivacyFactor[] = []
    let totalScore = 0

    // Privacy by design
    if (this.policyAnalysis.privacyByDesign) {
      factors.push({
        name: 'Privacy by design',
        impact: 'positive',
        score: 20,
        evidence: ['Implements privacy by design principles'],
        severity: 'low'
      })
      totalScore += 20
    }

    // DPO appointment
    if (this.policyAnalysis.governance?.dpo) {
      factors.push({
        name: 'Data Protection Officer',
        impact: 'positive',
        score: 15,
        evidence: ['Has appointed a Data Protection Officer'],
        severity: 'low'
      })
      totalScore += 15
    }

    // Privacy impact assessments
    if (this.policyAnalysis.governance?.pia) {
      factors.push({
        name: 'Privacy impact assessments',
        impact: 'positive',
        score: 15,
        evidence: ['Conducts privacy impact assessments'],
        severity: 'low'
      })
      totalScore += 15
    }

    // Vendor management
    if (this.policyAnalysis.governance?.vendorManagement) {
      factors.push({
        name: 'Vendor privacy requirements',
        impact: 'positive',
        score: 10,
        evidence: ['Imposes privacy requirements on vendors'],
        severity: 'low'
      })
      totalScore += 10
    }

    // Transparency reports
    if (this.policyAnalysis.governance?.transparencyReports) {
      factors.push({
        name: 'Transparency reports',
        impact: 'positive',
        score: 15,
        evidence: ['Publishes regular transparency reports'],
        severity: 'low'
      })
      totalScore += 15
    }

    return {
      name: 'Accountability',
      weight: DIMENSION_WEIGHTS.accountability,
      score: Math.max(0, Math.min(100, 50 + totalScore)),
      factors,
      rationale: 'Measures organizational accountability and governance'
    }
  }

  private evaluateLawfulness(): PrivacyDimension {
    const factors: PrivacyFactor[] = []
    let totalScore = 0

    // Legal basis
    if (this.policyAnalysis.legalBasis?.specified) {
      factors.push({
        name: 'Legal basis specified',
        impact: 'positive',
        score: 20,
        evidence: ['Specifies legal basis for each processing activity'],
        severity: 'low'
      })
      totalScore += 20
    }

    // GDPR compliance
    if (this.policyAnalysis.compliance?.gdpr) {
      factors.push({
        name: 'GDPR compliant',
        impact: 'positive',
        score: 25,
        evidence: ['Demonstrates GDPR compliance'],
        severity: 'low'
      })
      totalScore += 25
    }

    // CCPA compliance
    if (this.policyAnalysis.compliance?.ccpa) {
      factors.push({
        name: 'CCPA compliant',
        impact: 'positive',
        score: 15,
        evidence: ['Complies with California privacy law'],
        severity: 'low'
      })
      totalScore += 15
    }

    // International transfers
    if (this.policyAnalysis.internationalTransfers?.safeguards) {
      factors.push({
        name: 'Transfer safeguards',
        impact: 'positive',
        score: 15,
        evidence: ['Implements safeguards for international data transfers'],
        severity: 'low'
      })
      totalScore += 15
    }

    return {
      name: 'Lawfulness',
      weight: DIMENSION_WEIGHTS.lawfulness,
      score: Math.max(0, Math.min(100, 50 + totalScore)),
      factors,
      rationale: 'Evaluates legal compliance and lawful processing'
    }
  }

  private calculateOverallScore(dimensions: PrivacyDimension[]): number {
    const weightedSum = dimensions.reduce((sum, dim) => {
      return sum + (dim.score * dim.weight)
    }, 0)

    return Math.round(weightedSum)
  }

  private calculateGrade(score: number): PrivacyScoreResult['grade'] {
    if (score >= 95) return 'A+'
    if (score >= 90) return 'A'
    if (score >= 85) return 'A-'
    if (score >= 80) return 'B+'
    if (score >= 75) return 'B'
    if (score >= 70) return 'B-'
    if (score >= 65) return 'C+'
    if (score >= 60) return 'C'
    if (score >= 55) return 'C-'
    if (score >= 50) return 'D'
    return 'F'
  }

  private calculatePercentile(score: number, industryData: { average: number; topQuartile: number }): number {
    if (score >= industryData.topQuartile) {
      // Top quartile (75-100 percentile)
      const range = 100 - industryData.topQuartile
      const position = (score - industryData.topQuartile) / range
      return Math.round(75 + (position * 25))
    } else if (score >= industryData.average) {
      // Above average (50-75 percentile)
      const range = industryData.topQuartile - industryData.average
      const position = (score - industryData.average) / range
      return Math.round(50 + (position * 25))
    } else {
      // Below average (0-50 percentile)
      const position = score / industryData.average
      return Math.round(position * 50)
    }
  }

  private calculateTrend(currentScore: number, previousScores?: number[]): 'improving' | 'stable' | 'declining' {
    if (!previousScores || previousScores.length === 0) return 'stable'

    const recentScores = previousScores.slice(-3)
    const avgPrevious = recentScores.reduce((a, b) => a + b, 0) / recentScores.length

    if (currentScore > avgPrevious + 5) return 'improving'
    if (currentScore < avgPrevious - 5) return 'declining'
    return 'stable'
  }

  private identifyStrengthsWeaknesses(dimensions: PrivacyDimension[]): {
    strengths: string[]
    weaknesses: string[]
  } {
    const strengths: string[] = []
    const weaknesses: string[] = []

    dimensions.forEach(dim => {
      if (dim.score >= 80) {
        strengths.push(`Strong ${dim.name.toLowerCase()}: ${dim.factors.filter(f => f.impact === 'positive').map(f => f.name).join(', ')}`)
      } else if (dim.score <= 40) {
        weaknesses.push(`Weak ${dim.name.toLowerCase()}: ${dim.factors.filter(f => f.impact === 'negative').map(f => f.name).join(', ')}`)
      }
    })

    // Add top positive factors across all dimensions
    const allPositiveFactors = dimensions
      .flatMap(d => d.factors)
      .filter(f => f.impact === 'positive')
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    allPositiveFactors.forEach(f => {
      if (!strengths.some(s => s.includes(f.name))) {
        strengths.push(f.name)
      }
    })

    // Add critical negative factors
    const criticalFactors = dimensions
      .flatMap(d => d.factors)
      .filter(f => f.impact === 'negative' && f.severity === 'critical')

    criticalFactors.forEach(f => {
      if (!weaknesses.some(w => w.includes(f.name))) {
        weaknesses.push(f.name)
      }
    })

    return { strengths, weaknesses }
  }

  private generateImprovements(dimensions: PrivacyDimension[], flags: PrivacyScoreResult['flags']): string[] {
    const improvements: string[] = []

    // Low-scoring dimensions
    dimensions
      .filter(d => d.score < 60)
      .forEach(d => {
        switch (d.name) {
          case 'Data Minimization':
            improvements.push('Reduce data collection to only what is necessary for core functionality')
            improvements.push('Implement data anonymization for analytics and non-essential features')
            break
          case 'Purpose Limitation':
            improvements.push('Clearly define and limit purposes for each type of data collected')
            improvements.push('Implement technical controls to prevent purpose creep')
            break
          case 'Transparency':
            improvements.push('Simplify privacy policy language and add visual aids')
            improvements.push('Create a privacy center with clear explanations of data practices')
            break
          case 'User Control':
            improvements.push('Implement a self-service privacy dashboard for users')
            improvements.push('Add granular consent controls for different data uses')
            break
          case 'Security':
            improvements.push('Implement end-to-end encryption for sensitive data')
            improvements.push('Obtain third-party security certifications (ISO 27001, SOC 2)')
            break
          case 'Accountability':
            improvements.push('Appoint a Data Protection Officer')
            improvements.push('Conduct regular privacy impact assessments')
            break
          case 'Lawfulness':
            improvements.push('Clearly specify legal basis for each processing activity')
            improvements.push('Implement appropriate safeguards for international data transfers')
            break
        }
      })

    // Flag-based improvements
    if (flags.darkPatterns) {
      improvements.push('Remove dark patterns and make privacy choices equally prominent')
    }
    if (flags.excessiveTracking) {
      improvements.push('Reduce tracking technologies and implement privacy-preserving analytics')
    }
    if (flags.thirdPartyRisks) {
      improvements.push('Audit third-party data sharing and implement stricter vendor controls')
    }
    if (flags.unclearConsent) {
      improvements.push('Implement clear, affirmative consent mechanisms')
    }
    if (flags.dataRetention) {
      improvements.push('Define and implement reasonable data retention periods')
    }

    return improvements.slice(0, 5) // Return top 5 improvements
  }

  private detectPrivacyFlags(): PrivacyScoreResult['flags'] {
    return {
      darkPatterns: this.policyAnalysis.darkPatterns?.detected || false,
      excessiveTracking: (this.policyAnalysis.tracking?.technologies?.length || 0) > 10,
      thirdPartyRisks: (this.policyAnalysis.thirdParties?.count || 0) > 50,
      unclearConsent: !this.policyAnalysis.consent?.clear || false,
      dataRetention: !this.policyAnalysis.retention?.defined || false
    }
  }

  private detectCertifications(): string[] {
    const certifications: string[] = []

    if (this.policyAnalysis.certifications?.iso27001) certifications.push('ISO 27001')
    if (this.policyAnalysis.certifications?.soc2) certifications.push('SOC 2')
    if (this.policyAnalysis.certifications?.privacyShield) certifications.push('Privacy Shield')
    if (this.policyAnalysis.certifications?.truste) certifications.push('TRUSTe')
    if (this.policyAnalysis.certifications?.bbb) certifications.push('BBB Privacy')

    return certifications
  }

  private getScoreBreakdown(dimensions: PrivacyDimension[]): PrivacyScoreResult['breakdown'] {
    const breakdown: any = {}
    dimensions.forEach(dim => {
      const key = dim.name.charAt(0).toLowerCase() + dim.name.slice(1).replace(/\s/g, '')
      breakdown[key] = dim.score
    })
    return breakdown
  }
}

// Utility function to compare multiple policies
export function comparePolicies(policies: Array<{
  company: string
  analysis: any
  industry?: string
}>): {
  rankings: Array<{ company: string; score: number; grade: string }>
  bestPractices: Array<{ practice: string; companies: string[] }>
  concerns: Array<{ issue: string; companies: string[] }>
  recommendations: Record<string, string[]>
} {
  const results = policies.map(p => {
    const scorer = new AdvancedPrivacyScorer(p.analysis)
    const result = scorer.calculateScore({ industry: p.industry })
    return { company: p.company, result }
  })

  // Rank by score
  const rankings = results
    .map(r => ({
      company: r.company,
      score: r.result.overallScore,
      grade: r.result.grade
    }))
    .sort((a, b) => b.score - a.score)

  // Identify best practices
  const bestPractices: Array<{ practice: string; companies: string[] }> = []
  const practicesMap = new Map<string, Set<string>>()

  results.forEach(r => {
    r.result.strengths.forEach(strength => {
      if (!practicesMap.has(strength)) {
        practicesMap.set(strength, new Set())
      }
      practicesMap.get(strength)!.add(r.company)
    })
  })

  practicesMap.forEach((companies, practice) => {
    if (companies.size >= 2) {
      bestPractices.push({ practice, companies: Array.from(companies) })
    }
  })

  // Identify common concerns
  const concerns: Array<{ issue: string; companies: string[] }> = []
  const concernsMap = new Map<string, Set<string>>()

  results.forEach(r => {
    r.result.weaknesses.forEach(weakness => {
      if (!concernsMap.has(weakness)) {
        concernsMap.set(weakness, new Set())
      }
      concernsMap.get(weakness)!.add(r.company)
    })
  })

  concernsMap.forEach((companies, issue) => {
    if (companies.size >= 2) {
      concerns.push({ issue, companies: Array.from(companies) })
    }
  })

  // Generate personalized recommendations
  const recommendations: Record<string, string[]> = {}
  results.forEach(r => {
    recommendations[r.company] = r.result.improvements
  })

  return { rankings, bestPractices, concerns, recommendations }
}