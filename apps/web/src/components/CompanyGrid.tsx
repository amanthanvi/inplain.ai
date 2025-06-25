'use client'

import { useEffect, useState } from 'react'
import { getCompanies } from '@/lib/api'
import type { Company } from '@inplain.ai/shared'
import { Card, CardHeader } from '@/components/ui/card'
import { CompanyCard } from '@/components/CompanyCard'

interface CompanyGridProps {
  limit?: number
  searchQuery?: string
  category?: string
}

export function CompanyGrid({ limit, searchQuery = '', category }: CompanyGridProps = {}) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCompanies({
      search: searchQuery || undefined,
      category: category || undefined,
      limit: limit || undefined,
      active: true
    }).then(data => {
      setCompanies(data)
      setLoading(false)
    }).catch(error => {
      console.error('Failed to load companies:', error)
      setLoading(false)
    })
  }, [limit, searchQuery, category])

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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {companies.map((company) => (
        <CompanyCard key={company.slug} company={company} />
      ))}
    </div>
  )
}