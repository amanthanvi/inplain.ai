import { OpenAI } from 'openai'

// Model configurations with capabilities and cost optimization
export const AI_MODELS = {
  // Fast, cost-effective models for simple tasks
  fast: {
    primary: 'anthropic/claude-3-haiku',
    fallback: 'openai/gpt-3.5-turbo',
    maxTokens: 1000,
    temperature: 0.3,
    capabilities: ['summarization', 'classification', 'extraction']
  },
  // Balanced models for general analysis
  balanced: {
    primary: 'anthropic/claude-3-sonnet',
    fallback: 'openai/gpt-4-turbo',
    maxTokens: 2000,
    temperature: 0.5,
    capabilities: ['analysis', 'comparison', 'insights', 'reasoning']
  },
  // Advanced models for complex analysis
  advanced: {
    primary: 'anthropic/claude-3-opus',
    fallback: 'openai/gpt-4o',
    maxTokens: 4000,
    temperature: 0.7,
    capabilities: ['deep-analysis', 'prediction', 'strategy', 'nuanced-reasoning']
  },
  // Specialized models
  vision: {
    primary: 'openai/gpt-4-vision-preview',
    fallback: 'anthropic/claude-3-opus',
    maxTokens: 3000,
    temperature: 0.5,
    capabilities: ['image-analysis', 'document-extraction', 'visual-comparison']
  },
  code: {
    primary: 'anthropic/claude-3-opus',
    fallback: 'openai/gpt-4-turbo',
    maxTokens: 3000,
    temperature: 0.2,
    capabilities: ['code-generation', 'security-analysis', 'technical-documentation']
  }
}

// Enhanced system prompts with role-based expertise
export const SYSTEM_PROMPTS = {
  privacyExpert: `You are an expert privacy attorney and data protection specialist with deep knowledge of:
- GDPR, CCPA, PIPEDA, and other global privacy regulations
- Privacy by Design principles and implementation
- Data minimization and purpose limitation concepts
- User consent mechanisms and lawful bases for processing
- Cross-border data transfer regulations
- Privacy impact assessments and risk analysis

Your analysis should be precise, actionable, and user-focused. Always prioritize user privacy rights and provide clear recommendations.`,

  legalAnalyst: `You are a senior legal analyst specializing in technology law and privacy regulations. Your expertise includes:
- Identifying legal risks and compliance gaps
- Understanding jurisdictional differences in privacy law
- Analyzing terms of service and privacy policies
- Evaluating data subject rights implementation
- Assessing liability and enforcement risks

Provide balanced, objective analysis with practical recommendations for both users and companies.`,

  securityAdvisor: `You are a cybersecurity expert focusing on privacy and data protection. Your knowledge covers:
- Data encryption standards and implementation
- Security breach implications and notifications
- Technical safeguards and access controls
- Privacy-enhancing technologies (PETs)
- Zero-knowledge architectures and E2EE
- Threat modeling for personal data

Evaluate security measures critically and suggest improvements that enhance user privacy.`,

  userAdvocate: `You are a consumer rights advocate specializing in digital privacy. Your focus areas include:
- Simplifying complex legal language for users
- Identifying dark patterns and manipulative practices
- Recommending privacy-preserving alternatives
- Educating users about their rights
- Creating actionable privacy guides
- Highlighting potential harms and benefits

Always prioritize user empowerment and provide clear, actionable advice.`,

  dataScientist: `You are a data scientist with expertise in privacy-preserving analytics. Your skills include:
- Differential privacy techniques
- Data anonymization and pseudonymization
- Statistical disclosure control
- Privacy-preserving machine learning
- Synthetic data generation
- Re-identification risk assessment

Analyze data practices critically and suggest privacy-preserving alternatives.`,

  complianceOfficer: `You are a Chief Privacy Officer with comprehensive compliance expertise:
- Privacy program maturity assessment
- Policy gap analysis and remediation
- Vendor and third-party risk management
- Privacy training and awareness programs
- Incident response and breach management
- Regulatory reporting and documentation

Provide strategic recommendations for privacy program improvements.`
}

