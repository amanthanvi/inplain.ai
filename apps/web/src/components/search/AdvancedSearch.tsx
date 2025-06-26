'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Filter, X, Sparkles, TrendingUp, Building2, Shield, Clock, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { motion, AnimatePresence } from 'framer-motion'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

interface SearchSuggestion {
  type: 'company' | 'category' | 'query' | 'ai'
  value: string
  label: string
  icon?: any
  metadata?: {
    count?: number
    trending?: boolean
    score?: number
  }
}

interface SearchFilters {
  categories: string[]
  riskLevels: string[]
  timeRange: string
  changeTypes: string[]
  sortBy: string
}

const defaultFilters: SearchFilters = {
  categories: [],
  riskLevels: [],
  timeRange: 'all',
  changeTypes: [],
  sortBy: 'relevance'
}

const categories = [
  'technology', 'social-media', 'e-commerce', 'entertainment', 
  'finance', 'gaming', 'travel', 'transportation', 'food-delivery',
  'healthcare', 'education', 'communication', 'productivity', 'news', 'dating'
]

const riskLevels = ['low', 'medium', 'high', 'critical']
const changeTypes = ['minor', 'moderate', 'major']
const timeRanges = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Past Week' },
  { value: 'month', label: 'Past Month' },
  { value: '3months', label: 'Past 3 Months' },
  { value: 'year', label: 'Past Year' },
  { value: 'all', label: 'All Time' }
]

