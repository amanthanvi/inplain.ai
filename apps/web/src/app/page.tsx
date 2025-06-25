'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { CompanyGrid } from '@/components/CompanyGrid'
import { RecentDiffs } from '@/components/RecentDiffs'
import { RecentDiffsRealtime } from '@/components/RecentDiffsRealtime'
import { LiveActivityFeed } from '@/components/realtime/LiveActivityFeed'
import { LoadingSpinner, PolicyLoadingSkeleton, AnalysisLoadingState } from '@/components/ui/loading-states'
import { AnimatedContainer, AnimatedList, PageTransition, Shimmer } from '@/components/ui/animations'
import { AsyncErrorBoundary } from '@/components/error-boundary'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Shield, Bot, Zap, Bell, TrendingUp, Search, 
  CheckCircle, ArrowRight, Sparkles, Eye, Lock,
  BarChart3, Users, Globe, ChevronRight, Activity
} from 'lucide-react'

const features = [
  {
    icon: Shield,
    title: 'Privacy-First Approach',
    description: 'Monitor changes that matter to your data privacy and security',
    color: 'text-blue-600'
  },
  {
    icon: Bot,
    title: 'AI-Powered Analysis',
    description: 'Understand complex legal changes in plain English instantly',
    color: 'text-purple-600'
  },
  {
    icon: Bell,
    title: 'Real-Time Alerts',
    description: 'Get notified immediately when policies that affect you change',
    color: 'text-amber-600'
  },
  {
    icon: BarChart3,
    title: 'Trend Analytics',
    description: 'Track industry-wide privacy trends and compliance patterns',
    color: 'text-green-600'
  }
]

const stats = [
  { label: 'Companies Tracked', value: '2,500+' },
  { label: 'Policy Changes Detected', value: '10,000+' },
  { label: 'Active Users', value: '50,000+' },
  { label: 'Daily Checks', value: '100,000+' }
]

