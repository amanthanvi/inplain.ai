import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { DiffViewer } from '@/components/DiffViewer'
import { Timeline } from '@/components/Timeline'
import { EnhancedCurrentPolicy } from '@/components/EnhancedCurrentPolicy'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getCompanyBySlug } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Bell, Star } from 'lucide-react'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const company = await getCompanyBySlug(slug)
  
  if (!company) {
    return {
      title: 'Company Not Found - Inplain.AI'
    }
  }
  
  return {
    title: `${company.name} Policy Changes - Inplain.AI`,
    description: `Track privacy policy and terms of service changes for ${company.name}`
  }
}

export default async function CompanyPage({ params }: PageProps) {
  const { slug } = await params
  const company = await getCompanyBySlug(slug)
  
  if (!company) {
    notFound()
  }
  
  return (
    <div className="container py-8">
      <div className="flex flex-col gap-8">
        {/* Enhanced Header */}
        <section className="relative">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold tracking-tight">{company.name}</h1>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <a 
                  href={company.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  {company.url}
                </a>
                <span className="text-sm">•</span>
                <span className="text-sm">Last checked: Today</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4 mr-2" />
                Set Alert
              </Button>
              <Button variant="outline" size="sm">
                <Star className="h-4 w-4 mr-2" />
                Add to Watchlist
              </Button>
            </div>
          </div>
        </section>
        
        <div className="space-y-8">
          {/* Enhanced Current Policy Section */}
          <section>
            <Suspense fallback={<LoadingSpinner />}>
              <EnhancedCurrentPolicy slug={slug} />
            </Suspense>
          </section>
          
          {/* Changes and History Grid */}
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-semibold mb-4">Latest Changes</h2>
              <Suspense fallback={<LoadingSpinner />}>
                <DiffViewer slug={slug} />
              </Suspense>
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold mb-4">Change History</h2>
              <Suspense fallback={<LoadingSpinner />}>
                <Timeline slug={slug} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}