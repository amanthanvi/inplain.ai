import { PolicyAnalysisService } from '@/app/api/lib/ai-service'

export interface TrendAnalysis {
	trend: 'improving' | 'stable' | 'declining'
	confidence: number
	factors: string[]
	prediction: string
	historicalContext: string
}

export interface RiskScore {
	overall: number // 0-100
	categories: {
		dataCollection: number
		dataSharing: number
		userRights: number
		security: number
		thirdParties: number
		transparency: number
	}
	factors: RiskFactor[]
	recommendations: string[]
}

export interface RiskFactor {
	category: string
	description: string
	severity: 'low' | 'medium' | 'high' | 'critical'
	impact: number // 0-10
}

export interface CompanyProfile {
	name: string
	industry: string
	size: 'small' | 'medium' | 'large' | 'enterprise'
	jurisdiction: string[]
	dataTypes: string[]
	userBase: number
}

export interface PolicyInsight {
	type: 'warning' | 'improvement' | 'compliance' | 'trend'
	title: string
	description: string
	actionable: boolean
	priority: 'low' | 'medium' | 'high'
	relatedChanges?: string[]
}

export class AIAnalyticsService extends PolicyAnalysisService {
	async analyzeTrends(
		policyHistory: Array<{
			date: Date
			changes: {
				additions: number
				deletions: number
				riskLevel: string
				categories: string[]
			}
		}>,
		companyProfile?: CompanyProfile
	): Promise<TrendAnalysis> {
		const prompt = `Analyze the following privacy policy change history and provide trend analysis:

Company Profile:
${companyProfile ? JSON.stringify(companyProfile, null, 2) : 'Not provided'}

Policy Change History:
${policyHistory.map(entry => `
Date: ${entry.date.toISOString()}
Changes: +${entry.changes.additions} -${entry.changes.deletions}
Risk Level: ${entry.changes.riskLevel}
Categories: ${entry.changes.categories.join(', ')}
`).join('\n')}

Provide a JSON response with:
{
  "trend": "improving/stable/declining",
  "confidence": 0.0-1.0,
  "factors": ["key factors driving the trend"],
  "prediction": "likely future direction",
  "historicalContext": "comparison to industry standards"
}

Focus on:
1. Overall privacy stance trajectory
2. Frequency and severity of changes
3. Pattern recognition in policy updates
4. Industry-specific considerations`

		const response = await this.generateResponse(prompt, {
			systemPrompt: 'You are a privacy policy trend analyst specializing in longitudinal analysis of privacy practices.',
			maxTokens: 1500,
			temperature: 0.4
		})

		try {
			const parsed = JSON.parse(response.content.replace(/```json\n?|\n?```/g, ''))
			return {
				trend: parsed.trend || 'stable',
				confidence: parsed.confidence || 0.5,
				factors: parsed.factors || [],
				prediction: parsed.prediction || 'Trend analysis unavailable',
				historicalContext: parsed.historicalContext || 'No historical context available'
			}
		} catch (error) {
			console.error('Failed to parse trend analysis:', error)
			return {
				trend: 'stable',
				confidence: 0.3,
				factors: ['Unable to determine trend factors'],
				prediction: 'Trend analysis failed',
				historicalContext: 'Analysis error occurred'
			}
		}
	}

