import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PolicyViewer } from '@/components/policies/PolicyViewer'
import { PolicyNavigation } from '@/components/policies/PolicyNavigation'
import { GlobalSearch } from '@/components/search/GlobalSearch'
import { LoadingSpinner } from '@/components/ui/loading-states'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, Building2, Shield, AlertCircle, 
  TrendingUp, Calendar, FileText, Search 
} from 'lucide-react'
import Link from 'next/link'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'
import { format } from 'date-fns'

interface PageProps {
  params: Promise<{
    slug: string
    policySlug: string
  }>
}

// Mock policy data - in production this would come from API
const mockPolicies = {
  'privacy-policy': {
    slug: 'privacy-policy',
    name: 'Privacy Policy',
    type: 'privacy' as const,
    lastUpdated: new Date('2024-01-15'),
    version: '2.3',
    sections: 12,
    wordCount: 4532,
    readingTime: 18,
    complianceScore: 85,
    riskLevel: 'medium' as 'low' | 'medium' | 'high',
    content: `# Privacy Policy

## 1. Introduction

This Privacy Policy describes how we collect, use, and handle your information when you use our services.

### 1.1 Scope of This Policy

This policy applies to all services offered by our company, including our website, mobile applications, and any other services we provide.

### 1.2 Changes to This Policy

We may update this policy from time to time. We will notify you of any changes by posting the new policy on this page.

## 2. Information We Collect

We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support.

### 2.1 Personal Information

This includes:
- Name and contact information
- Account credentials
- Payment information
- Communications with us

### 2.2 Usage Information

We automatically collect information about how you use our services, including:
- Log data
- Device information
- Location information
- Cookie data

## 3. How We Use Your Information

We use the information we collect to:
- Provide and maintain our services
- Process transactions
- Send you technical notices and support messages
- Respond to your comments and questions
- Analyze usage patterns and improve our services

## 4. Information Sharing

We do not sell, trade, or rent your personal information to third parties. We may share your information in the following situations:
- With your consent
- For legal reasons
- To protect rights and safety
- In connection with a business transfer

## 5. Data Security

We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.

## 6. Your Rights

You have the right to:
- Access your personal information
- Correct inaccurate data
- Request deletion of your data
- Object to processing
- Data portability

## 7. Contact Us

If you have any questions about this Privacy Policy, please contact us at privacy@example.com.`,
    changes: [
      {
        type: 'modified' as const,
        date: new Date('2024-01-15'),
        summary: 'Updated data retention policy',
        severity: 'moderate' as const
      },
      {
        type: 'added' as const,
        date: new Date('2023-12-01'),
        summary: 'Added section on AI data usage',
        severity: 'major' as const
      }
    ]
  },
  'terms-of-service': {
    slug: 'terms-of-service',
    name: 'Terms of Service',
    type: 'terms' as const,
    lastUpdated: new Date('2024-01-10'),
    version: '3.0',
    sections: 15,
    wordCount: 6234,
    readingTime: 25,
    complianceScore: 92,
    riskLevel: 'low' as 'low' | 'medium' | 'high',
    content: `# Terms of Service

## 1. Acceptance of Terms

By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.

## 2. Use License

Permission is granted to temporarily download one copy of the materials for personal, non-commercial transitory viewing only.

## 3. Disclaimer

The materials on our service are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.

## 4. Limitations

In no event shall our company or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our service, even if we or our authorized representative has been notified orally or in writing of the possibility of such damage.`,
    changes: []
  }
}

export async function generateMetadata({ params }: PageProps) {
  const { slug, policySlug } = await params
  const company = WATCHED_COMPANIES.find(c => c.slug === slug)
  const policy = mockPolicies[policySlug as keyof typeof mockPolicies]
  
  if (!company || !policy) {
    return {
      title: 'Policy Not Found - Inplain.AI'
    }
  }
  
  return {
    title: `${company.name} ${policy.name} - Inplain.AI`,
    description: `Read and analyze ${company.name}'s ${policy.name} with AI-powered insights`,
    openGraph: {
      title: `${company.name} ${policy.name}`,
      description: `View the latest version of ${company.name}'s ${policy.name} with change tracking and analysis`,
    }
  }
}

export default async function PolicyPage({ params }: PageProps) {
  const { slug, policySlug } = await params
  const company = WATCHED_COMPANIES.find(c => c.slug === slug)
  const policy = mockPolicies[policySlug as keyof typeof mockPolicies]
  
  if (!company || !policy) {
    notFound()
  }

  // In production, fetch all policies for this company
  const allPolicies = Object.values(mockPolicies)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/companies/${slug}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to {company.name}
                </Button>
              </Link>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{company.name}</span>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-2">
              <GlobalSearch className="w-96" />
            </div>
          </div>
        </div>
      </div>

      {/* Policy Header */}
      <div className="border-b bg-muted/30">
        <div className="container py-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{policy.name}</h1>
                <Badge variant="outline">v{policy.version}</Badge>
                {policy.riskLevel && (
                  <Badge 
                    variant={
                      policy.riskLevel === 'high' ? 'destructive' :
                      policy.riskLevel === 'medium' ? 'secondary' : 'success'
                    }
                  >
                    {policy.riskLevel} risk
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Last updated {format(policy.lastUpdated, 'MMMM d, yyyy')}
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {policy.wordCount.toLocaleString()} words
                </div>
                {policy.complianceScore && (
                  <div className="flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    {policy.complianceScore}% compliant
                  </div>
                )}
              </div>
            </div>

            {policy.changes && policy.changes.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-medium">{policy.changes.length} recent changes</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Policy Navigation Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <PolicyNavigation
                company={company}
                policies={allPolicies}
                currentPolicy={policySlug}
                onPolicySelect={(selectedPolicy) => {
                  // Navigation is handled by the component
                }}
              />
            </div>
          </div>

          {/* Policy Viewer */}
          <div className="lg:col-span-3">
            <Card className="overflow-hidden">
              <Suspense fallback={
                <CardContent className="p-8">
                  <LoadingSpinner label="Loading policy content..." />
                </CardContent>
              }>
                <PolicyViewer
                  policyContent={policy.content}
                  metadata={{
                    title: policy.name,
                    company: company.name,
                    lastUpdated: policy.lastUpdated,
                    version: policy.version,
                    wordCount: policy.wordCount,
                    readingTime: policy.readingTime
                  }}
                  changes={policy.changes?.map((change, index) => ({
                    id: `change-${index}`,
                    type: change.type,
                    section: 'General',
                    content: change.summary,
                    date: change.date
                  }))}
                />
              </Suspense>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Search FAB */}
      <div className="md:hidden fixed bottom-24 right-4 z-50">
        <Button size="lg" className="rounded-full shadow-lg h-14 w-14">
          <Search className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}