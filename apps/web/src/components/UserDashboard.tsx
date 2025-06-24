'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { PremiumCard, PremiumCardContent, PremiumCardHeader, PremiumCardTitle } from '@/components/ui/premium-card'
import { PremiumBadge } from '@/components/ui/premium-badge'
import { Button } from '@/components/ui/button'
import { PremiumTimeline } from './PremiumTimeline'
import { GlobalSearchBar } from './GlobalSearchBar'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'
import { RiskScoreCard } from '@/components/analytics/RiskScoreCard'
import { PolicyTimeline } from '@/components/analytics/PolicyTimeline'
import { 
	Settings, Star, TrendingUp, Shield, Clock, 
	ChevronRight, Plus, X, Mail, Moon, Sun, Monitor,
	BarChart3, AlertTriangle, Eye
} from 'lucide-react'
import { type TimelineEvent } from './PremiumTimeline'

interface WatchlistItem {
	slug: string
	name: string
	lastChecked: Date
	changeCount: number
	riskLevel: 'low' | 'medium' | 'high'
}

export function UserDashboard() {
	const { user, isLoaded } = useUser()
	const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
	const [recentActivity, setRecentActivity] = useState<TimelineEvent[]>([])
	const [showSettings, setShowSettings] = useState(false)
	const [showAnalytics, setShowAnalytics] = useState(false)
	const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
	
	// Mock data for demo
	const mockRiskData = {
		overall: 6.8,
		categories: {
			dataCollection: 7.2,
			thirdPartySharing: 5.4,
			dataRetention: 6.1,
			userRights: 8.3,
			transparency: 7.8
		},
		trend: 'up' as const,
		lastUpdated: '2 hours ago',
		alerts: 2
	}

	// Mock watchlist data
	const mockWatchlist = ['google', 'facebook', 'amazon']

	useEffect(() => {
		if (isLoaded && user) {
			// Fetch watchlist data
			fetchWatchlistData()
			// Fetch recent activity
			fetchRecentActivity()
		}
	}, [isLoaded, user])

	const fetchWatchlistData = async () => {
		// In a real app, this would fetch from API
		const mockData: WatchlistItem[] = mockWatchlist.map(slug => ({
			slug,
			name: slug.charAt(0).toUpperCase() + slug.slice(1),
			lastChecked: new Date(),
			changeCount: Math.floor(Math.random() * 10),
			riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any
		}))
		setWatchlist(mockData)
	}

	const fetchRecentActivity = async () => {
		// In a real app, this would fetch from API
		const mockActivity: TimelineEvent[] = [
			{
				id: '1',
				date: new Date(),
				type: 'minor',
				title: 'Google updated data retention policy',
				description: 'Extended data retention period from 18 to 24 months',
				impact: 'medium',
				tags: ['Google', 'Data Retention']
			},
			{
				id: '2',
				date: new Date(Date.now() - 86400000),
				type: 'major',
				title: 'Facebook added new data sharing partners',
				description: 'Added 5 new third-party data sharing agreements',
				impact: 'high',
				tags: ['Facebook', 'Data Sharing']
			}
		]
		setRecentActivity(mockActivity)
	}

	const handleRemoveFromWatchlist = async (slug: string) => {
		// In a real app, this would call an API
		setWatchlist(prev => prev.filter(item => item.slug !== slug))
	}

	const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
		setTheme(newTheme)
		// In a real app, this would update user preferences
	}

	if (!isLoaded || !user) {
		return null
	}

	const userEmail = user.emailAddresses[0]?.emailAddress || 'User'
	const userName = user.firstName || userEmail.split('@')[0]
	const userPlan = 'free' // Default to free plan

	return (
		<div className="min-h-screen bg-gradient-subtle">
			<div className="container mx-auto px-4 py-8 max-w-7xl">
				{/* Header */}
				<div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
					<div>
						<h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-2">
							Welcome back, {userName}
						</h1>
						<p className="text-muted-foreground">
							Track privacy policy changes across your watchlist
						</p>
					</div>
					<div className="flex gap-4">
						<Button 
							variant="outline" 
							size="sm"
							onClick={() => setShowAnalytics(!showAnalytics)}
							className="flex items-center gap-2"
						>
							<BarChart3 className="h-4 w-4" />
							{showAnalytics ? 'Hide' : 'Show'} Analytics
						</Button>
						<Button 
							variant="outline" 
							size="sm"
							onClick={() => setShowSettings(!showSettings)}
						>
							<Settings className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Settings Panel */}
				{showSettings && (
					<PremiumCard className="mb-8 border-primary/20">
						<PremiumCardHeader>
							<div className="flex justify-between items-center">
								<PremiumCardTitle>Settings</PremiumCardTitle>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowSettings(false)}
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						</PremiumCardHeader>
						<PremiumCardContent className="space-y-6">
							{/* Theme Settings */}
							<div>
								<h3 className="text-sm font-medium mb-3">Theme</h3>
								<div className="flex gap-2">
									<Button
										variant={theme === 'light' ? 'default' : 'outline'}
										size="sm"
										onClick={() => handleThemeChange('light')}
										className="flex items-center gap-2"
									>
										<Sun className="h-4 w-4" />
										Light
									</Button>
									<Button
										variant={theme === 'dark' ? 'default' : 'outline'}
										size="sm"
										onClick={() => handleThemeChange('dark')}
										className="flex items-center gap-2"
									>
										<Moon className="h-4 w-4" />
										Dark
									</Button>
									<Button
										variant={theme === 'system' ? 'default' : 'outline'}
										size="sm"
										onClick={() => handleThemeChange('system')}
										className="flex items-center gap-2"
									>
										<Monitor className="h-4 w-4" />
										System
									</Button>
								</div>
							</div>

							{/* Email Notifications */}
							<div>
								<h3 className="text-sm font-medium mb-3">Email Notifications</h3>
								<div className="space-y-2">
									<label className="flex items-center gap-2">
										<input type="checkbox" defaultChecked className="rounded" />
										<span className="text-sm">Major changes only</span>
									</label>
									<label className="flex items-center gap-2">
										<input type="checkbox" className="rounded" />
										<span className="text-sm">Weekly digest</span>
									</label>
								</div>
							</div>

							{/* Account Info */}
							<div>
								<h3 className="text-sm font-medium mb-3">Account</h3>
								<div className="space-y-2 text-sm text-muted-foreground">
									<p>Email: {userEmail}</p>
									<p className="flex items-center gap-2">
										Plan: <PremiumBadge>{userPlan}</PremiumBadge>
									</p>
								</div>
							</div>
						</PremiumCardContent>
					</PremiumCard>
				)}

				{/* Global Search */}
				<div className="mb-8">
					<GlobalSearchBar />
				</div>

				{/* Analytics Dashboard */}
				{showAnalytics && (
					<div className="mb-8 space-y-6">
						<RiskScoreCard company="Overall Portfolio" riskData={mockRiskData} />
						<AnalyticsDashboard />
					</div>
				)}

				{/* Main Dashboard Grid */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{/* Watchlist */}
					<div className="lg:col-span-2">
						<PremiumCard>
							<PremiumCardHeader>
								<div className="flex justify-between items-center">
									<PremiumCardTitle className="flex items-center gap-2">
										<Eye className="h-5 w-5 text-primary" />
										Your Watchlist
									</PremiumCardTitle>
									<Button size="sm" className="gap-2">
										<Plus className="h-4 w-4" />
										Add Company
									</Button>
								</div>
							</PremiumCardHeader>
							<PremiumCardContent>
								{watchlist.length === 0 ? (
									<div className="text-center py-12">
										<Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
										<p className="text-muted-foreground mb-4">No companies in your watchlist yet</p>
										<Button size="sm">Browse Companies</Button>
									</div>
								) : (
									<div className="space-y-3">
										{watchlist.map((item) => (
											<div key={item.slug} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
												<div className="flex items-center gap-4">
													<div className={`w-2 h-2 rounded-full ${
														item.riskLevel === 'high' ? 'bg-red-500' :
														item.riskLevel === 'medium' ? 'bg-yellow-500' :
														'bg-green-500'
													}`} />
													<div>
														<h3 className="font-medium">{item.name}</h3>
														<p className="text-sm text-muted-foreground">
															{item.changeCount} changes • Last checked {item.lastChecked.toLocaleDateString()}
														</p>
													</div>
												</div>
												<div className="flex items-center gap-2">
													<Button variant="ghost" size="sm">
														<ChevronRight className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleRemoveFromWatchlist(item.slug)}
													>
														<X className="h-4 w-4" />
													</Button>
												</div>
											</div>
										))}
									</div>
								)}
							</PremiumCardContent>
						</PremiumCard>
					</div>

					{/* Recent Activity */}
					<div>
						<PremiumCard className="h-full">
							<PremiumCardHeader>
								<PremiumCardTitle className="flex items-center gap-2">
									<Clock className="h-5 w-5 text-primary" />
									Recent Activity
								</PremiumCardTitle>
							</PremiumCardHeader>
							<PremiumCardContent>
								{recentActivity.length === 0 ? (
									<p className="text-center text-muted-foreground py-8">
										No recent activity
									</p>
								) : (
									<PremiumTimeline events={recentActivity} />
								)}
							</PremiumCardContent>
						</PremiumCard>
					</div>
				</div>

				{/* Upgrade CTA for free users */}
				{userPlan === 'free' && (
					<div className="mt-8">
						<PremiumCard className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
							<PremiumCardContent className="text-center py-8">
								<Star className="h-12 w-12 text-primary mx-auto mb-4" />
								<h2 className="text-2xl font-bold mb-2">Upgrade to Premium</h2>
								<p className="text-muted-foreground mb-6 max-w-md mx-auto">
									Get advanced analytics, unlimited watchlist items, and priority alerts
								</p>
								<Button size="lg" className="gap-2">
									<TrendingUp className="h-5 w-5" />
									Upgrade Now
								</Button>
							</PremiumCardContent>
						</PremiumCard>
					</div>
				)}
			</div>
		</div>
	)
}