	async calculateRiskScore(
		policyContent: string,
		recentChanges?: Array<{
			category: string
			description: string
			impact: string
		}>
	): Promise<RiskScore> {
		const prompt = `Analyze this privacy policy and calculate a comprehensive risk score:

Policy Content:
${policyContent.substring(0, 10000)} // Truncate for token limits

Recent Changes:
${recentChanges ? JSON.stringify(recentChanges, null, 2) : 'No recent changes'}

Provide a JSON response with:
{
  "overall": 0-100 (higher = more risk),
  "categories": {
    "dataCollection": 0-100,
    "dataSharing": 0-100,
    "userRights": 0-100,
    "security": 0-100,
    "thirdParties": 0-100,
    "transparency": 0-100
  },
  "factors": [
    {
      "category": "category name",
      "description": "specific risk factor",
      "severity": "low/medium/high/critical",
      "impact": 0-10
    }
  ],
  "recommendations": ["actionable recommendations to reduce risk"]
}

Consider:
1. Data collection scope and purpose
2. Third-party sharing practices
3. User control and rights
4. Security measures mentioned
5. Transparency and clarity
6. Compliance with regulations (GDPR, CCPA, etc.)`

		const response = await this.generateResponse(prompt, {
			systemPrompt: 'You are a privacy risk assessment expert specializing in quantitative risk scoring.',
			maxTokens: 2000,
			temperature: 0.3
		})

		try {
			const parsed = JSON.parse(response.content.replace(/```json\n?|\n?```/g, ''))
			return {
				overall: Math.min(100, Math.max(0, parsed.overall || 50)),
				categories: {
					dataCollection: this.normalizeScore(parsed.categories?.dataCollection),
					dataSharing: this.normalizeScore(parsed.categories?.dataSharing),
					userRights: this.normalizeScore(parsed.categories?.userRights),
					security: this.normalizeScore(parsed.categories?.security),
					thirdParties: this.normalizeScore(parsed.categories?.thirdParties),
					transparency: this.normalizeScore(parsed.categories?.transparency)
				},
				factors: this.parseRiskFactors(parsed.factors),
				recommendations: parsed.recommendations || []
			}
		} catch (error) {
			console.error('Failed to parse risk score:', error)
			return this.getDefaultRiskScore()
		}
	}

	async generateInsights(
		currentPolicy: string,
		historicalData: Array<{
			date: Date
			summary: string
			riskLevel: string
		}>,
		industryContext?: {
			industry: string
			competitors: string[]
			regulations: string[]
		}
	): Promise<PolicyInsight[]> {
		const prompt = `Generate actionable insights for this privacy policy:

Current Policy Summary:
${currentPolicy.substring(0, 5000)}

Historical Context:
${historicalData.slice(-5).map(d => `${d.date.toISOString()}: ${d.summary} (Risk: ${d.riskLevel})`).join('\n')}

Industry Context:
${industryContext ? JSON.stringify(industryContext, null, 2) : 'Not provided'}

Provide a JSON array of insights:
[
  {
    "type": "warning/improvement/compliance/trend",
    "title": "brief insight title",
    "description": "detailed explanation",
    "actionable": true/false,
    "priority": "low/medium/high",
    "relatedChanges": ["optional array of related policy sections"]
  }
]

Focus on:
1. Compliance gaps or risks
2. Industry best practices not followed
3. Opportunities for improvement
4. Emerging privacy trends
5. User experience considerations`

		const response = await this.generateResponse(prompt, {
			systemPrompt: 'You are a privacy policy consultant providing strategic insights and recommendations.',
			maxTokens: 2000,
			temperature: 0.5
		})

		try {
			const parsed = JSON.parse(response.content.replace(/```json\n?|\n?```/g, ''))
			return Array.isArray(parsed) ? parsed : []
		} catch (error) {
			console.error('Failed to parse insights:', error)
			return []
		}
	}

