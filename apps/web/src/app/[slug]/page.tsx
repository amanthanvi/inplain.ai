import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { DiffViewer } from '@/components/DiffViewer'
import { Timeline } from '@/components/Timeline'
import { EnhancedCurrentPolicy } from '@/components/EnhancedCurrentPolicy'
import { LoadingSpinner, PolicyLoadingSkeleton } from '@/components/ui/loading-states'
import { AnimatedContainer } from '@/components/ui/animations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ExternalLink, Bell, Star, Shield, Activity, 
  FileText, History, TrendingUp, ChevronRight,
  Building2, Clock, AlertCircle
} from 'lucide-react'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

// Generate static params for all companies
export async function generateStaticParams() {
  return WATCHED_COMPANIES.map((company) => ({
    slug: company.slug,
  }))
}

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const company = WATCHED_COMPANIES.find(c => c.slug === slug)
  
  if (!company) {
    return {
      title: 'Company Not Found - Inplain.AI'
    }
  }
  
  return {
    title: `${company.name} Policy Changes - Inplain.AI`,
    description: `Track privacy policy and terms of service changes for ${company.name}`,
    openGraph: {
      title: `${company.name} Privacy Policy Tracker`,
      description: `Monitor ${company.name}'s privacy policy changes with AI-powered analysis`,
    }
  }
}

export default async function CompanyPage({ params }: PageProps) {
  const { slug } = await params
  const company = WATCHED_COMPANIES.find(c => c.slug === slug)
  
  if (!company) {
    notFound()
  }

  // Simulate company stats - in production these would come from API
  const stats = {
    checkInterval: company.checkInterval / 3600, // Convert to hours
    totalChanges: 15,
    privacyScore: 'Good',
    riskLevel: 'Low'
  }
  
  return (
    <div className="min-h-screen">
      {/* Mobile-optimized header */}
      <div className="bg-gradient-to-b from-primary/5 to-background">
        <div className="container py-6 md:py-8">
          <AnimatedContainer animation="slideUp">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 md:h-16 md:w-16 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-4xl font-bold tracking-tight">{company.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="success" className="text-xs">
                        <Activity className="h-3 w-3 mr-1" />
                        Active Monitoring
                      </Badge>
                      {company.category && (
                        <Badge variant="secondary" className="text-xs">
                          {company.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
                  Track privacy policy and terms of service changes with AI-powered insights
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild className="flex-1 md:flex-initial">
                  <a href={company.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">View</span> Policy
                  </a>
                </Button>
                <Button size="sm" className="flex-1 md:flex-initial">
                  <Bell className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Watch</span> Changes
                </Button>
              </div>
            </div>
          </AnimatedContainer>
        </div>
      </div>

      {/* Quick Stats - Mobile Friendly */}
      <div className="container py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <AnimatedContainer delay={0.1} animation="scale">
            <Card className="text-center">
              <CardContent className="p-4">
                <Clock className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.checkInterval}h</p>
                <p className="text-xs text-muted-foreground">Check Interval</p>
              </CardContent>
            </Card>
          </AnimatedContainer>
          
          <AnimatedContainer delay={0.2} animation="scale">
            <Card className="text-center">
              <CardContent className="p-4">
                <FileText className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.totalChanges}</p>
                <p className="text-xs text-muted-foreground">Total Changes</p>
              </CardContent>
            </Card>
          </AnimatedContainer>
          
          <AnimatedContainer delay={0.3} animation="scale">
            <Card className="text-center">
              <CardContent className="p-4">
                <Shield className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.privacyScore}</p>
                <p className="text-xs text-muted-foreground">Privacy Score</p>
              </CardContent>
            </Card>
          </AnimatedContainer>
          
          <AnimatedContainer delay={0.4} animation="scale">
            <Card className="text-center">
              <CardContent className="p-4">
                <TrendingUp className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.riskLevel}</p>
                <p className="text-xs text-muted-foreground">Risk Level</p>
              </CardContent>
            </Card>
          </AnimatedContainer>
        </div>
      </div>

      {/* Main Content - Responsive Tabs */}
      <div className="container pb-8">
        <Tabs defaultValue="current" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="current" className="text-xs md:text-sm py-2">
              <FileText className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Current</span> Policy
            </TabsTrigger>
            <TabsTrigger value="changes" className="text-xs md:text-sm py-2">
              <History className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Recent</span> Changes
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs md:text-sm py-2">
              <Clock className="h-4 w-4 mr-1.5" />
              Timeline
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="current" className="space-y-6">
            <AnimatedContainer animation="fade">
              <Suspense fallback={<PolicyLoadingSkeleton />}>
                <EnhancedCurrentPolicy slug={slug} />
              </Suspense>
            </AnimatedContainer>
          </TabsContent>
          
          <TabsContent value="changes" className="space-y-6">
            <AnimatedContainer animation="fade">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Policy Changes</CardTitle>
                  <CardDescription>
                    View detailed comparisons of recent updates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<LoadingSpinner label="Loading changes..." />}>
                    <DiffViewer slug={slug} />
                  </Suspense>
                </CardContent>
              </Card>
            </AnimatedContainer>
          </TabsContent>
          
          <TabsContent value="timeline" className="space-y-6">
            <AnimatedContainer animation="fade">
              <Card>
                <CardHeader>
                  <CardTitle>Change Timeline</CardTitle>
                  <CardDescription>
                    Historical view of all policy updates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<LoadingSpinner label="Loading timeline..." />}>
                    <Timeline slug={slug} />
                  </Suspense>
                </CardContent>
              </Card>
            </AnimatedContainer>
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile CTA */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t md:hidden">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1">
            <Star className="h-4 w-4 mr-1.5" />
            Save
          </Button>
          <Button size="sm" className="flex-1">
            <Bell className="h-4 w-4 mr-1.5" />
            Get Alerts
          </Button>
        </div>
      </div>
    </div>
  )
}