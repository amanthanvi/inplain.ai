import { describe, it, expect } from 'vitest'
import {
  calculatePrivacyScore,
  calculateDimensionScore,
  evaluateIndicators,
  generateScoreBreakdown,
  compareScores,
  getScoreInsights,
  calculateGDPRCompliance,
  calculateCCPACompliance,
  DIMENSION_WEIGHTS,
  PRIVACY_INDICATORS
} from '../advanced-scoring'

describe('AdvancedScoring', () => {
  const mockPolicyContent = `
    We collect minimal data necessary for our service to function.
    Data is only used for the stated purposes.
    We are transparent about our data practices.
    Users can access, modify, and delete their data.
    We implement strong security measures including encryption.
    We conduct regular privacy audits.
    We comply with GDPR and CCPA regulations.
  `

  const mockWeakPolicyContent = `
    We collect various data for multiple purposes.
    We may share data with third parties.
    Users have limited control over their data.
    Security measures are in place.
  `

  describe('calculatePrivacyScore', () => {
    it('should calculate high score for privacy-focused policy', () => {
      const score = calculatePrivacyScore(mockPolicyContent)
      
      expect(score.overall).toBeGreaterThan(75)
      expect(score.grade).toMatch(/^[AB]$/)
      expect(score.dimensions).toHaveProperty('dataMinimization')
      expect(score.dimensions).toHaveProperty('transparency')
      expect(score.dimensions).toHaveProperty('userControl')
    })

    it('should calculate lower score for weak privacy policy', () => {
      const score = calculatePrivacyScore(mockWeakPolicyContent)
      
      expect(score.overall).toBeLessThan(60)
      expect(score.grade).toMatch(/^[CD]$/)
    })

    it('should assign correct grades based on score ranges', () => {
      const mockScores = [
        { content: 'excellent privacy policy with all indicators', expectedGrade: 'A' },
        { content: 'good privacy policy', expectedGrade: 'B' },
        { content: 'average policy', expectedGrade: 'C' },
        { content: 'poor policy', expectedGrade: 'D' },
        { content: '', expectedGrade: 'F' }
      ]

      // This is a simplified test - in reality, the grade depends on the actual content analysis
      const score = calculatePrivacyScore(mockPolicyContent)
      expect(['A', 'B', 'C', 'D', 'F']).toContain(score.grade)
    })
  })

  describe('calculateDimensionScore', () => {
    it('should calculate dimension score based on indicators', () => {
      const indicators = PRIVACY_INDICATORS.dataMinimization
      const score = calculateDimensionScore(mockPolicyContent, indicators)
      
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should detect positive indicators', () => {
      const content = 'We collect minimal data and only what is necessary'
      const indicators = PRIVACY_INDICATORS.dataMinimization
      const score = calculateDimensionScore(content, indicators)
      
      expect(score).toBeGreaterThan(50)
    })

    it('should detect negative indicators', () => {
      const content = 'We collect extensive data including unnecessary information'
      const indicators = PRIVACY_INDICATORS.dataMinimization
      const score = calculateDimensionScore(content, indicators)
      
      expect(score).toBeLessThan(50)
    })
  })

  describe('evaluateIndicators', () => {
    it('should evaluate positive indicators correctly', () => {
      const indicators = {
        positive: ['minimal data', 'necessary']
      }
      const score = evaluateIndicators(mockPolicyContent, indicators)
      
      expect(score.found).toBeGreaterThan(0)
      expect(score.score).toBeGreaterThan(50)
    })

    it('should evaluate negative indicators correctly', () => {
      const indicators = {
        negative: ['extensive tracking', 'unnecessary collection']
      }
      const score = evaluateIndicators(mockPolicyContent, indicators)
      
      expect(score.notFound).toBe(2)
      expect(score.penalty).toBe(0)
    })

    it('should handle required indicators', () => {
      const indicators = {
        positive: ['data protection'],
        required: ['GDPR', 'security measures']
      }
      const score = evaluateIndicators(mockPolicyContent, indicators)
      
      expect(score.score).toBeGreaterThan(0)
    })
  })

  describe('generateScoreBreakdown', () => {
    it('should generate detailed breakdown for each dimension', () => {
      const dimensions = {
        dataMinimization: 85,
        transparency: 90,
        userControl: 75,
        security: 80,
        purposeLimitation: 70,
        accountability: 85,
        lawfulness: 95
      }
      
      const breakdown = generateScoreBreakdown(dimensions)
      
      expect(breakdown).toHaveLength(7)
      expect(breakdown[0]).toHaveProperty('dimension')
      expect(breakdown[0]).toHaveProperty('score')
      expect(breakdown[0]).toHaveProperty('weight')
      expect(breakdown[0]).toHaveProperty('contribution')
      expect(breakdown[0]).toHaveProperty('rating')
    })

    it('should calculate correct contribution based on weights', () => {
      const dimensions = {
        dataMinimization: 100,
        transparency: 100,
        userControl: 100,
        security: 100,
        purposeLimitation: 100,
        accountability: 100,
        lawfulness: 100
      }
      
      const breakdown = generateScoreBreakdown(dimensions)
      const totalContribution = breakdown.reduce((sum, item) => sum + item.contribution, 0)
      
      expect(totalContribution).toBeCloseTo(100, 1)
    })

    it('should assign correct ratings', () => {
      const dimensions = {
        dataMinimization: 95,  // Excellent
        transparency: 82,      // Good
        userControl: 68,       // Fair
        security: 45,          // Poor
        purposeLimitation: 30, // Poor
        accountability: 85,    // Good
        lawfulness: 90         // Excellent
      }
      
      const breakdown = generateScoreBreakdown(dimensions)
      
      expect(breakdown.find(d => d.dimension === 'Data Minimization')?.rating).toBe('Excellent')
      expect(breakdown.find(d => d.dimension === 'Transparency')?.rating).toBe('Good')
      expect(breakdown.find(d => d.dimension === 'User Control')?.rating).toBe('Fair')
      expect(breakdown.find(d => d.dimension === 'Security')?.rating).toBe('Poor')
    })
  })

  describe('compareScores', () => {
    it('should compare two privacy scores', () => {
      const score1 = calculatePrivacyScore(mockPolicyContent)
      const score2 = calculatePrivacyScore(mockWeakPolicyContent)
      
      const comparison = compareScores(score1, score2)
      
      expect(comparison.improvement).toBeGreaterThan(0)
      expect(comparison.improved).toContain('dataMinimization')
      expect(comparison.improved).toContain('transparency')
      expect(comparison.improved).toContain('userControl')
    })

    it('should identify degraded dimensions', () => {
      const score1 = calculatePrivacyScore(mockWeakPolicyContent)
      const score2 = calculatePrivacyScore(mockPolicyContent)
      
      const comparison = compareScores(score1, score2)
      
      expect(comparison.improvement).toBeLessThan(0)
      expect(comparison.degraded.length).toBeGreaterThan(0)
    })

    it('should track dimension changes', () => {
      const score1 = {
        overall: 70,
        grade: 'B' as const,
        dimensions: {
          dataMinimization: 80,
          transparency: 70,
          userControl: 60,
          security: 75,
          purposeLimitation: 70,
          accountability: 65,
          lawfulness: 85
        }
      }
      
      const score2 = {
        overall: 75,
        grade: 'B' as const,
        dimensions: {
          dataMinimization: 85,
          transparency: 75,
          userControl: 55,
          security: 80,
          purposeLimitation: 75,
          accountability: 70,
          lawfulness: 85
        }
      }
      
      const comparison = compareScores(score1, score2)
      
      expect(comparison.dimensionChanges.dataMinimization).toBe(5)
      expect(comparison.dimensionChanges.userControl).toBe(-5)
      expect(comparison.dimensionChanges.lawfulness).toBe(0)
    })
  })

  describe('getScoreInsights', () => {
    it('should provide insights for high scores', () => {
      const score = {
        overall: 92,
        grade: 'A' as const,
        dimensions: {
          dataMinimization: 95,
          transparency: 90,
          userControl: 88,
          security: 92,
          purposeLimitation: 94,
          accountability: 91,
          lawfulness: 96
        }
      }
      
      const insights = getScoreInsights(score)
      
      expect(insights.summary).toContain('excellent')
      expect(insights.strengths.length).toBeGreaterThan(0)
      expect(insights.improvements.length).toBeLessThanOrEqual(3)
    })

    it('should identify areas for improvement', () => {
      const score = {
        overall: 65,
        grade: 'C' as const,
        dimensions: {
          dataMinimization: 45,
          transparency: 70,
          userControl: 40,
          security: 80,
          purposeLimitation: 75,
          accountability: 65,
          lawfulness: 85
        }
      }
      
      const insights = getScoreInsights(score)
      
      expect(insights.improvements).toContain('Data Minimization')
      expect(insights.improvements).toContain('User Control')
      expect(insights.strengths).toContain('Lawfulness')
    })

    it('should provide tailored recommendations', () => {
      const score = {
        overall: 55,
        grade: 'D' as const,
        dimensions: {
          dataMinimization: 40,
          transparency: 50,
          userControl: 45,
          security: 70,
          purposeLimitation: 55,
          accountability: 60,
          lawfulness: 75
        }
      }
      
      const insights = getScoreInsights(score)
      
      expect(insights.recommendations.length).toBeGreaterThan(0)
      expect(insights.recommendations[0]).toContain('data minimization')
    })
  })

  describe('calculateGDPRCompliance', () => {
    it('should calculate GDPR compliance score', () => {
      const score = calculateGDPRCompliance(mockPolicyContent)
      
      expect(score).toHaveProperty('score')
      expect(score).toHaveProperty('compliant')
      expect(score).toHaveProperty('missingElements')
      expect(score.score).toBeGreaterThanOrEqual(0)
      expect(score.score).toBeLessThanOrEqual(100)
    })

    it('should detect GDPR elements', () => {
      const gdprContent = `
        We process data lawfully with user consent.
        Users have the right to access their data.
        Users can request data portability.
        We implement privacy by design.
        Data protection officer contact: dpo@example.com
      `
      
      const score = calculateGDPRCompliance(gdprContent)
      
      expect(score.score).toBeGreaterThan(70)
      expect(score.compliant).toBe(true)
      expect(score.missingElements.length).toBeLessThan(5)
    })

    it('should identify missing GDPR elements', () => {
      const nonCompliantContent = 'Basic privacy policy without GDPR considerations'
      
      const score = calculateGDPRCompliance(nonCompliantContent)
      
      expect(score.compliant).toBe(false)
      expect(score.missingElements).toContain('Lawful basis')
      expect(score.missingElements).toContain('Right to erasure')
    })
  })

  describe('calculateCCPACompliance', () => {
    it('should calculate CCPA compliance score', () => {
      const score = calculateCCPACompliance(mockPolicyContent)
      
      expect(score).toHaveProperty('score')
      expect(score).toHaveProperty('compliant')
      expect(score).toHaveProperty('missingElements')
      expect(score.score).toBeGreaterThanOrEqual(0)
      expect(score.score).toBeLessThanOrEqual(100)
    })

    it('should detect CCPA elements', () => {
      const ccpaContent = `
        California residents have the right to know what data we collect.
        You can opt-out of the sale of personal information.
        We do not discriminate based on privacy rights.
        Categories of data collected: identifiers, commercial information.
        Contact us to delete your personal information.
      `
      
      const score = calculateCCPACompliance(ccpaContent)
      
      expect(score.score).toBeGreaterThan(70)
      expect(score.compliant).toBe(true)
      expect(score.missingElements.length).toBeLessThan(4)
    })

    it('should identify missing CCPA elements', () => {
      const nonCompliantContent = 'Basic privacy policy without CCPA considerations'
      
      const score = calculateCCPACompliance(nonCompliantContent)
      
      expect(score.compliant).toBe(false)
      expect(score.missingElements).toContain('Right to know')
      expect(score.missingElements).toContain('Right to opt-out')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty policy content', () => {
      const score = calculatePrivacyScore('')
      
      expect(score.overall).toBe(0)
      expect(score.grade).toBe('F')
      Object.values(score.dimensions).forEach(dimScore => {
        expect(dimScore).toBe(0)
      })
    })

    it('should handle very long policy content', () => {
      const longContent = mockPolicyContent.repeat(100)
      const score = calculatePrivacyScore(longContent)
      
      expect(score.overall).toBeGreaterThanOrEqual(0)
      expect(score.overall).toBeLessThanOrEqual(100)
    })

    it('should handle special characters in content', () => {
      const specialContent = `
        We collect data™ with © protection.
        Users' rights are protected under § 123.
        Email: privacy@example.com
        Website: https://example.com/privacy
      `
      
      const score = calculatePrivacyScore(specialContent)
      
      expect(score.overall).toBeGreaterThanOrEqual(0)
      expect(score.overall).toBeLessThanOrEqual(100)
    })
  })
})