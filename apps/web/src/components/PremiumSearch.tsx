'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, Calendar, Filter, TrendingUp, Building2, AlertCircle, Clock, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PremiumCard, PremiumCardContent } from '@/components/ui/premium-card'
import { PremiumBadge } from '@/components/ui/premium-badge'
import { SearchService, type SearchFilters, type SearchResult } from '@/lib/search-service'
import { format } from 'date-fns'

interface PremiumSearchProps {
	onResultClick?: (result: SearchResult) => void
	className?: string
	placeholder?: string
	showFilters?: boolean
	autoFocus?: boolean
}

export function PremiumSearch({
	onResultClick,
	className,
	placeholder = "Search companies, policies, or changes...",
	showFilters = true,
	autoFocus = false
}: PremiumSearchProps) {
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<SearchResult[]>([])
	const [suggestions, setSuggestions] = useState<string[]>([])
	const [isSearching, setIsSearching] = useState(false)
	const [showResults, setShowResults] = useState(false)
	const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
	const [recentSearches, setRecentSearches] = useState<string[]>([])
	
	const [filters, setFilters] = useState<SearchFilters>({})
	
	const searchService = useRef(new SearchService())
	const searchTimeout = useRef<NodeJS.Timeout>()
	const containerRef = useRef<HTMLDivElement>(null)

	// Initialize search service
	useEffect(() => {
		const initSearch = async () => {
			// In a real app, this would fetch from API
			const companies = [
				{ slug: 'google', name: 'Google', url: 'https://policies.google.com/privacy', active: true, checkInterval: 86400 },
				{ slug: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/privacy/policy', active: true, checkInterval: 86400 },
				{ slug: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496', active: true, checkInterval: 86400 },
			]
			
			await searchService.current.buildIndex(companies, [])
			setRecentSearches(searchService.current.getSearchHistory())
		}
		
		initSearch()
	}, [])

	// Handle click outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setShowResults(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const performSearch = useCallback(async () => {
		setIsSearching(true)
		
		try {
			const searchFilters: SearchFilters = {
				...filters,
				query: query.trim()
			}
			
			const searchResults = await searchService.current.search(searchFilters)
			setResults(searchResults)
			setShowResults(true)
			
			// Update suggestions
			if (query.length > 1) {
				const newSuggestions = searchService.current.getSuggestions(query)
				setSuggestions(newSuggestions)
			}
		} catch (error) {
			console.error('Search error:', error)
			setResults([])
		} finally {
			setIsSearching(false)
		}
	}, [query, filters])

	const handleInputChange = (value: string) => {
		setQuery(value)
		
		// Clear existing timeout
		if (searchTimeout.current) {
			clearTimeout(searchTimeout.current)
		}
		
		// Debounce search
		if (value.trim()) {
			searchTimeout.current = setTimeout(() => {
				performSearch()
			}, 300)
		} else {
			setResults([])
			setSuggestions([])
			setShowResults(false)
		}
	}

	const handleResultClick = (result: SearchResult) => {
		setShowResults(false)
		onResultClick?.(result)
	}

	const handleSuggestionClick = (suggestion: string) => {
		setQuery(suggestion)
		performSearch()
	}

	const clearSearch = () => {
		setQuery('')
		setResults([])
		setSuggestions([])
		setShowResults(false)
		setFilters({})
	}

	const getResultIcon = (type: string) => {
		switch (type) {
			case 'company':
				return <Building2 className="h-4 w-4" />
			case 'diff':
				return <TrendingUp className="h-4 w-4" />
			case 'insight':
				return <AlertCircle className="h-4 w-4" />
			default:
				return <Search className="h-4 w-4" />
		}
	}

	const formatDate = (date: Date) => {
		return format(date, 'MMM d, yyyy')
	}

	return (
		<div ref={containerRef} className={cn("relative", className)}>
			{/* Search Input */}
			<div className="relative">
				<div className="relative flex items-center">
					<Search className="absolute left-3 h-5 w-5 text-muted-foreground pointer-events-none" />
					<input
						type="text"
						value={query}
						onChange={(e) => handleInputChange(e.target.value)}
						placeholder={placeholder}
						autoFocus={autoFocus}
						className={cn(
							"w-full pl-10 pr-20 py-3 text-sm bg-background border border-input rounded-lg",
							"focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
							"placeholder:text-muted-foreground",
							showResults && "rounded-b-none"
						)}
						onFocus={() => query && setShowResults(true)}
					/>
					<div className="absolute right-2 flex items-center gap-1">
						{query && (
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								onClick={clearSearch}
							>
								<X className="h-4 w-4" />
							</Button>
						)}
						{showFilters && (
							<Button
								variant="ghost"
								size="icon"
								className={cn(
									"h-7 w-7",
									showAdvancedFilters && "bg-accent"
								)}
								onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
							>
								<Filter className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>

				{/* Loading indicator */}
				{isSearching && (
					<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/20">
						<div className="h-full bg-primary animate-pulse" />
					</div>
				)}
			</div>

			{/* Advanced Filters */}
			{showAdvancedFilters && (
				<PremiumCard variant="glass" className="mt-2 p-4 animate-slide-up">
					<div className="space-y-3">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
							{/* Date Range */}
							<div>
								<label className="text-sm font-medium mb-1 block">Date Range</label>
								<Button variant="outline" size="sm" className="w-full justify-start">
									<Calendar className="h-4 w-4 mr-2" />
									Last 30 days
									<ChevronDown className="h-4 w-4 ml-auto" />
								</Button>
							</div>

							{/* Change Type */}
							<div>
								<label className="text-sm font-medium mb-1 block">Change Type</label>
								<select
									className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md"
									onChange={(e) => setFilters({
										...filters,
										changeTypes: e.target.value ? [e.target.value as any] : undefined
									})}
								>
									<option value="">All Types</option>
									<option value="minor">Minor</option>
									<option value="moderate">Moderate</option>
									<option value="major">Major</option>
								</select>
							</div>

							{/* Risk Level */}
							<div>
								<label className="text-sm font-medium mb-1 block">Risk Level</label>
								<select
									className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md"
									onChange={(e) => setFilters({
										...filters,
										riskLevels: e.target.value ? [e.target.value as any] : undefined
									})}
								>
									<option value="">All Levels</option>
									<option value="low">Low</option>
									<option value="medium">Medium</option>
									<option value="high">High</option>
								</select>
							</div>
						</div>

						<div className="flex items-center justify-between">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setFilters({})}
							>
								Clear Filters
							</Button>
							<Button
								variant="premium"
								size="sm"
								onClick={performSearch}
							>
								Apply Filters
							</Button>
						</div>
					</div>
				</PremiumCard>
			)}

			{/* Search Results */}
			{showResults && (
				<PremiumCard
					variant="elevated"
					className="absolute top-full left-0 right-0 mt-1 max-h-96 overflow-auto z-50 rounded-t-none border-t-0"
				>
					<PremiumCardContent className="p-0">
						{/* Recent Searches */}
						{!query && recentSearches.length > 0 && (
							<div className="p-3 border-b border-border/50">
								<p className="text-xs font-medium text-muted-foreground mb-2">Recent Searches</p>
								<div className="flex flex-wrap gap-1">
									{recentSearches.slice(0, 5).map((search, idx) => (
										<Button
											key={idx}
											variant="ghost"
											size="sm"
											className="h-7 text-xs"
											onClick={() => handleSuggestionClick(search)}
										>
											<Clock className="h-3 w-3 mr-1" />
											{search}
										</Button>
									))}
								</div>
							</div>
						)}

						{/* Suggestions */}
						{suggestions.length > 0 && (
							<div className="p-3 border-b border-border/50">
								<p className="text-xs font-medium text-muted-foreground mb-2">Suggestions</p>
								<div className="space-y-1">
									{suggestions.map((suggestion, idx) => (
										<button
											key={idx}
											className="w-full text-left px-2 py-1 text-sm rounded hover:bg-accent hover:text-accent-foreground transition-colors"
											onClick={() => handleSuggestionClick(suggestion)}
										>
											{suggestion}
										</button>
									))}
								</div>
							</div>
						)}

						{/* Results */}
						{results.length > 0 ? (
							<div className="divide-y divide-border/50">
								{results.map((result) => (
									<button
										key={result.id}
										className="w-full p-4 text-left hover:bg-accent/50 transition-colors"
										onClick={() => handleResultClick(result)}
									>
										<div className="flex items-start gap-3">
											<div className={cn(
												"p-2 rounded-lg",
												result.type === 'company' && "bg-primary/10 text-primary",
												result.type === 'diff' && "bg-secondary/10 text-secondary",
												result.type === 'insight' && "bg-accent/10 text-accent-foreground"
											)}>
												{getResultIcon(result.type)}
											</div>
											<div className="flex-1 min-w-0">
												<h4 className="font-medium text-sm mb-1">{result.title}</h4>
												<p className="text-xs text-muted-foreground line-clamp-2">
													{result.description}
												</p>
												<div className="flex items-center gap-2 mt-2">
													{result.metadata.date && (
														<span className="text-xs text-muted-foreground">
															{formatDate(result.metadata.date)}
														</span>
													)}
													{result.metadata.changeType && (
														<PremiumBadge variant="outline" size="sm">
															{result.metadata.changeType}
														</PremiumBadge>
													)}
													{result.metadata.riskLevel && (
														<PremiumBadge
															variant={
																result.metadata.riskLevel === 'high' ? 'destructive' :
																result.metadata.riskLevel === 'medium' ? 'warning' : 'success'
															}
															size="sm"
														>
															{result.metadata.riskLevel} risk
														</PremiumBadge>
													)}
												</div>
											</div>
											<div className="text-xs text-muted-foreground">
												{Math.round(result.relevance * 10)}% match
											</div>
										</div>
									</button>
								))}
							</div>
						) : query && !isSearching ? (
							<div className="p-8 text-center">
								<Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
								<p className="text-sm text-muted-foreground">No results found for "{query}"</p>
								<p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or search terms</p>
							</div>
						) : null}
					</PremiumCardContent>
				</PremiumCard>
			)}
		</div>
	)
}