'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
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
	const { user, updatePreferences, removeFromWatchlist } = useAuth()
	const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
	const [recentActivity, setRecentActivity] = useState<TimelineEvent[]>([])
	const [showSettings, setShowSettings] = useState(false)
	const [showAnalytics, setShowAnalytics] = useState(false)
	const [theme, setTheme] = useState(user?.preferences.theme || 'system')
	
	// Mock risk data for demo
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

	useEffect(() => {
		if (user) {
			// Fetch watchlist data
			fetchWatchlistData()
			// Fetch recent activity
			fetchRecentActivity()
		}
	}, [user])

	const fetchWatchlistData = async () => {
		// In a real app, this would fetch from API
		const mockData: WatchlistItem[] = user?.preferences.watchlist.map(slug => ({
			slug,
			name: slug.charAt(0).toUpperCase() + slug.slice(1),
			lastChecked: new Date(),
			changeCount: Math.floor(Math.random() * 10),
			riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any
		})) || []
		setWatchlist(mockData)
	}

	const fetchRecentActivity = async () => {
		// In a real app, this would fetch from API
		const mockActivity: TimelineEvent[] = [
			{
				id: '1',
				date: new Date(),
				title: 'Google Privacy Policy Updated',
				description: 'Major changes to data collection practices',
				type: 'major',
				impact: 'high',
				stats: { additions: 245, deletions: 123, modifications: 67 }
			},
			{
				id: '2',
				date: new Date(Date.now() - 86400000),
				title: 'Facebook Terms Modified',
				description: 'Minor updates to user rights section',
				type: 'modification',
				impact: 'low',
				stats: { additions: 45, deletions: 23, modifications: 12 }
			}
		]
		setRecentActivity(mockActivity)
	}

	const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
		setTheme(newTheme)
		await updatePreferences({ theme: newTheme })
		
		// Apply theme to document
		if (newTheme === 'system') {
			const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
			document.documentElement.classList.toggle('dark', systemTheme === 'dark')
		} else {
			document.documentElement.classList.toggle('dark', newTheme === 'dark')
		}
	}

	const handleNotificationToggle = async (key: keyof NonNullable<typeof user>['preferences']['notifications']) => {
		if (!user) return
		
		const newNotifications = {
			...user.preferences.notifications,
			[key]: !user.preferences.notifications[key]
		}
		await updatePreferences({ notifications: newNotifications })
	}

	if (!user) return null

	return (
		<div className="min-h-screen bg-gradient-subtle">
			{/* Header */}
			<header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<h1 className="text-2xl font-bold">PolicyDiff</h1>
							<PremiumBadge variant="premium" size="sm">
								{user.plan.toUpperCase()}
							</PremiumBadge>
						</div>
						
						<div className="flex items-center gap-4">
							<GlobalSearchBar />
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setShowSettings(!showSettings)}
							>
								<Settings className="h-5 w-5" />
							</Button>
							<div className="flex items-center gap-2">
								<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
									{user.name.charAt(0).toUpperCase()}
								</div>
								<span className="text-sm font-medium">{user.name}</span>
							</div>
						</div>
					</div>
				</div>
			</header>

			<div className="container mx-auto px-4 py-4 md:py-8">
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
					{/* Main Content */}
					<div className="lg:col-span-2 space-y-4 md:space-y-6">
						{/* Welcome Card */}
						<PremiumCard variant="gradient">
							<PremiumCardContent className="p-4 md:p-6">
								<h2 className="text-2xl font-bold mb-2">
									Welcome back, {user.name.split(' ')[0]}!
								</h2>
								<p className="text-muted-foreground mb-4">
									You're tracking {watchlist.length} companies. 
									{recentActivity.length > 0 && ` ${recentActivity.length} updates since your last visit.`}
								</p>
								<div className="flex flex-col sm:flex-row gap-3">
									<Button 
										variant="premium" 
										size="sm"
										onClick={() => setShowAnalytics(!showAnalytics)}
									>
										<BarChart3 className="h-4 w-4 mr-2" />
										{showAnalytics ? 'Hide Analytics' : 'View Analytics'}
									</Button>
									<Button variant="outline" size="sm">
										<Plus className="h-4 w-4 mr-2" />
										Add Company
									</Button>
								</div>
							</PremiumCardContent>
						</PremiumCard>

						{/* Watchlist */}
						<PremiumCard>
							<PremiumCardHeader>
								<PremiumCardTitle>Your Watchlist</PremiumCardTitle>
							</PremiumCardHeader>
							<PremiumCardContent>
								{watchlist.length === 0 ? (
									<div className="text-center py-8">
										<Star className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
										<p className="text-muted-foreground mb-4">No companies in your watchlist yet</p>
										<Button variant="outline">
											<Plus className="h-4 w-4 mr-2" />
											Add Your First Company
										</Button>
									</div>
								) : (
									<div className="space-y-3">
										{watchlist.map((item) => (
											<div
												key={item.slug}
												className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-colors"
											>
												<div className="flex items-center gap-4">
													<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
														<Shield className="h-5 w-5 text-primary" />
													</div>
													<div>
														<h4 className="font-medium">{item.name}</h4>
														<div className="flex items-center gap-3 text-sm text-muted-foreground">
															<span className="flex items-center gap-1">
																<Clock className="h-3 w-3" />
																Checked {new Date(item.lastChecked).toLocaleDateString()}
															</span>
															<span>{item.changeCount} changes</span>
														</div>
													</div>
												</div>
												<div className="flex items-center gap-2">
													<PremiumBadge
														variant={
															item.riskLevel === 'high' ? 'destructive' :
															item.riskLevel === 'medium' ? 'warning' : 'success'
														}
														size="sm"
													>
														{item.riskLevel} risk
													</PremiumBadge>
													<Button
														variant="ghost"
														size="icon"
														onClick={() => removeFromWatchlist(item.slug)}
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

						{/* Analytics Dashboard - Conditionally shown */}
						{showAnalytics && (
							<PremiumCard className="animate-slide-up">
								<PremiumCardHeader>
									<PremiumCardTitle className="flex items-center gap-2">
										<BarChart3 className="h-5 w-5" />
										Advanced Analytics
									</PremiumCardTitle>
								</PremiumCardHeader>
								<PremiumCardContent>
									<AnalyticsDashboard />
								</PremiumCardContent>
							</PremiumCard>
						)}

						{/* Policy Timeline */}
						{showAnalytics && (
							<PolicyTimeline />
						)}

						{/* Recent Activity */}
						<PremiumCard>
							<PremiumCardHeader>
								<div className="flex items-center justify-between">
									<PremiumCardTitle>Recent Activity</PremiumCardTitle>
									<Button variant="ghost" size="sm">
										View All
										<ChevronRight className="h-4 w-4 ml-1" />
									</Button>
								</div>
							</PremiumCardHeader>
							<PremiumCardContent>
								<PremiumTimeline events={recentActivity} condensed />
							</PremiumCardContent>
						</PremiumCard>
					</div>

					{/* Sidebar */}
					<div className="space-y-4 md:space-y-6">
						{/* Risk Score Card */}
						{showAnalytics && (
							<RiskScoreCard 
								company="Overall Portfolio" 
								riskData={mockRiskData}
								className="animate-slide-up"
							/>
						)}

						{/* Quick Stats */}
						<PremiumCard variant="glass">
							<PremiumCardHeader>
								<PremiumCardTitle>Quick Stats</PremiumCardTitle>
							</PremiumCardHeader>
							<PremiumCardContent>
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">Companies Tracked</span>
										<span className="font-semibold">{watchlist.length}</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">Total Changes</span>
										<span className="font-semibold">
											{watchlist.reduce((acc, item) => acc + item.changeCount, 0)}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">High Risk Policies</span>
										<span className="font-semibold text-destructive">
											{watchlist.filter(item => item.riskLevel === 'high').length}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">Plan</span>
										<PremiumBadge variant="premium" size="sm">
											{user.plan.toUpperCase()}
										</PremiumBadge>
									</div>
								</div>
							</PremiumCardContent>
						</PremiumCard>

						{/* Settings Panel */}
						{showSettings && (
							<PremiumCard variant="glass" className="animate-slide-up">
								<PremiumCardHeader>
									<PremiumCardTitle>Settings</PremiumCardTitle>
								</PremiumCardHeader>
								<PremiumCardContent>
									<div className="space-y-4">
										{/* Theme Settings */}
										<div>
											<label className="text-sm font-medium mb-2 block">Theme</label>
											<div className="grid grid-cols-3 gap-2">
												<Button
													variant={theme === 'light' ? 'default' : 'outline'}
													size="sm"
													onClick={() => handleThemeChange('light')}
												>
													<Sun className="h-4 w-4 mr-1" />
													Light
												</Button>
												<Button
													variant={theme === 'dark' ? 'default' : 'outline'}
													size="sm"
													onClick={() => handleThemeChange('dark')}
												>
													<Moon className="h-4 w-4 mr-1" />
													Dark
												</Button>
												<Button
													variant={theme === 'system' ? 'default' : 'outline'}
													size="sm"
													onClick={() => handleThemeChange('system')}
												>
													<Monitor className="h-4 w-4 mr-1" />
													System
												</Button>
											</div>
										</div>

										{/* Notification Settings */}
										<div>
											<label className="text-sm font-medium mb-2 block">Notifications</label>
											<div className="space-y-2">
												<label className="flex items-center justify-between">
													<span className="text-sm">Email notifications</span>
													<input
														type="checkbox"
														checked={user.preferences.notifications.email}
														onChange={() => handleNotificationToggle('email')}
														className="rounded"
													/>
												</label>
												<label className="flex items-center justify-between">
													<span className="text-sm">Major changes only</span>
													<input
														type="checkbox"
														checked={user.preferences.notifications.majorChanges}
														onChange={() => handleNotificationToggle('majorChanges')}
														className="rounded"
													/>
												</label>
												<label className="flex items-center justify-between">
													<span className="text-sm">Weekly digest</span>
													<input
														type="checkbox"
														checked={user.preferences.notifications.weeklyDigest}
														onChange={() => handleNotificationToggle('weeklyDigest')}
														className="rounded"
													/>
												</label>
											</div>
										</div>

										<Button variant="outline" className="w-full">
											<Mail className="h-4 w-4 mr-2" />
											Manage Account
										</Button>
									</div>
								</PremiumCardContent>
							</PremiumCard>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}