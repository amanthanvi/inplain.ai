'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { PremiumAnalyticsDashboard } from '@/components/PremiumAnalyticsDashboard'
import { PremiumDiffViewer } from '@/components/PremiumDiffViewer'
import { PremiumTimeline } from '@/components/PremiumTimeline'
import { PremiumCard, PremiumCardContent, PremiumCardHeader, PremiumCardTitle } from '@/components/ui/premium-card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Download, Share2, RefreshCw, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { RiskScore, TrendAnalysis, PolicyInsight } from '@/lib/ai-analytics'
import type { TimelineEvent } from '@/components/PremiumTimeline'
import type { DiffSection } from '@/components/PremiumDiffViewer'

interface AnalyticsPageData {
	company: {
		name: string
		slug: string
		url: string
	}
	analytics: {
		riskScore: RiskScore
		trendAnalysis: TrendAnalysis
		insights: PolicyInsight[]
		industryComparison?: {
			ranking: number
			percentile: number
			totalCompanies: number
		}
		historicalScores: Array<{
			date: Date
			score: number
		}>
	}
	recentDiffs: DiffSection[]
	timeline: TimelineEvent[]
}

export default function AnalyticsPage() {
	const params = useParams()
	const slug = params.slug as string
	const [data, setData] = useState<AnalyticsPageData | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [activeTab, setActiveTab] = useState('overview')

	useEffect(() => {
		fetchAnalyticsData()
	}, [slug])

	const fetchAnalyticsData = async (refresh = false) => {
		if (refresh) setIsRefreshing(true)
		else setIsLoading(true)

		try {
			// Fetch analytics data
			const analyticsResponse = await fetch(`/api/analytics/${slug}?type=full&cache=${!refresh}`)
			const analyticsData = await analyticsResponse.json()

			// Fetch company info
			const companyResponse = await fetch(`/api/companies/${slug}`)
			const companyData = await companyResponse.json()

			// Mock additional data (in real app, would fetch from API)
			const mockDiffs: DiffSection[] = [
				{
					id: '1',
					title: 'Data Collection Changes',
					changes: [
						{ type: 'addition', content: 'We now collect device fingerprinting data', metadata: { severity: 'high' } },
						{ type: 'deletion', content: 'We no longer limit data retention to 90 days' },
						{ type: 'modification', content: 'Updated third-party sharing practices' }
					],
					impact: 'high',
					summary: 'Significant expansion of data collection practices'
				},
				{
					id: '2',
					title: 'User Rights Updates',
					changes: [
						{ type: 'addition', content: 'Added right to data portability' },
						{ type: 'addition', content: 'New opt-out mechanisms for targeted advertising' }
					],
					impact: 'low',
					summary: 'Improved user control options'
				}
			]

			const mockTimeline: TimelineEvent[] = analyticsData.historicalScores.map((score: any, idx: number) => ({
				id: `event-${idx}`,
				date: new Date(score.date),
				title: `Policy Update`,
				type: score.score > 70 ? 'major' : score.score > 50 ? 'modification' : 'minor',
				impact: score.score > 70 ? 'high' : score.score > 50 ? 'medium' : 'low',
				stats: {
					additions: Math.floor(Math.random() * 100),
					deletions: Math.floor(Math.random() * 50),
					modifications: Math.floor(Math.random() * 30)
				}
			}))

			setData({
				company: companyData || { name: slug, slug, url: '' },
				analytics: analyticsData,
				recentDiffs: mockDiffs,
				timeline: mockTimeline
			})
		} catch (error) {
			console.error('Failed to fetch analytics:', error)
		} finally {
			setIsLoading(false)
			setIsRefreshing(false)
		}
	}

	const handleExport = async () => {
		if (!data) return

		const exportData = {
			company: data.company,
			analytics: data.analytics,
			exportedAt: new Date().toISOString()
		}

		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${slug}-analytics-${new Date().toISOString().split('T')[0]}.json`
		a.click()
		URL.revokeObjectURL(url)
	}

	const handleInsightClick = (insight: PolicyInsight) => {
		// Navigate to specific section or show detailed view
		console.log('Insight clicked:', insight)
	}

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		)
	}

	if (!data) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<h2 className="text-2xl font-bold mb-2">No Analytics Data</h2>
					<p className="text-muted-foreground mb-4">Unable to load analytics for this company</p>
					<Link href="/">
						<Button variant="outline">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Home
						</Button>
					</Link>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-gradient-subtle">
			{/* Header */}
			<div className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<Link href={`/${slug}`}>
								<Button variant="ghost" size="icon">
									<ArrowLeft className="h-5 w-5" />
								</Button>
							</Link>
							<div>
								<h1 className="text-2xl font-bold">{data.company.name} Analytics</h1>
								<p className="text-sm text-muted-foreground">Privacy Policy Intelligence</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => fetchAnalyticsData(true)}
								disabled={isRefreshing}
							>
								{isRefreshing ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<RefreshCw className="h-4 w-4" />
								)}
							</Button>
							<Button variant="outline" size="sm">
								<Share2 className="h-4 w-4" />
							</Button>
							<Button variant="premium" size="sm" onClick={handleExport}>
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="container mx-auto px-4 py-8">
				<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
					<TabsList className="grid w-full max-w-md grid-cols-4">
						<TabsTrigger value="overview">Overview</TabsTrigger>
						<TabsTrigger value="changes">Changes</TabsTrigger>
						<TabsTrigger value="timeline">Timeline</TabsTrigger>
						<TabsTrigger value="insights">Insights</TabsTrigger>
					</TabsList>

					<TabsContent value="overview" className="space-y-6">
						<PremiumAnalyticsDashboard
							data={data.analytics}
							companyName={data.company.name}
							onInsightClick={handleInsightClick}
							onExport={handleExport}
						/>
					</TabsContent>

					<TabsContent value="changes" className="space-y-6">
						<PremiumCard>
							<PremiumCardHeader>
								<PremiumCardTitle>Recent Policy Changes</PremiumCardTitle>
							</PremiumCardHeader>
							<PremiumCardContent>
								<PremiumDiffViewer
									sections={data.recentDiffs}
									searchEnabled
									filterEnabled
									exportEnabled
									fullscreenEnabled
								/>
							</PremiumCardContent>
						</PremiumCard>
					</TabsContent>

					<TabsContent value="timeline" className="space-y-6">
						<PremiumCard>
							<PremiumCardHeader>
								<PremiumCardTitle>Change History</PremiumCardTitle>
							</PremiumCardHeader>
							<PremiumCardContent>
								<PremiumTimeline
									events={data.timeline}
									showStats
								/>
							</PremiumCardContent>
						</PremiumCard>
					</TabsContent>

					<TabsContent value="insights" className="space-y-6">
						<div className="grid gap-4">
							{data.analytics.insights.map((insight, idx) => (
								<PremiumCard
									key={idx}
									variant="glass"
									hover
									className="cursor-pointer"
									onClick={() => handleInsightClick(insight)}
								>
									<PremiumCardContent className="p-6">
										<div className="flex items-start justify-between">
											<div>
												<h3 className="font-semibold text-lg mb-2">{insight.title}</h3>
												<p className="text-muted-foreground">{insight.description}</p>
											</div>
											<div className="flex flex-col items-end gap-2">
												<span className={`text-sm font-medium ${
													insight.priority === 'high' ? 'text-destructive' :
													insight.priority === 'medium' ? 'text-warning' : 'text-muted-foreground'
												}`}>
													{insight.priority.toUpperCase()} PRIORITY
												</span>
												{insight.actionable && (
													<Button size="sm" variant="outline">
														Take Action
													</Button>
												)}
											</div>
										</div>
									</PremiumCardContent>
								</PremiumCard>
							))}
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	)
}