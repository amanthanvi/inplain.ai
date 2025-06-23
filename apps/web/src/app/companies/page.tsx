'use client'

import React, { Suspense } from 'react'
import { CompanyGrid } from '@/components/CompanyGrid'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { AsyncErrorBoundary } from '@/components/error-boundary'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export default function CompaniesPage() {
  const [searchQuery, setSearchQuery] = React.useState('')

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Tracked Companies
        </h1>
        <p className="text-xl text-muted-foreground mb-6">
          Browse and search through all companies we're monitoring for privacy policy changes.
        </p>
        
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <AsyncErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <CompanyGrid searchQuery={searchQuery} />
        </Suspense>
      </AsyncErrorBoundary>
    </div>
  )
}