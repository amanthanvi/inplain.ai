import { Suspense } from 'react'
import { AdvancedSearch } from '@/components/search/AdvancedSearch'
import { SearchResults } from '@/components/search/SearchResults'
import { LoadingSpinner } from '@/components/ui/loading-states'

export const metadata = {
  title: 'Search - Inplain.AI',
  description: 'Search privacy policies and companies with AI-powered insights',
}

export default function SearchPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/5 to-background">
        <div className="container py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Search Privacy Policies
            </h1>
            <p className="text-muted-foreground mb-8">
              Find companies, policy changes, and get AI-powered insights
            </p>
            <AdvancedSearch />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container py-8">
        <Suspense fallback={<LoadingSpinner label="Searching..." />}>
          <SearchResults />
        </Suspense>
      </div>
    </div>
  )
}