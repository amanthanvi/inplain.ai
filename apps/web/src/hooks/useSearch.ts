import { useState, useCallback } from 'react'
import type { SearchFilters, SearchResult } from '@/lib/search-service'

interface UseSearchOptions {
	debounceMs?: number
	cacheResults?: boolean
}

interface UseSearchReturn {
	results: SearchResult[]
	suggestions: string[]
	isSearching: boolean
	error: string | null
	search: (filters: SearchFilters) => Promise<void>
	clearResults: () => void
}

export function useSearch(_options: UseSearchOptions = {}): UseSearchReturn {
	
	const [results, setResults] = useState<SearchResult[]>([])
	const [suggestions, setSuggestions] = useState<string[]>([])
	const [isSearching, setIsSearching] = useState(false)
	const [error, setError] = useState<string | null>(null)
	
	const search = useCallback(async (filters: SearchFilters) => {
		setIsSearching(true)
		setError(null)
		
		try {
			// Build query string
			const params = new URLSearchParams()
			
			if (filters.query) params.append('q', filters.query)
			if (filters.companies?.length) params.append('companies', filters.companies.join(','))
			if (filters.changeTypes?.length) params.append('changeTypes', filters.changeTypes.join(','))
			if (filters.riskLevels?.length) params.append('riskLevels', filters.riskLevels.join(','))
			if (filters.categories?.length) params.append('categories', filters.categories.join(','))
			if (filters.minChanges) params.append('minChanges', filters.minChanges.toString())
			if (filters.maxChanges) params.append('maxChanges', filters.maxChanges.toString())
			if (filters.dateRange) {
				params.append('startDate', filters.dateRange.start.toISOString())
				params.append('endDate', filters.dateRange.end.toISOString())
			}
			
			const response = await fetch(`/api/search?${params.toString()}`)
			
			if (!response.ok) {
				throw new Error('Search failed')
			}
			
			const data = await response.json()
			setResults(data.results || [])
			setSuggestions(data.suggestions || [])
			
		} catch (err) {
			console.error('Search error:', err)
			setError(err instanceof Error ? err.message : 'Search failed')
			setResults([])
			setSuggestions([])
		} finally {
			setIsSearching(false)
		}
	}, [])
	
	const clearResults = useCallback(() => {
		setResults([])
		setSuggestions([])
		setError(null)
	}, [])
	
	return {
		results,
		suggestions,
		isSearching,
		error,
		search,
		clearResults
	}
}