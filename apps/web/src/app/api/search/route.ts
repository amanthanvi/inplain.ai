import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { SearchService, type SearchFilters } from '@/lib/search-service'
import { getCompanies, getLatestDiffs } from '@/lib/api'
import type { DiffMeta, Summary } from '@policydiff/shared'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url)
		
		// Parse search parameters
		const filters: SearchFilters = {
			query: searchParams.get('q') || undefined,
			companies: searchParams.get('companies')?.split(',').filter(Boolean),
			changeTypes: searchParams.get('changeTypes')?.split(',').filter(Boolean) as any,
			riskLevels: searchParams.get('riskLevels')?.split(',').filter(Boolean) as any,
			categories: searchParams.get('categories')?.split(',').filter(Boolean),
			minChanges: searchParams.get('minChanges') ? parseInt(searchParams.get('minChanges')!) : undefined,
			maxChanges: searchParams.get('maxChanges') ? parseInt(searchParams.get('maxChanges')!) : undefined,
		}

		// Parse date range
		const startDate = searchParams.get('startDate')
		const endDate = searchParams.get('endDate')
		if (startDate && endDate) {
			filters.dateRange = {
				start: new Date(startDate),
				end: new Date(endDate)
			}
		}

		// Check cache
		const cacheKey = `search:${JSON.stringify(filters)}`
		const cached = await kv.get(cacheKey)
		if (cached) {
			return NextResponse.json(cached)
		}

		// Initialize search service
		const searchService = new SearchService()

		// Fetch data to build index
		const companies = await getCompanies()
		
		// Fetch recent diffs for all companies
		const allDiffs: Array<DiffMeta & { summary?: Summary }> = []
		for (const company of companies) {
			const diffs = await getLatestDiffs(company.slug, 20)
			
			// Enhance with summaries if available
			const enhancedDiffs = await Promise.all(
				diffs.map(async (diff) => {
					if (diff.summaryId) {
						try {
							const summaryResponse = await fetch(
								`${process.env.NEXT_PUBLIC_API_URL || ''}/api/summary/${company.slug}`,
								{
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ diffId: diff.id })
								}
							)
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
			
			allDiffs.push(...enhancedDiffs)
		}

		// Build search index
		await searchService.buildIndex(companies, allDiffs)

		// Perform search
		const results = await searchService.search(filters)

		// Get suggestions if query provided
		const suggestions = filters.query ? searchService.getSuggestions(filters.query) : []

		const response = {
			results,
			suggestions,
			total: results.length,
			query: filters.query || '',
			filters: Object.keys(filters).filter(k => k !== 'query' && filters[k as keyof SearchFilters])
		}

		// Cache for 5 minutes
		await kv.set(cacheKey, response, { ex: 300 })

		return NextResponse.json(response)

	} catch (error) {
		console.error('Search API error:', error)
		return NextResponse.json(
			{ error: 'Search failed', results: [], suggestions: [] },
			{ status: 500 }
		)
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json()
		const { action, data } = body

		switch (action) {
			case 'export':
				const searchService = new SearchService()
				const exportData = await searchService.exportResults(
					data.results,
					data.format || 'json'
				)
				
				return new NextResponse(exportData, {
					headers: {
						'Content-Type': data.format === 'csv' ? 'text/csv' : 'application/json',
						'Content-Disposition': `attachment; filename="search-results.${data.format || 'json'}"`
					}
				})

			case 'saveSearch':
				// Save search to user's saved searches (would require auth)
				const savedSearchKey = `saved-search:${data.userId}:${Date.now()}`
				await kv.set(savedSearchKey, {
					query: data.query,
					filters: data.filters,
					name: data.name,
					createdAt: new Date().toISOString()
				})
				
				return NextResponse.json({ success: true })

			default:
				return NextResponse.json(
					{ error: 'Invalid action' },
					{ status: 400 }
				)
		}

	} catch (error) {
		console.error('Search API error:', error)
		return NextResponse.json(
			{ error: 'Request failed' },
			{ status: 500 }
		)
	}
}