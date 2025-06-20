import { Suspense } from 'react'
import { DiffCard } from '@/components/DiffCard'
import { CompanyGrid } from '@/components/CompanyGrid'
import { RecentDiffs } from '@/components/RecentDiffs'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export default function HomePage() {
  return (
    <div className="container py-8">
      <div className="flex flex-col gap-8">
        <section>
          <h1 className="text-4xl font-bold tracking-tight">PolicyDiff Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Track changes to privacy policies and terms of service across major platforms
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Monitored Companies</h2>
          <Suspense fallback={<LoadingSpinner />}>
            <CompanyGrid />
          </Suspense>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Recent Changes</h2>
          <Suspense fallback={<LoadingSpinner />}>
            <RecentDiffs />
          </Suspense>
        </section>
      </div>
    </div>
  )
}