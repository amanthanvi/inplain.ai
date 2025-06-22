'use client'

import { useState } from 'react'
import { Calendar, Clock, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PremiumCard, PremiumCardContent } from '@/components/ui/premium-card'
import { PremiumBadge } from '@/components/ui/premium-badge'
import { PremiumTooltip } from '@/components/ui/premium-tooltip'
import { Button } from '@/components/ui/button'

export interface TimelineEvent {
	id: string
	date: Date
	title: string
	description?: string
	type: 'addition' | 'deletion' | 'modification' | 'major' | 'minor'
	impact?: 'low' | 'medium' | 'high' | 'critical'
	stats?: {
		additions: number
		deletions: number
		modifications: number
	}
	tags?: string[]
	link?: string
}

interface PremiumTimelineProps {
	events: TimelineEvent[]
	onEventClick?: (event: TimelineEvent) => void
	showStats?: boolean
	condensed?: boolean
}

export function PremiumTimeline({
	events,
	onEventClick,
	showStats = true,
	condensed = false,
}: PremiumTimelineProps) {
	const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())

	const toggleEvent = (eventId: string) => {
		const newExpanded = new Set(expandedEvents)
		if (newExpanded.has(eventId)) {
			newExpanded.delete(eventId)
		} else {
			newExpanded.add(eventId)
		}
		setExpandedEvents(newExpanded)
	}

	const getEventIcon = (type: string) => {
		switch (type) {
			case 'major':
				return <AlertCircle className="h-4 w-4" />
			case 'addition':
				return <TrendingUp className="h-4 w-4" />
			case 'deletion':
				return <TrendingDown className="h-4 w-4" />
			default:
				return <Minus className="h-4 w-4" />
		}
	}

	const getEventColor = (type: string) => {
		switch (type) {
			case 'major':
				return 'bg-destructive text-destructive-foreground'
			case 'addition':
				return 'bg-[hsl(var(--success))] text-white'
			case 'deletion':
				return 'bg-[hsl(var(--warning))] text-white'
			case 'modification':
				return 'bg-primary text-primary-foreground'
			default:
				return 'bg-muted text-muted-foreground'
		}
	}

	const getImpactBadge = (impact?: string) => {
		if (!impact) return null
		
		const variants = {
			low: 'success',
			medium: 'warning',
			high: 'destructive',
			critical: 'destructive'
		} as const

		return (
			<PremiumBadge
				variant={variants[impact as keyof typeof variants]}
				size="sm"
				pulse={impact === 'critical'}
			>
				{impact} impact
			</PremiumBadge>
		)
	}

	const formatDate = (date: Date) => {
		const now = new Date()
		const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
		
		if (diffInDays === 0) return 'Today'
		if (diffInDays === 1) return 'Yesterday'
		if (diffInDays < 7) return `${diffInDays} days ago`
		if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`
		if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`
		
		return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
	}

	if (condensed) {
		return (
			<div className="space-y-2">
				{events.map((event) => (
					<PremiumCard
						key={event.id}
						variant="outlined"
						padding="sm"
						hover
						className="cursor-pointer"
						onClick={() => onEventClick?.(event)}
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className={cn("p-1.5 rounded-full", getEventColor(event.type))}>
									{getEventIcon(event.type)}
								</div>
								<div>
									<p className="font-medium text-sm">{event.title}</p>
									<p className="text-xs text-muted-foreground">{formatDate(event.date)}</p>
								</div>
							</div>
							{getImpactBadge(event.impact)}
						</div>
					</PremiumCard>
				))}
			</div>
		)
	}

	return (
		<div className="relative">
			<div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
			
			<div className="space-y-6">
				{events.map((event, index) => {
					const isExpanded = expandedEvents.has(event.id)
					
					return (
						<div key={event.id} className="relative flex gap-4">
							<div
								className={cn(
									"relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 border-background shadow-md transition-transform hover:scale-110",
									getEventColor(event.type)
								)}
							>
								{getEventIcon(event.type)}
							</div>
							
							<PremiumCard
								variant="glass"
								className="flex-1 cursor-pointer hover-lift"
								onClick={() => toggleEvent(event.id)}
							>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-1">
											<h3 className="font-semibold">{event.title}</h3>
											{getImpactBadge(event.impact)}
										</div>
										
										<div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
											<div className="flex items-center gap-1">
												<Calendar className="h-3 w-3" />
												{event.date.toLocaleDateString()}
											</div>
											<div className="flex items-center gap-1">
												<Clock className="h-3 w-3" />
												{formatDate(event.date)}
											</div>
										</div>
										
										{event.description && isExpanded && (
											<p className="text-sm text-muted-foreground mb-3 animate-fade-in">
												{event.description}
											</p>
										)}
										
										{showStats && event.stats && (
											<div className="flex items-center gap-3 mb-2">
												<PremiumBadge variant="success" size="sm">
													+{event.stats.additions}
												</PremiumBadge>
												<PremiumBadge variant="destructive" size="sm">
													-{event.stats.deletions}
												</PremiumBadge>
												<PremiumBadge variant="warning" size="sm">
													~{event.stats.modifications}
												</PremiumBadge>
											</div>
										)}
										
										{event.tags && event.tags.length > 0 && (
											<div className="flex flex-wrap gap-1 mt-2">
												{event.tags.map((tag) => (
													<PremiumBadge key={tag} variant="outline" size="sm">
														{tag}
													</PremiumBadge>
												))}
											</div>
										)}
									</div>
									
									{event.link && (
										<Button
											variant="ghost"
											size="sm"
											onClick={(e) => {
												e.stopPropagation()
												onEventClick?.(event)
											}}
										>
											View Details
										</Button>
									)}
								</div>
							</PremiumCard>
						</div>
					)
				})}
			</div>
		</div>
	)
}