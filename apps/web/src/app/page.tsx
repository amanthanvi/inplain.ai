'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { CompanyGrid } from '@/components/CompanyGrid'
import { RecentDiffs } from '@/components/RecentDiffs'
import { RecentDiffsRealtime } from '@/components/RecentDiffsRealtime'
import { LiveActivityFeed } from '@/components/realtime/LiveActivityFeed'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { AsyncErrorBoundary } from '@/components/error-boundary'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Shield, Bot, Zap, Bell, TrendingUp, Search, 
  CheckCircle, ArrowRight, Sparkles, Eye, Lock,
  BarChart3, Users, Globe, ChevronRight
} from 'lucide-react'
import { 
  FadeIn, SlideIn, ScaleIn, StaggerChildren, HoverScale,
  RevealOnScroll, FloatingElement, PulseAnimation,
  Counter, TextReveal
} from '@/components/ui/framer-animations'

function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container relative py-32 sm:py-40">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-5xl font-bold tracking-tight sm:text-7xl lg:text-8xl mb-6">
              Never Miss a Privacy Update
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-xl text-muted-foreground sm:text-2xl">
              Track privacy policy changes across thousands of companies with AI-powered insights, 
              real-time alerts, and comprehensive analytics.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 min-w-[200px] h-14 text-lg">
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-w-[200px] h-14 text-lg">
                <Link href="/companies">
                  Explore Companies
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="container relative">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              See PolicyDiff in action
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Explore recent policy changes from major companies and see how our 
              AI analyzes and categorizes them for easy understanding.
            </p>
          </div>
          
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="glass-card">
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
                  <Suspense fallback={<LoadingSpinner />}>
                    <CompanyGrid limit={6} />
                  </Suspense>
                </AsyncErrorBoundary>
              </CardContent>
            </Card>
            
            <Card className="glass-card">
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
                  <Suspense fallback={<LoadingSpinner />}>
                    <RecentDiffsRealtime limit={5} />
                  </Suspense>
                </AsyncErrorBoundary>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Live Activity Feed */}
      <section className="py-24 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              Watch privacy policies change in real-time
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Our live activity feed shows policy changes as they happen, 
              giving you instant visibility into the privacy landscape.
            </p>
          </div>
          
          <AsyncErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <LiveActivityFeed />
            </Suspense>
          </AsyncErrorBoundary>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-secondary" />
        
        <div className="container relative">
          <div className="mx-auto max-w-4xl text-center text-white">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
              Ready to take control of your digital privacy?
            </h2>
            
            <p className="mx-auto mb-10 max-w-2xl text-xl text-white/90">
              Join thousands of privacy-conscious users who trust PolicyDiff 
              to keep them informed about policy changes that matter.
            </p>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" variant="secondary" className="min-w-[200px] h-14 text-lg">
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white border-white/20 hover:bg-white/10 hover:text-white min-w-[200px] h-14 text-lg">
                <Link href="/about">
                  Learn More
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage