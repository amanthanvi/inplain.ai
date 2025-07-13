'use client'

import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Building2, FileText, Clock, TrendingUp, AlertTriangle, 
  Shield, ChevronRight, Filter, Sparkles
} from 'lucide-react'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'
import { AnimatedContainer } from '@/components/ui/animations'
import { formatDuration, getTimeDiff } from '@inplain.ai/shared/utils'

interface SearchResult {
  type: 'company' | 'policy' | 'change' | 'insight'
  id: string
  title: string
  description: string
  url: string
  metadata: {
    company?: string
    category?: string
    riskLevel?: string
    changeType?: string
    date?: string
    relevanceScore?: number
  }
}

// Memoized search result item component
const SearchResultItem = memo(({ 
  result, 
  index, 
  getIcon, 
  getRiskBadgeVariant 
}: {
  result: SearchResult
  index: number
  getIcon: (type: string) => any
  getRiskBadgeVariant: (risk?: string) => any
}) => {
  const Icon = getIcon(result.type)
  
  return (
    <AnimatedContainer
      animation="slideUp"
      delay={Math.min(index * 0.05, 0.5)} // Cap animation delay
    >
      <Link href={result.url}>
        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  result.type === 'insight' ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  <Icon className={`h-5 w-5 ${
                    result.type === 'insight' ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                </div>
                
                <div className="flex-1">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {result.title}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {result.description}
                  </CardDescription>
                  
                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {result.metadata.company && (
                      <Badge variant="outline">
                        <Building2 className="h-3 w-3 mr-1" />
                        {result.metadata.company}
                      </Badge>
                    )}
                    
                    {result.metadata.category && (
                      <Badge variant="secondary">
                        {result.metadata.category.replace('-', ' ')}
                      </Badge>
                    )}
                    
                    {result.metadata.changeType && (
                      <Badge variant={getRiskBadgeVariant(result.metadata.riskLevel)}>
                        {result.metadata.changeType} change
                      </Badge>
                    )}
                    
                    {result.metadata.riskLevel && (
                      <Badge variant={getRiskBadgeVariant(result.metadata.riskLevel)}>
                        {result.metadata.riskLevel} risk
                      </Badge>
                    )}
                    
                    {result.metadata.date && (
                      <span className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatDuration(getTimeDiff(result.metadata.date))} ago
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </CardHeader>
        </Card>
      </Link>
    </AnimatedContainer>
  )
})

SearchResultItem.displayName = 'SearchResultItem'

export function SearchResults() {
  const searchParams = useSearchParams()
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  
  const query = searchParams.get('q') || ''
  const categories = searchParams.get('categories')?.split(',') || []
  const riskLevels = searchParams.get('risks')?.split(',') || []
  const timeRange = searchParams.get('time') || 'all'
  const changeTypes = searchParams.get('changes')?.split(',') || []
  const sortBy = searchParams.get('sort') || 'relevance'
  
  // Debounce search query to reduce API calls
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    performSearch()
  }, [debouncedQuery, categories, riskLevels, timeRange, changeTypes, sortBy])

  const performSearch = async () => {
    if (!debouncedQuery && !categories.length && !riskLevels.length && !changeTypes.length) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    
    try {
      // Call the real search API
      const response = await fetch('/api/search/policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: debouncedQuery,
          companies: categories.length > 0 ? categories : [],
          policyTypes: [],
          dateRange: timeRange !== 'all' ? {
            start: new Date(Date.now() - (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          } : undefined,
          limit: 50,
          offset: 0
        })
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`)
      }

      const searchData = await response.json()
      
      // Transform API response to match our SearchResult interface
      const transformedResults: SearchResult[] = []
      
      // The API returns { results: PolicySearchResult[], total, offset, limit, query }
      if (searchData.results && Array.isArray(searchData.results)) {
        searchData.results.forEach((result: any) => {
          if (result.type === 'policy') {
            transformedResults.push({
              type: 'policy',
              id: result.id,
              title: result.title,
              description: result.excerpt,
              url: `/${result.companySlug}`,
              metadata: {
                company: result.companyName,
                category: 'privacy-policy',
                date: result.metadata.lastUpdated,
                relevanceScore: result.score / 100 // Normalize score
              }
            })
          } else if (result.type === 'change') {
            transformedResults.push({
              type: 'change',
              id: result.id,
              title: result.title,
              description: result.excerpt,
              url: `/${result.companySlug}/changes`,
              metadata: {
                company: result.companyName,
                changeType: result.metadata.changeType,
                riskLevel: result.metadata.riskLevel,
                date: result.metadata.changeDate,
                relevanceScore: result.score / 100 // Normalize score
              }
            })
          }
        })
      }
      
      // Add company results if no policy results found but query matches company names
      if (transformedResults.length === 0 && debouncedQuery) {
        const matchingCompanies = WATCHED_COMPANIES.filter(company => 
          company.name.toLowerCase().includes(debouncedQuery.toLowerCase())
        ).slice(0, 5)
        
        matchingCompanies.forEach(company => {
          transformedResults.push({
            type: 'company',
            id: company.slug,
            title: company.name,
            description: `Monitor privacy policy changes for ${company.name}`,
            url: `/${company.slug}`,
            metadata: {
              category: company.category,
              relevanceScore: 0.8
            }
          })
        })
      }

      // Sort results by relevance score or date
      const sortedResults = transformedResults.sort((a, b) => {
        if (sortBy === 'relevance') {
          return (b.metadata.relevanceScore || 0) - (a.metadata.relevanceScore || 0)
        } else if (sortBy === 'date') {
          const dateA = new Date(a.metadata.date || 0).getTime()
          const dateB = new Date(b.metadata.date || 0).getTime()
          return dateB - dateA
        }
        return 0
      })

      setResults(sortedResults)
    } catch (error) {
      console.error('Search failed:', error)
      
      // On error, show a limited company search as fallback
      if (debouncedQuery) {
        const fallbackResults = WATCHED_COMPANIES
          .filter(company => {
            if (!company.name.toLowerCase().includes(debouncedQuery.toLowerCase())) {
              return false
            }
            if (categories.length && !categories.includes(company.category || '')) {
              return false
            }
            return true
          })
          .slice(0, 3)
          .map(company => ({
            type: 'company' as const,
            id: company.slug,
            title: company.name,
            description: `Search unavailable. Browse ${company.name} privacy policy directly.`,
            url: `/${company.slug}`,
            metadata: {
              category: company.category,
              relevanceScore: company.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ? 1 : 0.5
            }
          }))
        
        setResults(fallbackResults)
      } else {
        setResults([])
      }
    } finally {
      setLoading(false)
    }
  }

  const getIcon = useCallback((type: string) => {
    switch (type) {
      case 'company': return Building2
      case 'policy': return FileText
      case 'change': return AlertTriangle
      case 'insight': return Sparkles
      default: return FileText
    }
  }, [])

  const getRiskBadgeVariant = useCallback((risk?: string) => {
    switch (risk) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'warning'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }, [])

  const filteredResults = useMemo(() => {
    return activeTab === 'all' 
      ? results 
      : results.filter(r => r.type === activeTab)
  }, [activeTab, results])

  return (
    <div className="max-w-4xl mx-auto">
      {/* Results Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">
              {loading ? 'Searching...' : `${results.length} results`}
              {query && <span className="font-normal text-muted-foreground"> for "{query}"</span>}
            </h2>
            {!loading && results.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Showing {filteredResults.length} of {results.length} results
              </p>
            )}
          </div>
          
          {results.length > 0 && (
            <Badge variant="outline">
              <Filter className="h-3 w-3 mr-1" />
              {sortBy === 'relevance' ? 'Most Relevant' : 'Most Recent'}
            </Badge>
          )}
        </div>

        {/* Result Type Tabs */}
        {results.length > 0 && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">
                All ({results.length})
              </TabsTrigger>
              <TabsTrigger value="company">
                Companies ({useMemo(() => results.filter(r => r.type === 'company').length, [results])})
              </TabsTrigger>
              <TabsTrigger value="change">
                Changes ({useMemo(() => results.filter(r => r.type === 'change').length, [results])})
              </TabsTrigger>
              <TabsTrigger value="insight">
                Insights ({useMemo(() => results.filter(r => r.type === 'insight').length, [results])})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Results List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredResults.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No results found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms or filters
            </p>
          </CardContent>
        </Card>
      ) : (
        <AnimatedContainer animation="fade" className="space-y-4">
          {filteredResults.map((result, index) => (
            <SearchResultItem
              key={result.id}
              result={result}
              index={index}
              getIcon={getIcon}
              getRiskBadgeVariant={getRiskBadgeVariant}
            />
          ))}
        </AnimatedContainer>
      )}

      {/* Load More */}
      {!loading && results.length > 10 && (
        <div className="text-center mt-8">
          <Button variant="outline">
            Load More Results
          </Button>
        </div>
      )}
    </div>
  )
}