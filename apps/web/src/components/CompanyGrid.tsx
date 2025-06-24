'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { extractDomain } from '@inplain.ai/shared/utils'
import { useEffect, useState } from 'react'
import { getCompanies } from '@/lib/api'
import type { Company } from '@inplain.ai/shared'

interface CompanyGridProps {
  limit?: number
  searchQuery?: string
}

export function CompanyGrid({ limit, searchQuery = '' }: CompanyGridProps = {}) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCompanies().then(data => {
      let filteredData = data
      
      // Filter by search query if provided
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filteredData = data.filter(company => 
          company.name.toLowerCase().includes(query) ||
          company.url.toLowerCase().includes(query)
        )
      }
      
      // Apply limit if provided
      setCompanies(limit ? filteredData.slice(0, limit) : filteredData)
      setLoading(false)
    })
  }, [limit, searchQuery])

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

  if (companies.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {searchQuery ? 'No companies found matching your search.' : 'No companies available.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {companies.map((company) => (
        <Link key={company.slug} href={`/${company.slug}`}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{company.name}</CardTitle>
                {company.active && (
                  <Badge variant="success" className="ml-2">Active</Badge>
                )}
              </div>
              <CardDescription className="text-sm">
                {extractDomain(company.url)}
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  )
}