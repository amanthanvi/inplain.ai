import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { DiffViewer } from '@/components/DiffViewer'
import { Timeline } from '@/components/Timeline'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getCompanyBySlug } from '@/lib/api'

interface PageProps {
  params: {
    slug: string
  }
}

export async function generateMetadata({ params }: PageProps) {
  const company = await getCompanyBySlug(params.slug)
  
  if (!company) {
    return {
      title: 'Company Not Found - PolicyDiff'
    }
  }
  
  return {
    title: `${company.name} Policy Changes - PolicyDiff`,
    description: `Track privacy policy and terms of service changes for ${company.name}`
  }
}

export default async function CompanyPage({ params }: PageProps) {
  const company = await getCompanyBySlug(params.slug)
  
  if (!company) {
    notFound()
  }
  
  return (
    <div className="container py-8">
      <div className="flex flex-col gap-8">
        <section>
          <h1 className="text-4xl font-bold tracking-tight">{company.name}</h1>
          <p className="text-muted-foreground mt-2">
            Monitoring: <a href={company.url} target="_blank" rel="noopener noreferrer" className="underline">{company.url}</a>
          </p>
        </section>
        
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-semibold mb-4">Latest Changes</h2>
            <Suspense fallback={<LoadingSpinner />}>
              <DiffViewer slug={params.slug} />
            </Suspense>
          </div>
          
          <div>
            <h2 className="text-2xl font-semibold mb-4">Change History</h2>
            <Suspense fallback={<LoadingSpinner />}>
              <Timeline slug={params.slug} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}