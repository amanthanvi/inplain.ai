'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, Filter, Download, Maximize2, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PremiumCard, PremiumCardContent, PremiumCardHeader, PremiumCardTitle } from '@/components/ui/premium-card'
import { PremiumBadge } from '@/components/ui/premium-badge'
import { PremiumTooltip } from '@/components/ui/premium-tooltip'
import { PremiumProgress } from '@/components/ui/premium-progress'

export interface DiffLine {
	type: 'addition' | 'deletion' | 'context' | 'modification'
	content: string
	lineNumber?: number
	metadata?: {
		severity?: 'low' | 'medium' | 'high' | 'critical'
		category?: string
		explanation?: string
	}
}

export interface DiffSection {
	id: string
	title: string
	changes: DiffLine[]
	collapsed?: boolean
	summary?: string
	impact?: 'low' | 'medium' | 'high' | 'critical'
}

interface PremiumDiffViewerProps {
	sections: DiffSection[]
	onSectionToggle?: (sectionId: string) => void
	searchEnabled?: boolean
	filterEnabled?: boolean
	exportEnabled?: boolean
	fullscreenEnabled?: boolean
}

export function PremiumDiffViewer({
	sections,
	onSectionToggle,
	searchEnabled = true,
	filterEnabled = true,
	exportEnabled = true,
	fullscreenEnabled = true,
}: PremiumDiffViewerProps) {
	const [searchQuery, setSearchQuery] = useState('')
	const [showSearch, setShowSearch] = useState(false)
	const [showFilters, setShowFilters] = useState(false)
	const [selectedFilters, setSelectedFilters] = useState<string[]>([])
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
	const [hiddenLineTypes, setHiddenLineTypes] = useState<Set<string>>(new Set())

	const stats = useMemo(() => {
		let additions = 0
		let deletions = 0
		let modifications = 0

		sections.forEach(section => {
			section.changes.forEach(change => {
				if (change.type === 'addition') additions++
				else if (change.type === 'deletion') deletions++
				else if (change.type === 'modification') modifications++
			})
		})

		return { additions, deletions, modifications, total: additions + deletions + modifications }
	}, [sections])

	const filteredSections = useMemo(() => {
		return sections.map(section => ({
			...section,
			changes: section.changes.filter(change => {
				if (hiddenLineTypes.has(change.type)) return false
				if (searchQuery && !change.content.toLowerCase().includes(searchQuery.toLowerCase())) return false
				return true
			})
		})).filter(section => section.changes.length > 0)
	}, [sections, searchQuery, hiddenLineTypes])

	const toggleSection = (sectionId: string) => {
		const newCollapsed = new Set(collapsedSections)
		if (newCollapsed.has(sectionId)) {
			newCollapsed.delete(sectionId)
		} else {
			newCollapsed.add(sectionId)
		}
		setCollapsedSections(newCollapsed)
		onSectionToggle?.(sectionId)
	}

	const toggleLineType = (type: string) => {
		const newHidden = new Set(hiddenLineTypes)
		if (newHidden.has(type)) {
			newHidden.delete(type)
		} else {
			newHidden.add(type)
		}
		setHiddenLineTypes(newHidden)
	}

	const getImpactColor = (impact?: string) => {
		switch (impact) {
			case 'low': return 'text-[hsl(var(--risk-low))]'
			case 'medium': return 'text-[hsl(var(--risk-medium))]'
			case 'high': return 'text-[hsl(var(--risk-high))]'
			case 'critical': return 'text-[hsl(var(--risk-critical))]'
			default: return 'text-muted-foreground'
		}
	}

	const getLineIcon = (type: string) => {
		switch (type) {
			case 'addition': return '+'
			case 'deletion': return '-'
			case 'modification': return '~'
			default: return ' '
		}
	}

	return (
		<div className={cn("relative", isFullscreen && "fixed inset-0 z-50 bg-background p-8")}>
			<PremiumCard variant="glass" className="h-full">
				<PremiumCardHeader className="border-b border-border/50 pb-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<PremiumCardTitle>Policy Changes</PremiumCardTitle>
							<div className="flex items-center gap-2">
								<PremiumBadge variant="success" size="sm">
									+{stats.additions}
								</PremiumBadge>
								<PremiumBadge variant="destructive" size="sm">
									-{stats.deletions}
								</PremiumBadge>
								<PremiumBadge variant="warning" size="sm">
									~{stats.modifications}
								</PremiumBadge>
							</div>
						</div>
						<div className="flex items-center gap-2">
							{searchEnabled && (
								<PremiumTooltip content="Search changes">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setShowSearch(!showSearch)}
										className={cn(showSearch && "bg-accent")}
									>
										<Search className="h-4 w-4" />
									</Button>
								</PremiumTooltip>
							)}
							{filterEnabled && (
								<PremiumTooltip content="Filter changes">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setShowFilters(!showFilters)}
										className={cn(showFilters && "bg-accent")}
									>
										<Filter className="h-4 w-4" />
									</Button>
								</PremiumTooltip>
							)}
							{exportEnabled && (
								<PremiumTooltip content="Export diff">
									<Button variant="ghost" size="icon">
										<Download className="h-4 w-4" />
									</Button>
								</PremiumTooltip>
							)}
							{fullscreenEnabled && (
								<PremiumTooltip content={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setIsFullscreen(!isFullscreen)}
									>
										<Maximize2 className="h-4 w-4" />
									</Button>
								</PremiumTooltip>
							)}
						</div>
					</div>

					{(showSearch || showFilters) && (
						<div className="mt-4 space-y-3 animate-slide-up">
							{showSearch && (
								<input
									type="text"
									placeholder="Search changes..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus-ring"
								/>
							)}
							{showFilters && (
								<div className="flex items-center gap-2">
									<span className="text-sm text-muted-foreground">Show:</span>
									{['addition', 'deletion', 'modification', 'context'].map(type => (
										<Button
											key={type}
											variant={hiddenLineTypes.has(type) ? "outline" : "secondary"}
											size="sm"
											onClick={() => toggleLineType(type)}
											className="gap-1"
										>
											{hiddenLineTypes.has(type) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
											{type}
										</Button>
									))}
								</div>
							)}
						</div>
					)}

					<div className="mt-4">
						<PremiumProgress
							value={stats.additions + stats.modifications}
							max={stats.total}
							variant="gradient"
							size="sm"
							showLabel
						/>
					</div>
				</PremiumCardHeader>

				<PremiumCardContent className="p-0 overflow-auto" style={{ maxHeight: isFullscreen ? 'calc(100vh - 200px)' : '600px' }}>
					{filteredSections.map((section) => (
						<div key={section.id} className="border-b border-border/30 last:border-0">
							<button
								onClick={() => toggleSection(section.id)}
								className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
							>
								<div className="flex items-center gap-3">
									{collapsedSections.has(section.id) ? (
										<ChevronRight className="h-4 w-4" />
									) : (
										<ChevronDown className="h-4 w-4" />
									)}
									<span className="font-medium">{section.title}</span>
									{section.impact && (
										<PremiumBadge
											variant="outline"
											size="sm"
											className={getImpactColor(section.impact)}
										>
											{section.impact} impact
										</PremiumBadge>
									)}
									<span className="text-sm text-muted-foreground">
										({section.changes.length} changes)
									</span>
								</div>
								{section.summary && (
									<span className="text-sm text-muted-foreground max-w-md truncate">
										{section.summary}
									</span>
								)}
							</button>

							{!collapsedSections.has(section.id) && (
								<div className="px-4 pb-4 animate-accordion-down">
									<div className="rounded-lg bg-muted/20 p-3 font-mono text-sm">
										{section.changes.map((change, idx) => (
											<div
												key={idx}
												className={cn(
													"flex items-start gap-3 py-1 px-2 rounded transition-colors",
													change.type === 'addition' && "bg-[hsl(var(--diff-addition-bg)/0.5)] hover:bg-[hsl(var(--diff-addition-bg))]",
													change.type === 'deletion' && "bg-[hsl(var(--diff-deletion-bg)/0.5)] hover:bg-[hsl(var(--diff-deletion-bg))]",
													change.type === 'modification' && "bg-[hsl(var(--diff-modification-bg)/0.5)] hover:bg-[hsl(var(--diff-modification-bg))]"
												)}
											>
												<span className={cn(
													"select-none font-bold",
													change.type === 'addition' && "text-[hsl(var(--diff-addition))]",
													change.type === 'deletion' && "text-[hsl(var(--diff-deletion))]",
													change.type === 'modification' && "text-[hsl(var(--diff-modification))]",
													change.type === 'context' && "text-muted-foreground"
												)}>
													{getLineIcon(change.type)}
												</span>
												<span className="flex-1 break-all">
													<span className={cn(
														change.type === 'deletion' && "line-through opacity-70"
													)}>
														{change.content}
													</span>
													{change.metadata?.explanation && (
														<PremiumTooltip content={change.metadata.explanation}>
															<span className="ml-2 text-xs text-muted-foreground cursor-help">
																[?]
															</span>
														</PremiumTooltip>
													)}
												</span>
												{change.lineNumber && (
													<span className="text-xs text-muted-foreground">
														L{change.lineNumber}
													</span>
												)}
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					))}
				</PremiumCardContent>
			</PremiumCard>
		</div>
	)
}