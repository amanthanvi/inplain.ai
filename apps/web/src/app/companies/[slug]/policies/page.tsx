
// Force dynamic rendering to prevent static export
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { PolicyNavigation } from '@/components/policies/PolicyNavigation'
import { GlobalSearch } from '@/components/search/GlobalSearch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, Building2, FileText, Shield, Clock, 
  TrendingUp, Search, Filter, BarChart3 
} from 'lucide-react'
import Link from 'next/link'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

// Mock policy data - in production this would come from API
const mockPolicies = [
  {
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
    changes: [
      {
        date: new Date('2024-01-15'),
        summary: 'Updated data retention policy',
        severity: 'moderate' as const
      },
      {
        date: new Date('2023-12-01'),
        summary: 'Added section on AI data usage',
        severity: 'major' as const
      }
    ]
  },
  {
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
    changes: []
  },
  {
    slug: 'cookie-policy',
    name: 'Cookie Policy',
    type: 'cookies' as const,
    lastUpdated: new Date('2023-12-20'),
    version: '1.2',
    sections: 6,
    wordCount: 2145,
    readingTime: 9,
    complianceScore: 88,
    riskLevel: 'low' as 'low' | 'medium' | 'high',
    changes: [
      {
        date: new Date('2023-12-20'),
        summary: 'Updated cookie categories',
        severity: 'minor' as const
      }
    ]
  },
  {
    slug: 'data-processing-agreement',
    name: 'Data Processing Agreement',
    type: 'data' as const,
    lastUpdated: new Date('2024-01-05'),
    version: '2.0',
    sections: 10,
    wordCount: 3876,
    readingTime: 15,
    complianceScore: 95,
    riskLevel: 'low' as 'low' | 'medium' | 'high',
    changes: []
  }
]

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const company = WATCHED_COMPANIES.find(c => c.slug === slug)
  
  if (!company) {
    return {
      title: 'Company Not Found - Inplain.AI'
    }
  }
  
  return {
    title: `${company.name} Policies - Inplain.AI`,
    description: `Browse and analyze all privacy policies and legal documents for ${company.name}`,
    openGraph: {
      title: `${company.name} Policy Documents`,
      description: `Track changes and analyze ${company.name}'s privacy policies, terms of service, and legal documents`,
    }
  }
}

export default async function CompanyPoliciesPage({ params }: PageProps) {
  const { slug } = await params
  const company = WATCHED_COMPANIES.find(c => c.slug === slug)
  
  if (!company) {
    notFound()
  }

  // Calculate aggregated stats
  const totalPolicies = mockPolicies.length
  const totalChanges = mockPolicies.reduce((acc, p) => acc + (p.changes?.length || 0), 0)
  const avgCompliance = Math.round(
    mockPolicies.reduce((acc, p) => acc + (p.complianceScore || 0), 0) / totalPolicies
  )
  const highRiskCount = mockPolicies.filter(p => p.riskLevel === 'high').length

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
                  Back to Overview
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

      {/* Page Header */}
      <div className="border-b bg-muted/30">
        <div className="container py-8">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Policy Documents</h1>
              <p className="text-muted-foreground">
                Comprehensive overview of {company.name}'s legal documents and policies
              </p>
            </div>
            <Badge variant="secondary" className="animate-pulse">
              Real-time Monitoring
            </Badge>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Policies</span>
                </div>
                <p className="text-2xl font-bold mt-1">{totalPolicies}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Recent Changes</span>
                </div>
                <p className="text-2xl font-bold mt-1">{totalChanges}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Avg Compliance</span>
                </div>
                <p className="text-2xl font-bold mt-1">{avgCompliance}%</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Risk Analysis</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {highRiskCount === 0 ? 'Low' : highRiskCount >= 2 ? 'High' : 'Medium'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-6">
        <PolicyNavigation
          company={company}
          policies={mockPolicies}
          onPolicySelect={(policy) => {
            // Navigation is handled by the component
          }}
        />
      </div>

      {/* Quick Actions (Mobile) */}
      <div className="md:hidden fixed bottom-20 right-4 z-50 space-y-2">
        <Button size="lg" className="rounded-full shadow-lg h-14 w-14">
          <Search className="h-5 w-5" />
        </Button>
        <Button size="lg" variant="secondary" className="rounded-full shadow-lg h-14 w-14">
          <Filter className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}