	async compareWithIndustry(
		companyPolicy: {
			content: string
			riskScore: RiskScore
			company: string
		},
		industryPolicies: Array<{
			company: string
			riskScore: RiskScore
			summary: string
		}>
	): Promise<{
		ranking: number
		percentile: number
		strengths: string[]
		weaknesses: string[]
		recommendations: string[]
	}> {
		const prompt = `Compare this company's privacy policy with industry peers:

Target Company: ${companyPolicy.company}
Risk Score: ${companyPolicy.riskScore.overall}

Industry Peers:
${industryPolicies.map(p => `${p.company}: Risk Score ${p.riskScore.overall}`).join('\n')}

Provide a JSON response:
{
  "ranking": position among peers (1 = best),
  "percentile": 0-100 (higher = better),
  "strengths": ["areas where company excels"],
  "weaknesses": ["areas needing improvement"],
  "recommendations": ["specific actions to improve"]
}`

		const response = await this.generateResponse(prompt, {
			systemPrompt: 'You are a competitive privacy analysis expert.',
			maxTokens: 1500,
			temperature: 0.4
		})

		try {
			const parsed = JSON.parse(response.content.replace(/```json\n?|\n?```/g, ''))
			return {
				ranking: parsed.ranking || industryPolicies.length + 1,
				percentile: parsed.percentile || 50,
				strengths: parsed.strengths || [],
				weaknesses: parsed.weaknesses || [],
				recommendations: parsed.recommendations || []
			}
		} catch (error) {
			console.error('Failed to parse comparison:', error)
			return {
				ranking: industryPolicies.length + 1,
				percentile: 50,
				strengths: [],
				weaknesses: [],
				recommendations: []
			}
		}
	}

	async predictFutureChanges(
		historicalChanges: Array<{
			date: Date
			categories: string[]
			description: string
		}>,
		externalFactors?: {
			upcomingRegulations: string[]
			industryTrends: string[]
			companyEvents: string[]
		}
	): Promise<{
		predictions: Array<{
			timeframe: string
			likelihood: number
			category: string
			description: string
			impact: 'low' | 'medium' | 'high'
		}>
		confidence: number
		factors: string[]
	}> {
		const prompt = `Predict future privacy policy changes based on historical patterns:

Historical Changes:
${historicalChanges.slice(-10).map(c => 
	`${c.date.toISOString()}: ${c.categories.join(', ')} - ${c.description}`
).join('\n')}

External Factors:
${externalFactors ? JSON.stringify(externalFactors, null, 2) : 'None provided'}

Provide predictions as JSON:
{
  "predictions": [
    {
      "timeframe": "e.g., next 3 months",
      "likelihood": 0.0-1.0,
      "category": "affected area",
      "description": "predicted change",
      "impact": "low/medium/high"
    }
  ],
  "confidence": 0.0-1.0,
  "factors": ["key factors influencing predictions"]
}`

		const response = await this.generateResponse(prompt, {
			systemPrompt: 'You are a predictive analytics expert specializing in privacy policy evolution.',
			maxTokens: 1500,
			temperature: 0.6
		})

		try {
			const parsed = JSON.parse(response.content.replace(/```json\n?|\n?```/g, ''))
			return {
				predictions: parsed.predictions || [],
				confidence: parsed.confidence || 0.5,
				factors: parsed.factors || []
			}
		} catch (error) {
			console.error('Failed to parse predictions:', error)
			return {
				predictions: [],
				confidence: 0.3,
				factors: ['Unable to generate predictions']
			}
		}
	}

	private normalizeScore(score: any): number {
		const num = parseFloat(score)
		if (isNaN(num)) return 50
		return Math.min(100, Math.max(0, num))
	}

	private parseRiskFactors(factors: any): RiskFactor[] {
		if (!Array.isArray(factors)) return []
		
		return factors.map(f => ({
			category: f.category || 'general',
			description: f.description || 'Risk factor',
			severity: this.parseSeverity(f.severity),
			impact: Math.min(10, Math.max(0, f.impact || 5))
		}))
	}

	private parseSeverity(severity: any): 'low' | 'medium' | 'high' | 'critical' {
		const s = String(severity).toLowerCase()
		if (s.includes('critical')) return 'critical'
		if (s.includes('high')) return 'high'
		if (s.includes('medium')) return 'medium'
		return 'low'
	}

	private getDefaultRiskScore(): RiskScore {
		return {
			overall: 50,
			categories: {
				dataCollection: 50,
				dataSharing: 50,
				userRights: 50,
				security: 50,
				thirdParties: 50,
				transparency: 50
			},
			factors: [],
			recommendations: ['Unable to generate risk analysis']
		}
	}
}