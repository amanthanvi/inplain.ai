import type { Company, DiffMeta, Summary } from '@inplain.ai/shared'

export interface SearchFilters {
	query?: string
	companies?: string[]
	dateRange?: {
		start: Date
		end: Date
	}
	changeTypes?: ('minor' | 'moderate' | 'major')[]
	riskLevels?: ('low' | 'medium' | 'high')[]
	categories?: string[]
	minChanges?: number
	maxChanges?: number
}

export interface SearchResult {
	type: 'company' | 'diff' | 'insight'
	id: string
	title: string
	description: string
	metadata: {
		company?: string
		date?: Date
		changeType?: string
		riskLevel?: string
		score?: number
		highlights?: string[]
	}
	relevance: number
}

export interface SearchIndex {
	companies: Map<string, Company>
	diffs: Map<string, DiffMeta & { summary?: Summary }>
	lastUpdated: Date
}

export class SearchService {
	private index: SearchIndex | null = null
	private searchHistory: string[] = []
	private readonly maxHistorySize = 50

	async buildIndex(companies: Company[], diffs: Array<DiffMeta & { summary?: Summary }>): Promise<void> {
		this.index = {
			companies: new Map(companies.map(c => [c.slug, c])),
			diffs: new Map(diffs.map(d => [d.id, d])),
			lastUpdated: new Date()
		}
	}

	async search(filters: SearchFilters): Promise<SearchResult[]> {
		if (!this.index) {
			throw new Error('Search index not built')
		}

		let results: SearchResult[] = []

		// Add to search history
		if (filters.query) {
			this.addToHistory(filters.query)
		}

		// Search companies
		if (!filters.companies || filters.companies.length === 0) {
			results.push(...this.searchCompanies(filters))
		}

		// Search diffs
		results.push(...this.searchDiffs(filters))

		// Sort by relevance
		results.sort((a, b) => b.relevance - a.relevance)

		return results
	}

	private searchCompanies(filters: SearchFilters): SearchResult[] {
		const results: SearchResult[] = []
		const query = filters.query?.toLowerCase() || ''

		for (const company of this.index!.companies.values()) {
			let relevance = 0

			// Text matching
			if (query) {
				if (company.name.toLowerCase().includes(query)) {
					relevance += 10
				}
				if (company.slug.toLowerCase().includes(query)) {
					relevance += 5
				}
				if (company.category?.toLowerCase().includes(query)) {
					relevance += 3
				}
			} else {
				relevance = 1 // Base relevance for no query
			}

			if (relevance > 0) {
				results.push({
					type: 'company',
					id: company.slug,
					title: company.name,
					description: `Privacy policy tracking for ${company.name}`,
					metadata: {
						company: company.slug
					},
					relevance
				})
			}
		}

		return results
	}

	private searchDiffs(filters: SearchFilters): SearchResult[] {
		const results: SearchResult[] = []
		const query = filters.query?.toLowerCase() || ''

		for (const diff of this.index!.diffs.values()) {
			let relevance = 0
			let shouldInclude = true

			// Apply filters
			if (filters.companies && filters.companies.length > 0) {
				if (!filters.companies.includes(diff.slug)) {
					shouldInclude = false
				}
			}

			if (filters.dateRange) {
				const diffDate = new Date(diff.createdAt)
				if (diffDate < filters.dateRange.start || diffDate > filters.dateRange.end) {
					shouldInclude = false
				}
			}

			if (filters.changeTypes && filters.changeTypes.length > 0) {
				if (!filters.changeTypes.includes(diff.changeType)) {
					shouldInclude = false
				}
			}

			if (filters.riskLevels && filters.riskLevels.length > 0 && diff.summary) {
				if (!filters.riskLevels.includes(diff.summary.riskLevel)) {
					shouldInclude = false
				}
			}

			if (filters.categories && filters.categories.length > 0 && diff.summary) {
				const hasCategory = filters.categories.some(cat => 
					diff.summary!.categories.includes(cat as any)
				)
				if (!hasCategory) {
					shouldInclude = false
				}
			}

			if (filters.minChanges && diff.changeCount < filters.minChanges) {
				shouldInclude = false
			}

			if (filters.maxChanges && diff.changeCount > filters.maxChanges) {
				shouldInclude = false
			}

			if (!shouldInclude) continue

			// Calculate relevance
			if (query && diff.summary) {
				if (diff.summary.summary.toLowerCase().includes(query)) {
					relevance += 8
				}
				if (diff.summary.highlights.some(h => h.toLowerCase().includes(query))) {
					relevance += 6
				}
			}

			// Boost relevance for recent changes
			const daysSinceChange = (Date.now() - new Date(diff.createdAt).getTime()) / (1000 * 60 * 60 * 24)
			if (daysSinceChange < 7) relevance += 3
			else if (daysSinceChange < 30) relevance += 2
			else if (daysSinceChange < 90) relevance += 1

			// Boost for change severity
			if (diff.changeType === 'major') relevance += 3
			else if (diff.changeType === 'moderate') relevance += 2
			else relevance += 1

			// Boost for high risk
			if (diff.summary?.riskLevel === 'high') relevance += 2

			if (relevance > 0 || !query) {
				const company = this.index!.companies.get(diff.slug)
				results.push({
					type: 'diff',
					id: diff.id,
					title: `${company?.name || diff.slug} Policy Update`,
					description: diff.summary?.summary || `${diff.changeCount} changes detected`,
					metadata: {
						company: diff.slug,
						date: new Date(diff.createdAt),
						changeType: diff.changeType,
						riskLevel: diff.summary?.riskLevel,
						highlights: diff.summary?.highlights
					},
					relevance
				})
			}
		}

		return results
	}

	getSuggestions(query: string): string[] {
		const suggestions: Set<string> = new Set()
		const lowerQuery = query.toLowerCase()

		// Add from search history
		this.searchHistory
			.filter(h => h.toLowerCase().includes(lowerQuery) && h !== query)
			.forEach(h => suggestions.add(h))

		// Add company names
		if (this.index) {
			for (const company of this.index.companies.values()) {
				if (company.name.toLowerCase().includes(lowerQuery)) {
					suggestions.add(company.name)
				}
			}

			// Add common terms from summaries
			const commonTerms = ['data collection', 'privacy', 'cookies', 'third party', 'security', 'user rights']
			commonTerms
				.filter(term => term.includes(lowerQuery))
				.forEach(term => suggestions.add(term))
		}

		return Array.from(suggestions).slice(0, 10)
	}

	getSearchHistory(): string[] {
		return [...this.searchHistory]
	}

	clearSearchHistory(): void {
		this.searchHistory = []
	}

	private addToHistory(query: string): void {
		// Remove if already exists
		this.searchHistory = this.searchHistory.filter(q => q !== query)
		
		// Add to beginning
		this.searchHistory.unshift(query)
		
		// Trim to max size
		if (this.searchHistory.length > this.maxHistorySize) {
			this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize)
		}
	}

	async exportResults(results: SearchResult[], format: 'json' | 'csv' = 'json'): Promise<string> {
		if (format === 'json') {
			return JSON.stringify(results, null, 2)
		}

		// CSV format
		const headers = ['Type', 'Title', 'Description', 'Company', 'Date', 'Change Type', 'Risk Level', 'Relevance']
		const rows = results.map(r => [
			r.type,
			`"${r.title.replace(/"/g, '""')}"`,
			`"${r.description.replace(/"/g, '""')}"`,
			r.metadata.company || '',
			r.metadata.date?.toISOString() || '',
			r.metadata.changeType || '',
			r.metadata.riskLevel || '',
			r.relevance.toString()
		])

		return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
	}
}