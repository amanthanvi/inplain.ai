'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import { SearchService, type SearchFilters, type SearchResult } from '@/lib/search-service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Search, X, Filter, Calendar as CalendarIcon, Building2, 
  FileText, AlertCircle, Clock, ChevronDown, Command,
  History, TrendingUp, ArrowRight
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

interface GlobalSearchProps {
  className?: string
  autoFocus?: boolean
  onResultClick?: (result: SearchResult) => void
  showInModal?: boolean
}

export function GlobalSearch({ 
  className, 
  autoFocus = false, 
  onResultClick,
  showInModal = false 
}: GlobalSearchProps) {
  const router = useRouter()
  const searchRef = useRef<HTMLInputElement>(null)
  const [searchService] = useState(() => new SearchService())
  
  // Search state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedResult, setSelectedResult] = useState(0)
  
  // Filter state
  const [filters, setFilters] = useState<SearchFilters>({
    companies: [],
    changeTypes: [],
    riskLevels: [],
    categories: []
  })
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  })
  
  const debouncedQuery = useDebounce(query, 300)

  // Initialize search index
  useEffect(() => {
    const initSearch = async () => {
      try {
        // In a real implementation, this would fetch from API
        await searchService.buildIndex(WATCHED_COMPANIES, [])
        setSearchHistory(searchService.getSearchHistory())
      } catch (error) {
        console.error('Failed to initialize search:', error)
      }
    }
    initSearch()
  }, [searchService])

  // Perform search
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery && filters.companies?.length === 0) {
        setResults([])
        setSuggestions([])
        return
      }

      setIsSearching(true)
      try {
        const searchFilters: SearchFilters = {
          ...filters,
          query: debouncedQuery,
          dateRange: dateRange.from && dateRange.to ? {
            start: dateRange.from,
            end: dateRange.to
          } : undefined
        }
        
        const searchResults = await searchService.search(searchFilters)
        setResults(searchResults)
        
        if (debouncedQuery) {
          setSuggestions(searchService.getSuggestions(debouncedQuery))
        }
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setIsSearching(false)
      }
    }

    performSearch()
  }, [debouncedQuery, filters, dateRange, searchService])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showInModal && (e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }

      if (document.activeElement === searchRef.current) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            setSelectedResult(prev => Math.min(prev + 1, results.length - 1))
            break
          case 'ArrowUp':
            e.preventDefault()
            setSelectedResult(prev => Math.max(prev - 1, 0))
            break
          case 'Enter':
            e.preventDefault()
            if (results[selectedResult]) {
              handleResultClick(results[selectedResult])
            }
            break
          case 'Escape':
            e.preventDefault()
            setQuery('')
            searchRef.current?.blur()
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [results, selectedResult, showInModal])

  const handleResultClick = useCallback((result: SearchResult) => {
    if (onResultClick) {
      onResultClick(result)
    } else {
      // Default navigation behavior
      switch (result.type) {
        case 'company':
          router.push(`/companies/${result.id}`)
          break
        case 'diff':
          router.push(`/companies/${result.metadata.company}/policies?diff=${result.id}`)
          break
        case 'insight':
          router.push(`/companies/${result.metadata.company}/analytics`)
          break
      }
    }
    
    // Clear search after navigation
    setQuery('')
    setResults([])
  }, [router, onResultClick])

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    searchRef.current?.focus()
  }

  const clearFilters = () => {
    setFilters({
      companies: [],
      changeTypes: [],
      riskLevels: [],
      categories: []
    })
    setDateRange({ from: undefined, to: undefined })
  }

  const hasActiveFilters = filters.companies?.length! > 0 || 
    filters.changeTypes?.length! > 0 || 
    filters.riskLevels?.length! > 0 ||
    filters.categories?.length! > 0 ||
    dateRange.from || dateRange.to

  return (
    <div className={cn("relative w-full", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          type="text"
          placeholder="Search policies, companies, or changes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-20"
          autoFocus={autoFocus}
        />
        
        {/* Action Buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery('')
                searchRef.current?.focus()
              }}
              className="h-7 w-7 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={hasActiveFilters ? "secondary" : "ghost"}
                className="h-7 px-2"
              >
                <Filter className="h-3 w-3 mr-1" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="default" className="ml-1 h-4 px-1 text-xs">
                    {(filters.companies?.length || 0) + 
                     (filters.changeTypes?.length || 0) + 
                     (filters.riskLevels?.length || 0) +
                     (dateRange.from ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Search Filters</h4>
                  {hasActiveFilters && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearFilters}
                      className="h-7 text-xs"
                    >
                      Clear all
                    </Button>
                  )}
                </div>

                {/* Company Filter */}
                <div className="space-y-2">
                  <Label className="text-xs">Companies</Label>
                  <ScrollArea className="h-32 rounded-md border p-2">
                    <div className="space-y-1">
                      {WATCHED_COMPANIES.map((company) => (
                        <div key={company.slug} className="flex items-center space-x-2">
                          <Checkbox
                            id={company.slug}
                            checked={filters.companies?.includes(company.slug)}
                            onCheckedChange={(checked) => {
                              setFilters(prev => ({
                                ...prev,
                                companies: checked
                                  ? [...(prev.companies || []), company.slug]
                                  : prev.companies?.filter(c => c !== company.slug) || []
                              }))
                            }}
                          />
                          <label
                            htmlFor={company.slug}
                            className="text-xs cursor-pointer flex-1"
                          >
                            {company.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Change Type Filter */}
                <div className="space-y-2">
                  <Label className="text-xs">Change Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['minor', 'moderate', 'major'] as const).map((type) => (
                      <Badge
                        key={type}
                        variant={filters.changeTypes?.includes(type) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setFilters(prev => ({
                            ...prev,
                            changeTypes: prev.changeTypes?.includes(type)
                              ? prev.changeTypes.filter(t => t !== type)
                              : [...(prev.changeTypes || []), type]
                          }))
                        }}
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Risk Level Filter */}
                <div className="space-y-2">
                  <Label className="text-xs">Risk Levels</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['low', 'medium', 'high'] as const).map((level) => (
                      <Badge
                        key={level}
                        variant={filters.riskLevels?.includes(level) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setFilters(prev => ({
                            ...prev,
                            riskLevels: prev.riskLevels?.includes(level)
                              ? prev.riskLevels.filter(l => l !== level)
                              : [...(prev.riskLevels || []), level]
                          }))
                        }}
                      >
                        {level}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="space-y-2">
                  <Label className="text-xs">Date Range</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} -{" "}
                              {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span className="text-muted-foreground">Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        selected={{ from: dateRange.from, to: dateRange.to }}
                        onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {!showInModal && (
            <kbd className="hidden sm:inline-flex h-7 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-[10px] font-medium text-muted-foreground">
              <Command className="h-3 w-3" />K
            </kbd>
          )}
        </div>
      </div>

      {/* Search Results */}
      {(query || hasActiveFilters) && (
        <Card className="absolute top-full mt-2 w-full z-50 shadow-lg">
          <CardContent className="p-0">
            {isSearching ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : results.length > 0 ? (
              <ScrollArea className="h-96">
                <div className="p-2">
                  {results.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className={cn(
                        "w-full text-left p-3 rounded-md transition-colors",
                        "hover:bg-muted focus:bg-muted focus:outline-none",
                        selectedResult === index && "bg-muted"
                      )}
                      onMouseEnter={() => setSelectedResult(index)}
                    >
                      <div className="flex items-start gap-3">
                        {result.type === 'company' && <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                        {result.type === 'diff' && <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                        {result.type === 'insight' && <TrendingUp className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                        
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{result.title}</span>
                            {result.metadata.changeType && (
                              <Badge variant="outline" className="text-xs">
                                {result.metadata.changeType}
                              </Badge>
                            )}
                            {result.metadata.riskLevel && (
                              <Badge 
                                variant={result.metadata.riskLevel === 'high' ? 'destructive' : 'secondary'} 
                                className="text-xs"
                              >
                                {result.metadata.riskLevel}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {result.description}
                          </p>
                          {result.metadata.date && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(result.metadata.date, 'MMM d, yyyy')}
                            </div>
                          )}
                          {result.metadata.highlights && result.metadata.highlights.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {result.metadata.highlights.slice(0, 3).map((highlight, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {highlight}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="p-8 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No results found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try adjusting your search or filters
                </p>
              </div>
            )}

            {/* Suggestions and History */}
            {!query && searchHistory.length > 0 && (
              <div className="border-t p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <History className="h-3 w-3" />
                  Recent searches
                </div>
                <div className="flex flex-wrap gap-1">
                  {searchHistory.slice(0, 5).map((term, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer text-xs"
                      onClick={() => handleSuggestionClick(term)}
                    >
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {query && suggestions.length > 0 && (
              <div className="border-t p-3">
                <div className="text-xs text-muted-foreground mb-2">Suggestions</div>
                <div className="flex flex-wrap gap-1">
                  {suggestions.map((suggestion, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer text-xs"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}