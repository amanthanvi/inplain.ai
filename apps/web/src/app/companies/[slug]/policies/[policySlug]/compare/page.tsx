
// Force dynamic rendering to prevent static export
export const dynamic = 'force-dynamic'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PolicyVersionComparison } from '@/components/comparison/PolicyVersionComparison'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ComparePageProps {
  params: Promise<{
    slug: string
    policySlug: string
  }>
  searchParams: Promise<{
    left?: string
    right?: string
  }>
}

export async function generateMetadata({ params }: ComparePageProps): Promise<Metadata> {
  const { slug, policySlug } = await params
  const company = WATCHED_COMPANIES.find(c => c.slug === slug)
  if (!company) return { title: 'Not Found' }
  
  return {
    title: `Compare ${policySlug.replace('-', ' ')} Policy - ${company.name}`,
    description: `Compare different versions of ${company.name}'s ${policySlug.replace('-', ' ')} policy over time`
  }
}

async function getSnapshots(companySlug: string, policySlug: string) {
  // In production, fetch from API
  // For now, return mock data
  return [
    {
      id: 'snap-1',
      content: `<h1>Privacy Policy</h1>
<p>Last updated: January 1, 2024</p>
<h2>1. Information We Collect</h2>
<p>We collect information you provide directly to us, such as when you create an account, subscribe to our newsletter, or contact us for support.</p>
<h2>2. How We Use Your Information</h2>
<p>We use the information we collect to provide, maintain, and improve our services.</p>`,
      timestamp: new Date('2024-01-01'),
      version: 'v2.1',
      metadata: {
        effectiveDate: 'January 15, 2024',
        extractedAt: new Date('2024-01-01').toISOString()
      }
    },
    {
      id: 'snap-2',
      content: `<h1>Privacy Policy</h1>
<p>Last updated: March 15, 2024</p>
<h2>1. Information We Collect</h2>
<p>We collect information you provide directly to us, such as when you create an account, subscribe to our newsletter, participate in surveys, or contact us for support. We also collect information about your usage of our services.</p>
<h2>2. How We Use Your Information</h2>
<p>We use the information we collect to provide, maintain, and improve our services, communicate with you, and comply with legal obligations.</p>
<h2>3. Data Sharing</h2>
<p>We do not sell your personal information. We may share your information with trusted service providers who assist us in operating our services.</p>`,
      timestamp: new Date('2024-03-15'),
      version: 'v2.2',
      metadata: {
        effectiveDate: 'April 1, 2024',
        extractedAt: new Date('2024-03-15').toISOString()
      }
    },
    {
      id: 'snap-3',
      content: `<h1>Privacy Policy</h1>
<p>Last updated: June 1, 2024</p>
<h2>1. Information We Collect</h2>
<p>We collect information you provide directly to us, such as when you create an account, subscribe to our newsletter, participate in surveys, or contact us for support. We also automatically collect certain information about your device and usage of our services.</p>
<h2>2. How We Use Your Information</h2>
<p>We use the information we collect to provide, maintain, and improve our services, personalize your experience, communicate with you, and comply with legal obligations.</p>
<h2>3. Data Sharing</h2>
<p>We do not sell your personal information. We may share your information with trusted service providers who assist us in operating our services, and with your consent for specific purposes.</p>
<h2>4. Your Rights</h2>
<p>You have the right to access, update, and delete your personal information. You can manage your privacy preferences in your account settings.</p>`,
      timestamp: new Date('2024-06-01'),
      version: 'v3.0',
      metadata: {
        effectiveDate: 'June 15, 2024',
        extractedAt: new Date('2024-06-01').toISOString()
      }
    }
  ]
}

export default async function ComparePage({ params, searchParams }: ComparePageProps) {
  const { slug, policySlug } = await params
  const search = await searchParams
  
  const company = WATCHED_COMPANIES.find(c => c.slug === slug)
  if (!company) notFound()

  const snapshots = await getSnapshots(slug, policySlug)
  
  // Get initial snapshots based on query params
  const leftSnapshot = search.left ? snapshots.find(s => s.id === search.left) : snapshots[0]
  const rightSnapshot = search.right ? snapshots.find(s => s.id === search.right) : snapshots[snapshots.length - 1]

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <Link href={`/companies/${slug}/policies/${policySlug}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Policy
          </Button>
        </Link>
        
        <h1 className="text-3xl font-bold mb-2">
          Compare {policySlug.charAt(0).toUpperCase() + policySlug.slice(1).replace('-', ' ')} Policy Versions
        </h1>
        <p className="text-muted-foreground">
          {company.name} • Track changes and understand how the policy has evolved over time
        </p>
      </div>

      <PolicyVersionComparison
        companySlug={slug}
        policySlug={policySlug}
        leftSnapshot={leftSnapshot}
        rightSnapshot={rightSnapshot}
        snapshots={snapshots}
      />
    </div>
  )
}