export function AdvancedSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const debouncedQuery = useDebounce(query, 300)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load filters from URL
  useEffect(() => {
    const newFilters = { ...defaultFilters }
    
    const cats = searchParams.get('categories')
    if (cats) newFilters.categories = cats.split(',')
    
    const risks = searchParams.get('risks')
    if (risks) newFilters.riskLevels = risks.split(',')
    
    const time = searchParams.get('time')
    if (time) newFilters.timeRange = time
    
    const changes = searchParams.get('changes')
    if (changes) newFilters.changeTypes = changes.split(',')
    
    const sort = searchParams.get('sort')
    if (sort) newFilters.sortBy = sort
    
    setFilters(newFilters)
  }, [searchParams])

  // Generate suggestions based on query
  useEffect(() => {
    if (!debouncedQuery) {
      // Show trending/popular suggestions when empty
      setSuggestions([
        {
          type: 'query',
          value: 'data collection changes',
          label: 'Data collection changes',
          icon: TrendingUp,
          metadata: { trending: true }
        },
        {
          type: 'query',
          value: 'gdpr compliance',
          label: 'GDPR compliance updates',
          icon: Shield,
          metadata: { trending: true }
        },
        {
          type: 'query',
          value: 'ai data usage',
          label: 'AI data usage policies',
          icon: Sparkles,
          metadata: { trending: true }
        }
      ])
      return
    }

    const newSuggestions: SearchSuggestion[] = []

    // Company suggestions
    const matchingCompanies = WATCHED_COMPANIES
      .filter(company => 
        company.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        company.slug.toLowerCase().includes(debouncedQuery.toLowerCase())
      )
      .slice(0, 3)
      .map(company => ({
        type: 'company' as const,
        value: company.slug,
        label: company.name,
        icon: Building2,
        metadata: { count: Math.floor(Math.random() * 20) + 1 }
      }))

    newSuggestions.push(...matchingCompanies)

    // Category suggestions
    const matchingCategories = categories
      .filter(cat => cat.includes(debouncedQuery.toLowerCase()))
      .slice(0, 2)
      .map(cat => ({
        type: 'category' as const,
        value: cat,
        label: cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        metadata: { 
          count: WATCHED_COMPANIES.filter(c => c.category === cat).length 
        }
      }))

    newSuggestions.push(...matchingCategories)

    // AI-powered suggestions
    if (debouncedQuery.length > 3) {
      generateAISuggestions(debouncedQuery)
    }

    setSuggestions(newSuggestions)
  }, [debouncedQuery])

  const generateAISuggestions = async (searchQuery: string) => {
    setIsSearching(true)
    try {
      // In production, this would call an AI API
      // For now, simulate AI suggestions
      const aiSuggestions = [
        `Companies that ${searchQuery}`,
        `Recent ${searchQuery} policy changes`,
        `${searchQuery} compliance updates`
      ].filter(s => s.length < 50)
      
      setAiSuggestions(aiSuggestions)
      
      const aiSuggestionItems: SearchSuggestion[] = aiSuggestions.map(s => ({
        type: 'ai',
        value: s,
        label: s,
        icon: Sparkles,
        metadata: { score: Math.random() }
      }))
      
      setSuggestions(prev => [...prev, ...aiSuggestionItems])
    } catch (error) {
      console.error('Failed to generate AI suggestions:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearch = (searchQuery?: string) => {
    const finalQuery = searchQuery || query
    const params = new URLSearchParams()
    
    if (finalQuery) params.set('q', finalQuery)
    if (filters.categories.length) params.set('categories', filters.categories.join(','))
    if (filters.riskLevels.length) params.set('risks', filters.riskLevels.join(','))
    if (filters.timeRange !== 'all') params.set('time', filters.timeRange)
    if (filters.changeTypes.length) params.set('changes', filters.changeTypes.join(','))
    if (filters.sortBy !== 'relevance') params.set('sort', filters.sortBy)
    
    router.push(`/search?${params.toString()}`)
  }

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    switch (suggestion.type) {
      case 'company':
        router.push(`/${suggestion.value}`)
        break
      case 'category':
        router.push(`/companies?category=${suggestion.value}`)
        break
      case 'query':
      case 'ai':
        setQuery(suggestion.value)
        handleSearch(suggestion.value)
        break
    }
  }

  const toggleFilter = (type: keyof SearchFilters, value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      const array = newFilters[type] as string[]
      
      if (type === 'timeRange' || type === 'sortBy') {
        newFilters[type] = value
      } else {
        const index = array.indexOf(value)
        if (index > -1) {
          array.splice(index, 1)
        } else {
          array.push(value)
        }
      }
      
      return newFilters
    })
  }

  const clearFilters = () => {
    setFilters(defaultFilters)
  }

  const activeFilterCount = 
    filters.categories.length + 
    filters.riskLevels.length + 
    filters.changeTypes.length +
    (filters.timeRange !== 'all' ? 1 : 0)

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Search companies, policies, or ask a question..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 pr-24 h-12 text-base"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8"
                >
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search filters..." />
                  <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    
                    {/* Categories */}
                    <CommandGroup heading="Categories">
                      {categories.map(cat => (
                        <CommandItem
                          key={cat}
                          onSelect={() => toggleFilter('categories', cat)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="capitalize">{cat.replace('-', ' ')}</span>
                            {filters.categories.includes(cat) && (
                              <Badge variant="secondary">Selected</Badge>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    
                    <CommandSeparator />
                    
                    {/* Risk Levels */}
                    <CommandGroup heading="Risk Levels">
                      {riskLevels.map(level => (
                        <CommandItem
                          key={level}
                          onSelect={() => toggleFilter('riskLevels', level)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="capitalize">{level}</span>
                            {filters.riskLevels.includes(level) && (
                              <Badge variant="secondary">Selected</Badge>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    
                    <CommandSeparator />
                    
                    {/* Time Range */}
                    <CommandGroup heading="Time Range">
                      {timeRanges.map(range => (
                        <CommandItem
                          key={range.value}
                          onSelect={() => toggleFilter('timeRange', range.value)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{range.label}</span>
                            {filters.timeRange === range.value && (
                              <Badge variant="secondary">Selected</Badge>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    
                    <CommandSeparator />
                    
                    {/* Clear Filters */}
                    {activeFilterCount > 0 && (
                      <CommandGroup>
                        <CommandItem onSelect={clearFilters}>
                          <X className="h-4 w-4 mr-2" />
                          Clear all filters
                        </CommandItem>
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            
            <Button 
              onClick={() => handleSearch()}
              size="sm"
              className="h-8"
              disabled={isSearching}
            >
              {isSearching ? (
                <Sparkles className="h-4 w-4 animate-pulse" />
              ) : (
                'Search'
              )}
            </Button>
          </div>
        </div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {(suggestions.length > 0 || isSearching) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 z-50"
            >
              <Card className="shadow-lg">
                <CardContent className="p-2">
                  {isSearching && (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Generating AI suggestions...
                    </div>
                  )}
                  
                  {suggestions.map((suggestion, index) => {
                    const Icon = suggestion.icon
                    return (
                      <button
                        key={`${suggestion.type}-${suggestion.value}-${index}`}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left p-3 hover:bg-muted rounded-md transition-colors flex items-center gap-3"
                      >
                        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{suggestion.label}</span>
                            {suggestion.metadata?.trending && (
                              <Badge variant="secondary" className="text-xs">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Trending
                              </Badge>
                            )}
                            {suggestion.type === 'ai' && (
                              <Badge variant="secondary" className="text-xs">
                                AI
                              </Badge>
                            )}
                          </div>
                          {suggestion.metadata?.count && (
                            <span className="text-xs text-muted-foreground">
                              {suggestion.metadata.count} results
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.categories.map(cat => (
            <Badge key={cat} variant="secondary">
              {cat.replace('-', ' ')}
              <button
                onClick={() => toggleFilter('categories', cat)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.riskLevels.map(level => (
            <Badge key={level} variant="secondary">
              {level} risk
              <button
                onClick={() => toggleFilter('riskLevels', level)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.timeRange !== 'all' && (
            <Badge variant="secondary">
              {timeRanges.find(r => r.value === filters.timeRange)?.label}
              <button
                onClick={() => toggleFilter('timeRange', 'all')}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}