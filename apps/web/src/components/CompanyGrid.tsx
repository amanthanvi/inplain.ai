'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { extractDomain } from '@inplain.ai/shared/utils'
import { useEffect, useState } from 'react'
import { getCompanies } from '@/lib/api'
import type { Company } from '@inplain.ai/shared'
import { useDebounce } from '@/hooks/useDebounce'

interface CompanyGridProps {
  limit?: number
  searchQuery?: string
  category?: string
}

export function CompanyGrid({ limit, searchQuery = '', category }: CompanyGridProps = {}) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Debounce search query to reduce API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  useEffect(() => {
    // Show loading immediately on search change, but wait for debounced value
    if (searchQuery !== debouncedSearchQuery) {
      setLoading(true)
      return
    }
    
    getCompanies({
      search: debouncedSearchQuery || undefined,
      category: category || undefined,
      limit: limit || undefined,
      active: true
    }).then(data => {
      setCompanies(data)
      setError(null)
      setLoading(false)
    }).catch(error => {
      console.error('Failed to load companies:', error)
      setError('Unable to load companies. Please try again later.')
      setLoading(false)
    })
  }, [limit, debouncedSearchQuery, category])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex flex-col items-center space-y-4">
          <svg className="w-16 h-16 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="space-y-2">
            <p className="text-lg font-medium text-destructive">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="text-sm text-primary hover:underline"
            >
              Try refreshing the page
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex flex-col items-center space-y-4">
          <svg className="w-16 h-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="space-y-2">
            <p className="text-muted-foreground">
              {searchQuery ? 'No companies found matching your search.' : 'No companies available yet.'}
            </p>
            {searchQuery && (
              <p className="text-sm text-muted-foreground">
                Try adjusting your search terms or clearing the filters.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {companies.map((company) => (
        <Link key={company.slug} href={`/${company.slug}`}>
          <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer h-full group hover:scale-[1.02] hover:border-primary/50">
            <CardHeader className="p-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-2 flex-1">
                    {company.name}
                  </CardTitle>
                  {company.active && (
                    <Badge variant="success" className="text-xs shrink-0">Active</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <CardDescription className="text-sm truncate" title={extractDomain(company.url)}>
                    {extractDomain(company.url)}
                  </CardDescription>
                  {company.category && (
                    <Badge variant="secondary" className="text-xs">
                      {company.category}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  )
}