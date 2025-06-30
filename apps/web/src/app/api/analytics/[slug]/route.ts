import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@/app/api/lib/kv-wrapper'
import { AIAnalyticsService } from '@/lib/ai-analytics'
import type { DiffMeta, Summary } from '@inplain.ai/shared'

export const runtime = 'edge'

interface EnhancedDiff extends DiffMeta {
	summary?: Summary
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ slug: string }> }
) {
	try {
		const { slug } = await params
		const { searchParams } = new URL(request.url)
		const analysisType = searchParams.get('type') || 'full'
		const useCache = searchParams.get('cache') !== 'false'

		// Check cache first
		const cacheKey = `analytics:${slug}:${analysisType}`
		if (useCache) {
			const cached = await kv.get(cacheKey)
			if (cached) {
				return NextResponse.json(cached)
			}
		}

		// Initialize AI service or use demo mode
		const apiKey = process.env.OPENROUTER_API_KEY
		const isDemoMode = !apiKey
		
		if (isDemoMode) {
			// Return demo analytics data
			const demoData = {
				riskScore: {
					overall: 72,
					breakdown: {
						dataCollection: 65,
						dataSharing: 78,
						userRights: 82,
						security: 70,
						transparency: 75
					},
					trends: {
						direction: 'improving' as const,
						change: 5,
						period: '30 days'
					}
				},
				trendAnalysis: {
					summary: 'Privacy practices have improved over the last 6 months',
					keyChanges: [
						'Enhanced user control options',
						'Clearer data retention policies',
						'Better third-party disclosure'
					],
					riskTrajectory: 'decreasing' as const,
					predictedChanges: [
						'Likely to add AI data usage policies',
						'May enhance children\'s privacy protections'
					]
				},
				insights: [
					{
						type: 'positive' as const,
						priority: 'medium' as const,
						title: 'Strong User Rights',
						description: 'Policy provides comprehensive user rights including access, deletion, and portability',
						actionable: false
					},
					{
						type: 'concern' as const,
						priority: 'high' as const,
						title: 'Broad Data Collection',
						description: 'Policy allows collection of extensive user data including behavioral patterns',
						actionable: true,
						recommendation: 'Review and limit data collection scope'
					}
				],
				historicalScores: [
					{ date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), score: 67 },
					{ date: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000), score: 68 },
					{ date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), score: 70 },
					{ date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), score: 69 },
					{ date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), score: 71 },
					{ date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), score: 72 },
					{ date: new Date(), score: 72 }
				],
				metadata: {
					analyzedAt: new Date().toISOString(),
					policyVersion: 'demo-version',
					dataPoints: 7,
					demoMode: true
				}
			}
			
			// Cache demo data too
			if (useCache) {
				await kv.set(cacheKey, demoData, { ex: 3600 }) // Cache for 1 hour
			}
			
			return NextResponse.json(demoData)
		}

		const aiService = new AIAnalyticsService(apiKey)

		// Get latest policy content from snapshot API
		const snapshotResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/snapshot/${slug}`)
		if (!snapshotResponse.ok) {
			return NextResponse.json(
				{ error: 'No policy data found' },
				{ status: 404 }
			)
		}
		const latestSnapshot = await snapshotResponse.json()

		// Get historical diff data
		const historyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/diff/${slug}/history?limit=10`)
		const historyData = await historyResponse.json()
		const diffHistory: DiffMeta[] = historyData.diffs || []

		// Enhance diffs with summaries if available
		const enhancedDiffs: EnhancedDiff[] = await Promise.all(
			diffHistory.map(async (diff) => {
				if (diff.summaryId) {
					try {
						const summaryResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/summary/${slug}`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ diffId: diff.id })
						})
						if (summaryResponse.ok) {
							const summaryData = await summaryResponse.json()
							return { ...diff, summary: summaryData.summary }
						}
					} catch (error) {
						console.error('Failed to fetch summary:', error)
					}
				}
				return diff
			})
		)

		let result: any = {}

		switch (analysisType) {
			case 'risk':
				// Calculate risk score
				const riskScore = await aiService.calculateRiskScore(
					latestSnapshot.content || latestSnapshot.text || '',
					enhancedDiffs.map((d) => ({
						category: d.changeType === 'major' ? 'significant' : 'general',
						description: d.summary?.summary || `${d.additions} additions, ${d.deletions} deletions`,
						impact: d.changeType
					}))
				)
				result = { riskScore }
				break

			case 'trends':
				// Analyze trends
				const trendAnalysis = await aiService.analyzeTrends(
					enhancedDiffs.map((d) => ({
						date: new Date(d.createdAt),
						changes: {
							additions: d.additions || 0,
							deletions: d.deletions || 0,
							riskLevel: d.summary?.riskLevel || 'medium',
							categories: d.summary?.categories || []
						}
					})),
					{
						name: slug,
						industry: 'technology', // This could be enhanced with company data
						size: 'large',
						jurisdiction: ['US', 'EU'],
						dataTypes: ['personal', 'usage', 'device'],
						userBase: 1000000
					}
				)
				result = { trendAnalysis }
				break

			case 'insights':
				// Generate insights
				const insights = await aiService.generateInsights(
					latestSnapshot.content || latestSnapshot.text || '',
					enhancedDiffs.map((d) => ({
						date: new Date(d.createdAt),
						summary: d.summary?.summary || `${d.changeType} change: ${d.changeCount} modifications`,
						riskLevel: d.summary?.riskLevel || 'medium'
					}))
				)
				result = { insights }
				break

			case 'full':
			default:
				// Full analysis
				const [riskScoreFull, trendAnalysisFull, insightsFull] = await Promise.all([
					aiService.calculateRiskScore(
						latestSnapshot.content || latestSnapshot.text || '',
						enhancedDiffs.map((d) => ({
							category: d.changeType === 'major' ? 'significant' : 'general',
							description: d.summary?.summary || `${d.additions} additions, ${d.deletions} deletions`,
							impact: d.changeType
						}))
					),
					aiService.analyzeTrends(
						enhancedDiffs.map((d) => ({
							date: new Date(d.createdAt),
							changes: {
								additions: d.additions || 0,
								deletions: d.deletions || 0,
								riskLevel: d.summary?.riskLevel || 'medium',
								categories: d.summary?.categories || []
							}
						}))
					),
					aiService.generateInsights(
						latestSnapshot.content || latestSnapshot.text || '',
						enhancedDiffs.map((d) => ({
							date: new Date(d.createdAt),
							summary: d.summary?.summary || `${d.changeType} change: ${d.changeCount} modifications`,
							riskLevel: d.summary?.riskLevel || 'medium'
						}))
					)
				])

				// Calculate historical risk scores based on change magnitude
				const historicalScores = enhancedDiffs.map((d) => {
					// Simple heuristic: major changes = higher risk
					const baseScore = d.changeType === 'major' ? 70 : d.changeType === 'moderate' ? 50 : 30
					const changeImpact = Math.min(20, (d.changeCount / 100) * 20)
					return {
						date: new Date(d.createdAt),
						score: Math.min(100, baseScore + changeImpact)
					}
				})

				result = {
					riskScore: riskScoreFull,
					trendAnalysis: trendAnalysisFull,
					insights: insightsFull,
					historicalScores,
					metadata: {
						analyzedAt: new Date().toISOString(),
						policyVersion: latestSnapshot.id,
						dataPoints: diffHistory.length
					}
				}
		}

		// Cache the result for 24 hours
		if (useCache) {
			await kv.set(cacheKey, result, { ex: 86400 })
		}

		return NextResponse.json(result)

	} catch (error) {
		console.error('Analytics API error:', error)
		return NextResponse.json(
			{ error: 'Failed to generate analytics' },
			{ status: 500 }
		)
	}
}

export async function POST(
	request: NextRequest,
	_context: { params: Promise<{ slug: string }> }
) {
	try {
		const body = await request.json()
		const { action, data } = body

		const apiKey = process.env.OPENROUTER_API_KEY
		if (!apiKey) {
			return NextResponse.json(
				{ error: 'AI service not configured' },
				{ status: 500 }
			)
		}

		const aiService = new AIAnalyticsService(apiKey)

		switch (action) {
			case 'compare':
				// Compare with industry peers
				const comparison = await aiService.compareWithIndustry(
					data.companyPolicy,
					data.industryPolicies
				)
				return NextResponse.json({ comparison })

			case 'predict':
				// Predict future changes
				const predictions = await aiService.predictFutureChanges(
					data.historicalChanges,
					data.externalFactors
				)
				return NextResponse.json({ predictions })

			default:
				return NextResponse.json(
					{ error: 'Invalid action' },
					{ status: 400 }
				)
		}

	} catch (error) {
		console.error('Analytics API error:', error)
		return NextResponse.json(
			{ error: 'Failed to process analytics request' },
			{ status: 500 }
		)
	}
}