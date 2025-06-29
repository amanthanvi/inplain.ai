import { aiCache } from '@/lib/cache/ai-cache'
import { logger } from '@/lib/monitoring'
import { getAIService } from './enhanced-ai-service'
import { circuitBreakers } from '@/lib/resilience/circuit-breaker'

export interface PolicySummary {
  executive: string
  keyPoints: string[]
  dataCollection: {
    types: string[]
    purposes: string[]
    retention: string
  }
  userRights: string[]
  risks: {
    level: 'low' | 'medium' | 'high'
    factors: string[]
  }
  recommendations: string[]
  readingTime: number
  complexity: 'simple' | 'moderate' | 'complex'
}

export class PolicySummarizer {
  private aiService: ReturnType<typeof getAIService>

  constructor() {
    this.aiService = getAIService()
  }

  async summarizePolicy(
    policyText: string,
    options: {
      companyName?: string
      industry?: string
      targetAudience?: 'general' | 'technical' | 'legal'
      language?: string
    } = {}
  ): Promise<PolicySummary> {
    const cacheKey = `summary:${this.generateCacheKey(policyText, options)}`
    
    // Check cache first
    const cached = await aiCache.getResponse('policy-summary', cacheKey)
    if (cached) {
      logger.info('Policy summary cache hit')
      return JSON.parse(cached)
    }

    try {
      const summary = await circuitBreakers.openrouter.execute(
        () => this.generateSummary(policyText, options),
        async () => {
          // Fallback: Generate basic summary locally
          return this.generateBasicSummary(policyText)
        }
      )

      // Cache the result
      await aiCache.setResponse(
        'policy-summary',
        cacheKey,
        JSON.stringify(summary),
        { model: 'summarizer' }
      )

      return summary
    } catch (error) {
      logger.error('Policy summarization failed', { error })
      // Return basic summary as last resort
      return this.generateBasicSummary(policyText)
    }
  }

  private async generateSummary(
    policyText: string,
    options: any
  ): Promise<PolicySummary> {
    const prompt = this.buildSummaryPrompt(policyText, options)
    
    const response = await this.aiService.complete({
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing and summarizing privacy policies. 
          Create clear, accurate summaries that highlight the most important information for users.
          Focus on data collection, user rights, and potential risks.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'gpt-4',
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })

    return this.parseAIResponse(response.content)
  }

  private buildSummaryPrompt(policyText: string, options: any): string {
    const audience = options.targetAudience || 'general'
    const audienceInstructions: Record<string, string> = {
      general: 'Use simple, everyday language that anyone can understand.',
      technical: 'Include technical details about data handling and security measures.',
      legal: 'Maintain legal precision while highlighting compliance aspects.'
    }

    return `Analyze this privacy policy and create a comprehensive summary.

Privacy Policy:
${policyText.substring(0, 10000)} // Limit to prevent token overflow

Create a JSON response with this structure:
{
  "executive": "2-3 sentence executive summary",
  "keyPoints": ["Array of 5-7 most important points"],
  "dataCollection": {
    "types": ["Types of data collected"],
    "purposes": ["Why data is collected"],
    "retention": "How long data is kept"
  },
  "userRights": ["List of user rights mentioned"],
  "risks": {
    "level": "low/medium/high",
    "factors": ["Risk factors identified"]
  },
  "recommendations": ["3-5 actionable recommendations for users"],
  "readingTime": estimated minutes to read full policy,
  "complexity": "simple/moderate/complex"
}

Target Audience: ${audience}
Instructions: ${audienceInstructions[audience] || audienceInstructions.general}
${options.companyName ? `Company: ${options.companyName}` : ''}
${options.industry ? `Industry: ${options.industry}` : ''}`
  }

  private parseAIResponse(content: string): PolicySummary {
    try {
      const parsed = JSON.parse(content)
      return {
        executive: parsed.executive || 'Summary not available',
        keyPoints: parsed.keyPoints || [],
        dataCollection: {
          types: parsed.dataCollection?.types || [],
          purposes: parsed.dataCollection?.purposes || [],
          retention: parsed.dataCollection?.retention || 'Not specified'
        },
        userRights: parsed.userRights || [],
        risks: {
          level: parsed.risks?.level || 'medium',
          factors: parsed.risks?.factors || []
        },
        recommendations: parsed.recommendations || [],
        readingTime: parsed.readingTime || this.estimateReadingTime(content),
        complexity: parsed.complexity || 'moderate'
      }
    } catch (error) {
      logger.error('Failed to parse AI response', { error })
      throw new Error('Invalid AI response format')
    }
  }