// Task-specific prompt templates
export const ANALYSIS_PROMPTS = {
  comprehensive: {
    prompt: `Analyze this privacy policy comprehensively. Structure your analysis as follows:

1. EXECUTIVE SUMMARY
   - Key findings (3-5 bullet points)
   - Overall privacy score (0-100) with justification
   - Primary concerns and recommendations

2. DATA COLLECTION ANALYSIS
   - Types of data collected (categorized)
   - Collection methods and transparency
   - Necessity and proportionality assessment
   - Sensitive data handling

3. DATA USAGE EVALUATION
   - Stated purposes vs actual practices
   - Secondary use concerns
   - Data sharing with third parties
   - Cross-border transfers

4. USER RIGHTS ASSESSMENT
   - Access and portability rights
   - Deletion and correction mechanisms
   - Consent management
   - Opt-out effectiveness

5. SECURITY MEASURES
   - Technical safeguards mentioned
   - Organizational measures
   - Breach notification procedures
   - Data retention policies

6. COMPLIANCE ANALYSIS
   - GDPR compliance level
   - CCPA compliance level
   - Other applicable regulations
   - Gap analysis

7. RISK ASSESSMENT
   - Privacy risks (High/Medium/Low)
   - Data breach impact
   - Third-party risks
   - Mitigation recommendations

8. USER RECOMMENDATIONS
   - Privacy settings to adjust
   - Data to avoid sharing
   - Alternative services
   - Monitoring actions

Provide specific examples and quotes from the policy to support your analysis.`,
    model: 'advanced',
    options: {
      temperature: 0.6,
      maxTokens: 4000
    }
  },

  comparison: {
    prompt: `Compare these privacy policies across multiple dimensions:

1. DATA COLLECTION SCOPE
   - Breadth of data collected
   - Sensitivity levels
   - Collection transparency
   - User control mechanisms

2. PURPOSE LIMITATION
   - Clarity of purposes
   - Purpose creep indicators
   - Secondary use policies
   - Marketing use

3. THIRD-PARTY SHARING
   - Types of third parties
   - Data shared per category
   - User consent requirements
   - Accountability measures

4. USER RIGHTS IMPLEMENTATION
   - Ease of exercising rights
   - Response timeframes
   - Verification procedures
   - Automated vs manual processes

5. PRIVACY INNOVATION
   - Privacy-enhancing features
   - Above-compliance measures
   - User empowerment tools
   - Transparency innovations

6. RISK COMPARISON MATRIX
   Create a comparative risk matrix showing:
   - Data types × Risk levels
   - Mitigation measures
   - User control options

7. RECOMMENDATIONS
   - Which service is more privacy-friendly
   - Specific advantages of each
   - Suggested privacy settings
   - Decision framework for users

Use a structured comparison table where applicable.`,
    model: 'advanced',
    options: {
      temperature: 0.5,
      maxTokens: 3500
    }
  },

  riskFocused: {
    prompt: `Conduct a privacy risk assessment focusing on:

1. THREAT MODELING
   - Identify threat actors
   - Attack vectors on user privacy
   - Likelihood assessment
   - Impact severity

2. DATA EXPOSURE RISKS
   - Internal exposure risks
   - Third-party sharing risks
   - Breach impact analysis
   - Long-term retention risks

3. BEHAVIORAL TRACKING
   - Tracking technologies used
   - Cross-site/app tracking
   - Profiling capabilities
   - Inference risks

4. VULNERABLE POPULATIONS
   - Children's privacy risks
   - Sensitive data categories
   - Discrimination potential
   - Power imbalances

5. TECHNICAL VULNERABILITIES
   - Weak security measures
   - Unclear encryption practices
   - Access control gaps
   - Audit trail deficiencies

6. LEGAL/REGULATORY RISKS
   - Non-compliance areas
   - Enforcement probability
   - Penalty exposure
   - Reputation risks

7. MITIGATION STRATEGIES
   - User-level mitigations
   - Technical countermeasures
   - Legal protections
   - Alternative approaches

Provide a risk score (Critical/High/Medium/Low) for each category with evidence.`,
    model: 'balanced',
    options: {
      temperature: 0.4,
      maxTokens: 3000
    }
  },

  userFriendly: {
    prompt: `Create a user-friendly summary of this privacy policy:

1. THE BASICS (in plain English)
   - What data they collect about you
   - Why they want this data
   - Who else sees your data
   - How long they keep it

2. RED FLAGS 🚩
   - Concerning practices
   - Hidden surprises
   - Opt-out difficulties
   - Vague language

3. GREEN FLAGS ✅
   - Good privacy practices
   - User-friendly features
   - Strong protections
   - Clear commitments

4. YOUR PRIVACY CONTROLS
   - Settings you should change
   - Rights you can exercise
   - How to limit data collection
   - How to delete your data

5. THE FINE PRINT
   - Important details often missed
   - Automatic renewals
   - Default settings
   - Future changes

6. SHOULD YOU USE THIS SERVICE?
   - Privacy-conscious users: Yes/No/Maybe
   - Specific concerns for different users
   - Safer alternatives
   - Compromise suggestions

Use analogies, examples, and clear language. Avoid legal jargon.`,
    model: 'balanced',
    options: {
      temperature: 0.7,
      maxTokens: 2000
    }
  },

  changeAnalysis: {
    prompt: `Analyze these privacy policy changes:

1. CHANGE OVERVIEW
   - Number of changes identified
   - Change categories
   - Overall impact assessment
   - User notification analysis

2. DETAILED CHANGE ANALYSIS
   For each significant change:
   - What changed (before → after)
   - Why it likely changed
   - Impact on user privacy
   - Required user actions

3. PRIVACY IMPACT SCORING
   - Data collection changes: [+/-] impact
   - User rights changes: [+/-] impact
   - Third-party sharing: [+/-] impact
   - Security measures: [+/-] impact

4. HIDDEN CHANGES
   - Subtle wording changes
   - Removed protections
   - Expanded definitions
   - Scope creep indicators

5. LEGAL IMPLICATIONS
   - Compliance improvements/degradation
   - New legal risks
   - Jurisdiction changes
   - Enforcement considerations

6. USER ACTION PLAN
   - Immediate actions required
   - Settings to review
   - Opt-out deadlines
   - Data download recommendations

7. TREND ANALYSIS
   - Direction of privacy practices
   - Industry comparison
   - Future implications
   - Strategic recommendations

Highlight the most critical changes that require user attention.`,
    model: 'advanced',
    options: {
      temperature: 0.5,
      maxTokens: 3500
    }
  },

  technicalAudit: {
    prompt: `Perform a technical privacy audit:

1. DATA ARCHITECTURE ANALYSIS
   - Data flow mapping
   - Storage locations
   - Processing activities
   - Retention mechanisms

2. SECURITY IMPLEMENTATION
   - Encryption standards
   - Access controls
   - Audit logging
   - Incident response

3. PRIVACY ENGINEERING
   - Privacy by Design implementation
   - Data minimization practices
   - Purpose limitation controls
   - Consent management systems

4. THIRD-PARTY INTEGRATIONS
   - SDK/API analysis
   - Data sharing mechanisms
   - Partner security requirements
   - Processor agreements

5. COMPLIANCE AUTOMATION
   - Rights fulfillment systems
   - Consent workflows
   - Data portability formats
   - Deletion mechanisms

6. MONITORING & ANALYTICS
   - Privacy metrics tracked
   - Breach detection capabilities
   - Compliance monitoring
   - User activity tracking

7. RECOMMENDATIONS
   - Technical improvements
   - Process enhancements
   - Tool suggestions
   - Best practice alignment

Include specific technical requirements and implementation guidance.`,
    model: 'advanced',
    options: {
      temperature: 0.3,
      maxTokens: 3500
    }
  }
}