function HomePage() {
  return (
    <PageTransition>
      <div className="flex flex-col">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
          <div className="container relative py-32 sm:py-40">
            <AnimatedContainer animation="slideUp" className="mx-auto max-w-4xl text-center">
              <Badge className="mb-4 animate-pulse" variant="secondary">
                <Activity className="h-3 w-3 mr-1" />
                Live Monitoring Active
              </Badge>
              <h1 className="text-5xl font-bold tracking-tight sm:text-7xl lg:text-8xl mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Never Miss a Privacy Update
              </h1>
              <p className="mx-auto mb-10 max-w-2xl text-xl text-muted-foreground sm:text-2xl">
                Track privacy policy changes across thousands of companies with AI-powered insights, 
                real-time alerts, and comprehensive analytics.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                <AnimatedContainer delay={0.2}>
                  <Button asChild size="lg" className="bg-primary hover:bg-primary/90 min-w-[200px] h-14 text-lg group">
                    <Link href="/signup">
                      Start Free Trial
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </AnimatedContainer>
                <AnimatedContainer delay={0.3}>
                  <Button asChild size="lg" variant="outline" className="min-w-[200px] h-14 text-lg">
                    <Link href="/companies">
                      Explore Companies
                    </Link>
                  </Button>
                </AnimatedContainer>
              </div>
            </AnimatedContainer>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 border-y bg-muted/30">
          <div className="container">
            <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
              {stats.map((stat, index) => (
                <AnimatedContainer
                  key={stat.label}
                  delay={index * 0.1}
                  animation="scale"
                  className="text-center"
                >
                  <div className="text-3xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </AnimatedContainer>
              ))}
            </div>
          </div>
        </section>

        {/* Live Demo Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="container relative">
            <AnimatedContainer animation="fade" className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
                See Inplain.AI in Action
              </h2>
              <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
                Explore recent policy changes from major companies and see how our 
                AI analyzes and categorizes them for easy understanding.
              </p>
            </AnimatedContainer>
            
            <div className="grid gap-8 lg:grid-cols-2">
              <AnimatedContainer delay={0.2} animation="slide">
                <Card className="h-full hover:shadow-lg transition-all duration-300 border-primary/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Recently Tracked Companies
                    </CardTitle>
                    <CardDescription>
                      Live monitoring across major platforms
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AsyncErrorBoundary>
                      <Suspense fallback={
                        <div className="space-y-3">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
                          ))}
                        </div>
                      }>
                        <CompanyGrid limit={6} />
                      </Suspense>
                    </AsyncErrorBoundary>
                    <div className="mt-4 text-center">
                      <Button asChild variant="outline" size="sm">
                        <Link href="/companies">
                          View All Companies
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedContainer>
              
              <AnimatedContainer delay={0.3} animation="slide">
                <Card className="h-full hover:shadow-lg transition-all duration-300 border-primary/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-primary" />
                      Latest Policy Changes
                    </CardTitle>
                    <CardDescription>
                      Real-time updates with AI analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AsyncErrorBoundary>
                      <Suspense fallback={<PolicyLoadingSkeleton />}>
                        <RecentDiffsRealtime />
                      </Suspense>
                    </AsyncErrorBoundary>
                  </CardContent>
                </Card>
              </AnimatedContainer>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-muted/30 relative">
          <div className="container">
            <AnimatedContainer animation="fade" className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
                Powerful Features for Privacy Professionals
              </h2>
              <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
                Everything you need to stay on top of privacy policy changes
              </p>
            </AnimatedContainer>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <AnimatedContainer
                    key={feature.title}
                    delay={index * 0.1}
                    animation="slideUp"
                  >
                    <Card className="h-full hover:shadow-lg transition-all duration-300 group hover:border-primary/50">
                      <CardHeader>
                        <div className={`h-12 w-12 rounded-lg bg-background flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${feature.color}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <CardTitle className="text-xl">{feature.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">{feature.description}</p>
                      </CardContent>
                    </Card>
                  </AnimatedContainer>
                )
              })}
            </div>
          </div>
        </section>

        {/* AI Analysis Demo */}
        <section className="py-24">
          <div className="container">
            <AnimatedContainer animation="fade" className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
                AI That Understands Privacy
              </h2>
              <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
                Our advanced AI models analyze policy changes and provide clear, actionable insights
              </p>
            </AnimatedContainer>

            <AnimatedContainer delay={0.2} animation="slideUp">
              <Card className="max-w-4xl mx-auto overflow-hidden border-primary/20">
                <div className="relative">
                  <Shimmer className="absolute inset-0 z-10" />
                  <CardHeader className="bg-gradient-to-br from-primary/10 to-secondary/10">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                      Live AI Analysis Example
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-6">
                      <div className="flex items-start gap-4">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Data Collection Changes</p>
                          <p className="text-sm text-muted-foreground">New biometric data collection for authentication purposes</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <CheckCircle className="h-5 w-5 text-amber-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Third-Party Sharing</p>
                          <p className="text-sm text-muted-foreground">Expanded list of advertising partners with opt-out available</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <CheckCircle className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium">User Rights Enhanced</p>
                          <p className="text-sm text-muted-foreground">New data portability options and deletion request procedures</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-8 p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium text-center">
                        Risk Assessment: <span className="text-amber-600">Medium</span> • 
                        GDPR Compliant: <span className="text-green-600">Yes</span> • 
                        Analysis Time: <span className="text-primary">2.3s</span>
                      </p>
                    </div>
                  </CardContent>
                </div>
              </Card>
            </AnimatedContainer>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-primary text-primary-foreground">
          <div className="container">
            <AnimatedContainer animation="scale" className="text-center">
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
                Start Tracking Privacy Changes Today
              </h2>
              <p className="mx-auto max-w-2xl text-xl mb-8 opacity-90">
                Join thousands of privacy professionals who trust Inplain.AI
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="secondary" className="min-w-[200px] h-14 text-lg">
                  <Link href="/signup">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="min-w-[200px] h-14 text-lg bg-transparent hover:bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20">
                  <Link href="/about">
                    Learn More
                  </Link>
                </Button>
              </div>
            </AnimatedContainer>
          </div>
        </section>
      </div>
    </PageTransition>
  )
}

export default HomePage