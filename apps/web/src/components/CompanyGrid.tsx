'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { extractDomain } from '@policydiff/shared/utils'
import { useEffect, useState } from 'react'
import { getCompanies } from '@/lib/api'
import type { Company } from '@policydiff/shared'

export function CompanyGrid() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCompanies().then(data => {
      setCompanies(data)
      setLoading(false)
    })
  }, [])

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