// Enhanced insight generation functions
export interface InsightConfig {
  depth: 'surface' | 'standard' | 'deep'
  focus: string[]
  comparisons?: boolean
  predictions?: boolean
  recommendations?: boolean
}

export interface EnhancedInsight {
  id: string
  type: 'risk' | 'opportunity' | 'trend' | 'comparison' | 'prediction' | 'recommendation'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  summary: string
  details: {
    evidence: string[]
    implications: string[]
    actions: string[]
    metrics?: Record<string, number>
    timeline?: string
  }
  visualData?: {
    type: 'chart' | 'graph' | 'matrix' | 'timeline'
    data: any
  }
  relatedInsights?: string[]
  confidence: number
  sources: string[]
}

export class EnhancedAIService {
  private openai: OpenAI
  private cache: Map<string, any> = new Map()
  private modelUsage: Map<string, number> = new Map()

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://inplain.ai',
        'X-Title': 'Inplain.AI - Privacy Analysis Platform'
      }
    })
  }

  // Intelligent model selection based on task complexity
  private selectModel(task: string, complexity: 'low' | 'medium' | 'high'): typeof AI_MODELS.fast {
    const taskModelMap: Record<string, keyof typeof AI_MODELS> = {
      summarization: 'fast',
      classification: 'fast',
      extraction: 'fast',
      analysis: 'balanced',
      comparison: 'balanced',
      insights: 'balanced',
      'deep-analysis': 'advanced',
      prediction: 'advanced',
      strategy: 'advanced',
      'image-analysis': 'vision',
      'code-generation': 'code'
    }

    const baseModel = taskModelMap[task] || 'balanced'
    
    // Adjust based on complexity
    if (complexity === 'high' && baseModel === 'fast') {
      return AI_MODELS.balanced
    } else if (complexity === 'low' && baseModel === 'advanced') {
      return AI_MODELS.balanced
    }

    return AI_MODELS[baseModel as keyof typeof AI_MODELS]
  }

  // Enhanced analysis with multiple perspectives
  async analyzePrivacyPolicy(
    policyText: string,
    options: {
      analysisType: keyof typeof ANALYSIS_PROMPTS
      perspectives?: Array<keyof typeof SYSTEM_PROMPTS>
      insightConfig?: InsightConfig
      metadata?: {
        company: string
        industry: string
        previousVersions?: string[]
      }
    }
  ): Promise<{
    analysis: any
    insights: EnhancedInsight[]
    metadata: {
      model: string
      tokensUsed: number
      processingTime: number
      confidence: number
    }
  }> {
    const startTime = Date.now()
    const analysisPrompt = ANALYSIS_PROMPTS[options.analysisType]
    const model = AI_MODELS[analysisPrompt.model as keyof typeof AI_MODELS]

    // Select perspectives (default to most relevant)
    const perspectives = options.perspectives || ['privacyExpert', 'userAdvocate']
    
    try {
      // Generate analysis from multiple perspectives
      const perspectiveAnalyses = await Promise.all(
        perspectives.map(async (perspective) => {
          const response = await this.openai.chat.completions.create({
            model: model.primary,
            messages: [
              {
                role: 'system',
                content: SYSTEM_PROMPTS[perspective]
              },
              {
                role: 'user',
                content: `${analysisPrompt.prompt}\n\nPrivacy Policy:\n${policyText}`
              }
            ],
            temperature: analysisPrompt.options.temperature,
            max_tokens: analysisPrompt.options.maxTokens,
            top_p: 0.9,
            frequency_penalty: 0.1,
            presence_penalty: 0.1
          })

          return {
            perspective,
            content: response.choices[0]?.message?.content || '',
            usage: response.usage
          }
        })
      )

      // Synthesize perspectives into comprehensive analysis
      const synthesisResponse = await this.openai.chat.completions.create({
        model: model.primary,
        messages: [
          {
            role: 'system',
            content: `You are a master synthesizer combining multiple expert perspectives on privacy analysis. Create a comprehensive, balanced analysis that incorporates all viewpoints while highlighting areas of agreement and disagreement.`
          },
          {
            role: 'user',
            content: `Synthesize these expert analyses into a comprehensive report:\n\n${perspectiveAnalyses.map(p => `${p.perspective.toUpperCase()} PERSPECTIVE:\n${p.content}\n\n`).join('')}`
          }
        ],
        temperature: 0.5,
        max_tokens: 4000
      })

      // Generate enhanced insights
      const insights = await this.generateEnhancedInsights(
        policyText,
        synthesisResponse.choices[0]?.message?.content || '',
        options.insightConfig || { depth: 'standard', focus: ['risks', 'opportunities'] }
      )

      // Calculate total tokens used
      const tokensUsed = perspectiveAnalyses.reduce((sum, p) => sum + (p.usage?.total_tokens || 0), 0) + (synthesisResponse.usage?.total_tokens || 0)

      // Track model usage for optimization
      this.modelUsage.set(model.primary, (this.modelUsage.get(model.primary) || 0) + tokensUsed)

      return {
        analysis: JSON.parse(synthesisResponse.choices[0]?.message?.content || '{}'),
        insights,
        metadata: {
          model: model.primary,
          tokensUsed,
          processingTime: Date.now() - startTime,
          confidence: this.calculateConfidence(perspectiveAnalyses, insights)
        }
      }
    } catch (error) {
      console.error('Primary model failed, trying fallback:', error)
      
      // Fallback to secondary model
      const fallbackResponse = await this.openai.chat.completions.create({
        model: model.fallback,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPTS.privacyExpert
          },
          {
            role: 'user',
            content: `${analysisPrompt.prompt}\n\nPrivacy Policy:\n${policyText}`
          }
        ],
        temperature: analysisPrompt.options.temperature,
        max_tokens: analysisPrompt.options.maxTokens
      })

      const insights = await this.generateEnhancedInsights(
        policyText,
        fallbackResponse.choices[0]?.message?.content || '',
        options.insightConfig || { depth: 'standard', focus: ['risks'] }
      )

      return {
        analysis: JSON.parse(fallbackResponse.choices[0]?.message?.content || '{}'),
        insights,
        metadata: {
          model: model.fallback,
          tokensUsed: fallbackResponse.usage?.total_tokens || 0,
          processingTime: Date.now() - startTime,
          confidence: 0.7 // Lower confidence for fallback
        }
      }
    }
  }

  // Generate enhanced insights with multiple data points
  private async generateEnhancedInsights(
    policyText: string,
    analysis: string,
    config: InsightConfig
  ): Promise<EnhancedInsight[]> {
    const model = this.selectModel('insights', config.depth === 'deep' ? 'high' : 'medium')

    const insightPrompt = `Based on this privacy policy analysis, generate detailed insights focusing on ${config.focus.join(', ')}.

Analysis:
${analysis}

Generate insights in the following JSON format:
{
  "insights": [
    {
      "id": "unique-id",
      "type": "risk|opportunity|trend|comparison|prediction|recommendation",
      "severity": "critical|high|medium|low|info",
      "title": "Clear, actionable title",
      "summary": "2-3 sentence summary",
      "details": {
        "evidence": ["Specific quotes or data points"],
        "implications": ["What this means for users"],
        "actions": ["What users should do"],
        "metrics": { "relevantMetric": value },
        "timeline": "When this matters"
      },
      "confidence": 0.0-1.0,
      "sources": ["Section references"]
    }
  ]
}

Requirements:
- Generate ${config.depth === 'deep' ? '10-15' : config.depth === 'standard' ? '5-10' : '3-5'} insights
- Focus on actionable, specific findings
- Include quantitative metrics where possible
- Prioritize user impact and privacy rights
- Consider regulatory compliance implications
${config.predictions ? '- Include forward-looking predictions based on trends' : ''}
${config.recommendations ? '- Provide specific, implementable recommendations' : ''}
${config.comparisons ? '- Compare against industry best practices' : ''}`

    const response = await this.openai.chat.completions.create({
      model: model.primary,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPTS.dataScientist
        },
        {
          role: 'user',
          content: insightPrompt
        }
      ],
      temperature: 0.6,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{"insights": []}')
    
    // Enhance insights with visual data where applicable
    return result.insights.map((insight: EnhancedInsight) => ({
      ...insight,
      id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      visualData: this.generateVisualData(insight),
      relatedInsights: this.findRelatedInsights(insight, result.insights)
    }))
  }

  // Generate visual data for insights
  private generateVisualData(insight: EnhancedInsight): any {
    if (insight.details.metrics && Object.keys(insight.details.metrics).length > 0) {
      const metricKeys = Object.keys(insight.details.metrics)
      
      if (metricKeys.length === 1 && metricKeys[0]) {
        // Single metric - use gauge
        return {
          type: 'chart',
          data: {
            type: 'gauge',
            value: insight.details.metrics[metricKeys[0]],
            max: 100,
            thresholds: [
              { value: 30, color: 'green' },
              { value: 70, color: 'yellow' },
              { value: 90, color: 'red' }
            ]
          }
        }
      } else {
        // Multiple metrics - use radar chart
        return {
          type: 'chart',
          data: {
            type: 'radar',
            labels: metricKeys,
            datasets: [{
              label: insight.title,
              data: metricKeys.map(k => insight.details.metrics![k])
            }]
          }
        }
      }
    }

    if (insight.type === 'trend' && insight.details.timeline) {
      return {
        type: 'timeline',
        data: {
          events: insight.details.evidence.map((e, i) => ({
            date: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000),
            title: e.substring(0, 50),
            description: e
          }))
        }
      }
    }

    return null
  }

  // Find related insights for context
  private findRelatedInsights(insight: EnhancedInsight, allInsights: EnhancedInsight[]): string[] {
    return allInsights
      .filter(i => i.id !== insight.id)
      .filter(i => {
        // Same type or complementary types
        const relatedTypes: Record<string, string[]> = {
          risk: ['recommendation', 'prediction'],
          opportunity: ['recommendation', 'trend'],
          trend: ['prediction', 'opportunity'],
          prediction: ['risk', 'recommendation'],
          recommendation: ['risk', 'opportunity'],
          comparison: ['trend', 'opportunity']
        }
        
        return i.type === insight.type || relatedTypes[insight.type]?.includes(i.type)
      })
      .slice(0, 3)
      .map(i => i.id)
  }

  // Calculate confidence score based on analysis consistency
  private calculateConfidence(analyses: any[], insights: EnhancedInsight[]): number {
    // Base confidence on model consensus
    const perspectiveCount = analyses.length
    const avgInsightConfidence = insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length
    
    // Adjust based on perspective agreement (would need NLP to properly compare)
    const consensusBonus = perspectiveCount > 1 ? 0.1 : 0
    
    return Math.min(0.95, avgInsightConfidence + consensusBonus)
  }

  // Streaming analysis for real-time updates
  async *streamAnalysis(
    policyText: string,
    options: {
      analysisType: keyof typeof ANALYSIS_PROMPTS
      onProgress?: (progress: number) => void
    }
  ): AsyncGenerator<{ chunk: string; progress: number }> {
    const analysisPrompt = ANALYSIS_PROMPTS[options.analysisType]
    const model = AI_MODELS[analysisPrompt.model as keyof typeof AI_MODELS]

    const stream = await this.openai.chat.completions.create({
      model: model.primary,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPTS.privacyExpert
        },
        {
          role: 'user',
          content: `${analysisPrompt.prompt}\n\nPrivacy Policy:\n${policyText}`
        }
      ],
      temperature: analysisPrompt.options.temperature,
      max_tokens: analysisPrompt.options.maxTokens,
      stream: true
    })

    let totalChars = 0
    const estimatedTotal = analysisPrompt.options.maxTokens * 4 // Rough estimate

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      totalChars += content.length
      const progress = Math.min(0.95, totalChars / estimatedTotal)
      
      if (options.onProgress) {
        options.onProgress(progress)
      }

      yield { chunk: content, progress }
    }

    yield { chunk: '', progress: 1 }
  }

  // Get model recommendations based on usage patterns
  getModelRecommendations(): {
    costOptimization: Record<string, number>
    performanceMetrics: Record<string, { avgLatency: number; successRate: number }>
    recommendations: string[]
  } {
    const usage = Object.fromEntries(this.modelUsage)
    
    // Calculate costs (example rates)
    const costs = Object.entries(usage).reduce((acc, [model, tokens]) => {
      const rate = model.includes('haiku') ? 0.00025 : 
                   model.includes('sonnet') ? 0.003 :
                   model.includes('opus') ? 0.015 : 0.002
      acc[model] = (tokens / 1000) * rate
      return acc
    }, {} as Record<string, number>)

    return {
      costOptimization: costs,
      performanceMetrics: {
        // This would be tracked in production
        [AI_MODELS.fast.primary]: { avgLatency: 800, successRate: 0.98 },
        [AI_MODELS.balanced.primary]: { avgLatency: 1200, successRate: 0.97 },
        [AI_MODELS.advanced.primary]: { avgLatency: 2000, successRate: 0.99 }
      },
      recommendations: [
        'Consider using fast models for initial classification',
        'Reserve advanced models for user-requested deep analysis',
        'Implement caching for frequently analyzed policies'
      ]
    }
  }
}

// Export singleton instance
let aiServiceInstance: EnhancedAIService | null = null

export function getAIService(): EnhancedAIService {
  if (!aiServiceInstance) {
    const apiKey = process.env.OPENROUTER_API_KEY || ''
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured')
    }
    aiServiceInstance = new EnhancedAIService(apiKey)
  }
  return aiServiceInstance
}