  private generateBasicSummary(policyText: string): PolicySummary {
    // Basic text analysis for fallback
    const words = policyText.split(/\s+/).length
    const sentences = policyText.split(/[.!?]+/).length
    const readingTime = Math.ceil(words / 200) // Average reading speed

    // Look for common patterns
    const dataTypes = this.extractDataTypes(policyText)
    const rights = this.extractUserRights(policyText)
    const risks = this.assessRisks(policyText)

    return {
      executive: 'This privacy policy outlines how your data is collected and used. Please review the full policy for complete details.',
      keyPoints: [
        'Personal information is collected',
        'Data may be shared with third parties',
        'Users have rights to access and delete their data',
        'Cookies and tracking technologies are used',
        'Contact information provided for privacy inquiries'
      ],
      dataCollection: {
        types: dataTypes,
        purposes: ['Service provision', 'Analytics', 'Marketing'],
        retention: 'Varies by data type'
      },
      userRights: rights,
      risks: risks,
      recommendations: [
        'Review what data is collected about you',
        'Check your privacy settings regularly',
        'Contact the company if you have concerns'
      ],
      readingTime,
      complexity: sentences > 100 ? 'complex' : words > 2000 ? 'moderate' : 'simple'
    }
  }

  private extractDataTypes(text: string): string[] {
    const types: string[] = []
    const patterns = {
      'Personal information': /personal\s+information|name|email|address|phone/gi,
      'Usage data': /usage\s+data|analytics|behavior|activity/gi,
      'Device information': /device|browser|IP\s+address|operating\s+system/gi,
      'Location data': /location|GPS|geo/gi,
      'Financial data': /payment|credit\s+card|billing|financial/gi,
      'Health data': /health|medical|fitness/gi
    }

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        types.push(type)
      }
    }

    return types.length > 0 ? types : ['General personal information']
  }

  private extractUserRights(text: string): string[] {
    const rights: string[] = []
    const patterns = {
      'Access your data': /access.*data|view.*information/gi,
      'Delete your data': /delete.*data|erasure|removal/gi,
      'Correct your data': /correct|update|modify.*data/gi,
      'Data portability': /portability|export.*data|download.*data/gi,
      'Opt-out': /opt.?out|unsubscribe|refuse/gi,
      'Withdraw consent': /withdraw.*consent|revoke/gi
    }

    for (const [right, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        rights.push(right)
      }
    }

    return rights.length > 0 ? rights : ['Contact for information about your rights']
  }

  private assessRisks(text: string): { level: 'low' | 'medium' | 'high'; factors: string[] } {
    const factors: string[] = []
    let riskScore = 0

    // High risk indicators
    if (/sell.*data|share.*third.*parties.*marketing/gi.test(text)) {
      factors.push('Data may be sold or shared for marketing')
      riskScore += 3
    }
    if (/no.*warrant|not.*responsible|liability/gi.test(text)) {
      factors.push('Limited liability for data breaches')
      riskScore += 2
    }
    if (/indefinitely|permanent/gi.test(text)) {
      factors.push('Data may be retained indefinitely')
      riskScore += 2
    }

    // Medium risk indicators
    if (/third.*party|partner|affiliate/gi.test(text)) {
      factors.push('Data shared with third parties')
      riskScore += 1
    }
    if (/cookie|tracking|analytics/gi.test(text)) {
      factors.push('Uses tracking technologies')
      riskScore += 1
    }

    // Positive indicators (reduce risk)
    if (/encrypt|secure|protection/gi.test(text)) {
      factors.push('Security measures mentioned')
      riskScore -= 1
    }
    if (/GDPR|CCPA|compliance/gi.test(text)) {
      factors.push('Regulatory compliance mentioned')
      riskScore -= 1
    }

    const level = riskScore >= 4 ? 'high' : riskScore >= 2 ? 'medium' : 'low'
    return { level, factors }
  }

  private generateCacheKey(text: string, options: any): string {
    const data = text + JSON.stringify(options)
    // Use simple hash for edge runtime compatibility
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  private estimateReadingTime(text: string): number {
    const words = text.split(/\s+/).length
    return Math.ceil(words / 200) // Average reading speed of 200 words per minute
  }
}

// Export singleton instance
export const policySummarizer = new PolicySummarizer()