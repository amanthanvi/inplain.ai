'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, Shield, Users, Lock, Eye, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PremiumCard, PremiumCardContent, PremiumCardHeader, PremiumCardTitle } from '@/components/ui/premium-card'
import { PremiumBadge } from '@/components/ui/premium-badge'
import { PremiumProgress } from '@/components/ui/premium-progress'
import { Button } from '@/components/ui/button'
import type { RiskScore, TrendAnalysis, PolicyInsight } from '@/lib/ai-analytics'

interface AnalyticsData {
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

interface PremiumAnalyticsDashboardProps {
	data: AnalyticsData
	companyName: string
	onInsightClick?: (insight: PolicyInsight) => void
	onExport?: () => void
}

export function PremiumAnalyticsDashboard({
	data,
	companyName,
	onInsightClick,
	onExport
}: PremiumAnalyticsDashboardProps) {
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
	const [timeRange, setTimeRange] = useState<'1m' | '3m' | '6m' | '1y'>('3m')

	const getRiskColor = (score: number) => {
		if (score >= 70) return 'text-destructive'
		if (score >= 40) return 'text-[hsl(var(--warning))]'
		return 'text-[hsl(var(--success))]'
	}

	const getRiskLabel = (score: number) => {
		if (score >= 70) return 'High Risk'
		if (score >= 40) return 'Medium Risk'
		return 'Low Risk'
	}

	const getTrendIcon = (trend: string) => {
		switch (trend) {
			case 'improving':
				return <TrendingDown className="h-4 w-4 text-[hsl(var(--success))]" />
			case 'declining':
				return <TrendingUp className="h-4 w-4 text-destructive" />
			default:
				return <BarChart3 className="h-4 w-4 text-muted-foreground" />
		}
	}

	const categoryIcons = {
		dataCollection: <Eye className="h-4 w-4" />,
		dataSharing: <Users className="h-4 w-4" />,
		userRights: <Shield className="h-4 w-4" />,
		security: <Lock className="h-4 w-4" />,
		thirdParties: <Users className="h-4 w-4" />,
		transparency: <Eye className="h-4 w-4" />
	}

	const categoryLabels = {
		dataCollection: 'Data Collection',
		dataSharing: 'Data Sharing',
		userRights: 'User Rights',
		security: 'Security',
		thirdParties: 'Third Parties',
		transparency: 'Transparency'
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold">{companyName} Privacy Analytics</h2>
					<p className="text-muted-foreground mt-1">
						Comprehensive privacy policy analysis and risk assessment
					</p>
				</div>
				<div className="flex items-center gap-2">
					<select
						value={timeRange}
						onChange={(e) => setTimeRange(e.target.value as any)}
						className="px-3 py-2 text-sm bg-background border border-input rounded-lg focus-ring"
					>
						<option value="1m">Last Month</option>
						<option value="3m">Last 3 Months</option>
						<option value="6m">Last 6 Months</option>
						<option value="1y">Last Year</option>
					</select>
					{onExport && (
						<Button variant="outline" onClick={onExport}>
							Export Report
						</Button>
					)}
				</div>
			</div>

			{/* Main Risk Score Card */}
			<PremiumCard variant="gradient" className="relative overflow-hidden">
				<div className="absolute inset-0 gradient-radial opacity-50" />
				<PremiumCardContent className="relative z-10">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div className="text-center">
							<div className="text-5xl font-bold mb-2">
								<span className={getRiskColor(data.riskScore.overall)}>
									{data.riskScore.overall}
								</span>
								<span className="text-2xl text-muted-foreground">/100</span>
							</div>
							<p className="text-lg font-medium">{getRiskLabel(data.riskScore.overall)}</p>
							<p className="text-sm text-muted-foreground mt-1">Overall Privacy Risk Score</p>
						</div>

						<div className="flex items-center justify-center">
							<div className="space-y-2">
								<div className="flex items-center gap-2">
									{getTrendIcon(data.trendAnalysis.trend)}
									<span className="font-medium capitalize">{data.trendAnalysis.trend} Trend</span>
								</div>
								<PremiumProgress
									value={data.trendAnalysis.confidence * 100}
									variant="gradient"
									size="sm"
									showLabel
								/>
								<p className="text-xs text-muted-foreground">Confidence Level</p>
							</div>
						</div>

						{data.industryComparison && (
							<div className="text-center">
								<div className="text-3xl font-bold mb-2">
									#{data.industryComparison.ranking}
								</div>
								<p className="text-sm text-muted-foreground">
									Industry Ranking
								</p>
								<PremiumBadge variant="premium" className="mt-2">
									Top {data.industryComparison.percentile}%
								</PremiumBadge>
							</div>
						)}
					</div>
				</PremiumCardContent>
			</PremiumCard>

			{/* Category Breakdown */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{Object.entries(data.riskScore.categories).map(([category, score]) => (
					<PremiumCard
						key={category}
						variant={selectedCategory === category ? 'elevated' : 'default'}
						hover
						className="cursor-pointer"
						onClick={() => setSelectedCategory(category === selectedCategory ? null : category)}
					>
						<PremiumCardContent className="p-4">
							<div className="flex items-start justify-between mb-3">
								<div className="flex items-center gap-2">
									{categoryIcons[category as keyof typeof categoryIcons]}
									<span className="font-medium">
										{categoryLabels[category as keyof typeof categoryLabels]}
									</span>
								</div>
								<span className={cn("text-2xl font-bold", getRiskColor(score))}>
									{score}
								</span>
							</div>
							<PremiumProgress
								value={score}
								variant={score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'success'}
								size="sm"
							/>
							{selectedCategory === category && (
								<div className="mt-3 space-y-2 animate-slide-up">
									{data.riskScore.factors
										.filter(f => f.category.toLowerCase().includes(category.toLowerCase()))
										.slice(0, 3)
										.map((factor, idx) => (
											<div key={idx} className="text-sm">
												<PremiumBadge
													variant={
														factor.severity === 'critical' ? 'destructive' :
														factor.severity === 'high' ? 'destructive' :
														factor.severity === 'medium' ? 'warning' : 'success'
													}
													size="sm"
												>
													{factor.severity}
												</PremiumBadge>
												<p className="text-muted-foreground mt-1">{factor.description}</p>
											</div>
										))}
								</div>
							)}
						</PremiumCardContent>
					</PremiumCard>
				))}
			</div>

			{/* Insights Section */}
			<PremiumCard variant="glass">
				<PremiumCardHeader>
					<PremiumCardTitle>Key Insights & Recommendations</PremiumCardTitle>
				</PremiumCardHeader>
				<PremiumCardContent>
					<div className="space-y-3">
						{data.insights.slice(0, 5).map((insight, idx) => (
							<div
								key={idx}
								className={cn(
									"p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md",
									insight.priority === 'high' && "border-destructive/50 bg-destructive/5",
									insight.priority === 'medium' && "border-[hsl(var(--warning))/50] bg-[hsl(var(--warning))/5]",
									insight.priority === 'low' && "border-border"
								)}
								onClick={() => onInsightClick?.(insight)}
							>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-1">
											{insight.type === 'warning' && <AlertTriangle className="h-4 w-4 text-destructive" />}
											{insight.type === 'improvement' && <TrendingUp className="h-4 w-4 text-[hsl(var(--success))]" />}
											{insight.type === 'compliance' && <Shield className="h-4 w-4 text-primary" />}
											<h4 className="font-medium">{insight.title}</h4>
										</div>
										<p className="text-sm text-muted-foreground">{insight.description}</p>
									</div>
									<PremiumBadge
										variant={
											insight.priority === 'high' ? 'destructive' :
											insight.priority === 'medium' ? 'warning' : 'outline'
										}
										size="sm"
									>
										{insight.priority}
									</PremiumBadge>
								</div>
							</div>
						))}
					</div>
				</PremiumCardContent>
			</PremiumCard>

			{/* Risk Factors */}
			<PremiumCard>
				<PremiumCardHeader>
					<PremiumCardTitle>Top Risk Factors</PremiumCardTitle>
				</PremiumCardHeader>
				<PremiumCardContent>
					<div className="space-y-4">
						{data.riskScore.factors
							.sort((a, b) => b.impact - a.impact)
							.slice(0, 5)
							.map((factor, idx) => (
								<div key={idx} className="flex items-center gap-4">
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-1">
											<span className="font-medium">{factor.category}</span>
											<PremiumBadge
												variant={
													factor.severity === 'critical' || factor.severity === 'high' ? 'destructive' :
													factor.severity === 'medium' ? 'warning' : 'success'
												}
												size="sm"
											>
												{factor.severity}
											</PremiumBadge>
										</div>
										<p className="text-sm text-muted-foreground">{factor.description}</p>
									</div>
									<div className="text-right">
										<div className="text-2xl font-bold">{factor.impact}</div>
										<p className="text-xs text-muted-foreground">Impact</p>
									</div>
								</div>
							))}
					</div>
				</PremiumCardContent>
			</PremiumCard>
		</div>
	)
}