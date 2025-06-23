'use client'

import { Suspense } from 'react'
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

const features = [
  {
    icon: Shield,
    title: "Privacy Monitoring",
    description: "Track changes to privacy policies and terms of service in real-time across major platforms.",
    color: "text-blue-600"
  },
  {
    icon: Bot,
    title: "AI-Powered Analysis",
    description: "Get instant insights with our advanced AI that explains complex policy changes in plain English.",
    color: "text-purple-600"
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    description: "Receive notifications when companies update their policies, filtered by importance and impact.",
    color: "text-amber-600"
  },
  {
    icon: TrendingUp,
    title: "Risk Scoring",
    description: "Understand privacy risks with our automated scoring system that evaluates policy changes.",
    color: "text-red-600"
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Visualize trends, compare policies, and track compliance with interactive charts and reports.",
    color: "text-green-600"
  },
  {
    icon: Search,
    title: "Advanced Search",
    description: "Search across all policies and changes with powerful filters and natural language queries.",
    color: "text-indigo-600"
  }
]

const benefits = [
  "Stay informed about your privacy rights",
  "Understand complex legal changes instantly",
  "Compare policies across different companies",
  "Track historical changes over time",
  "Export reports for compliance teams",
  "API access for enterprise integration"
]

const stats = [
  { value: 500, suffix: "+", label: "Companies Tracked" },
  { value: 10000, suffix: "+", label: "Policy Changes Detected" },
  { value: 99.9, suffix: "%", label: "Uptime Reliability" },
  { value: 24, suffix: "/7", label: "Real-time Monitoring" }
]

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Premium gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-background" />
        <div className="absolute inset-0 pattern-grid opacity-[0.02]" />
        
        {/* Animated floating elements */}
        <FloatingElement className="absolute top-20 left-10 opacity-10" delay={0}>
          <div className="h-32 w-32 rounded-full bg-gradient-to-br from-primary to-secondary blur-3xl" />
        </FloatingElement>
        <FloatingElement className="absolute bottom-20 right-10 opacity-10" delay={2}>
          <div className="h-40 w-40 rounded-full bg-gradient-to-br from-accent to-primary blur-3xl" />
        </FloatingElement>
        
        <div className="container relative py-32 sm:py-40">
          <div className="mx-auto max-w-4xl text-center">
            <SlideIn direction="down">
              <Badge className="badge-gradient mb-6 shadow-lg">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                AI-Powered Privacy Intelligence
              </Badge>
            </SlideIn>
            
            <FadeIn delay={0.1}>
              <h1 className="text-5xl font-bold tracking-tight sm:text-7xl lg:text-8xl mb-8">
                <span className="gradient-text">Never Miss a</span>
                <br />
                <span className="text-foreground">Privacy Policy Change</span>
              </h1>
            </FadeIn>
            <SlideIn delay={0.2} direction="up">
              <p className="text-xl leading-relaxed text-muted-foreground max-w-3xl mx-auto mb-12">
                PolicyDiff monitors privacy policies and terms of service across the web, 
                using advanced AI to explain what changed and why it matters to you.
              </p>
            </SlideIn>
            
            <ScaleIn delay={0.3}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <HoverScale>
                  <Button asChild size="lg" className="btn-premium min-w-[200px] h-14 text-lg">
                    <Link href="/dashboard">
                      Get Started Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </HoverScale>
                <HoverScale>
                  <Button asChild variant="outline" size="lg" className="btn-glass min-w-[200px] h-14 text-lg">
                    <Link href="#demo">
                      Watch Demo
                      <Eye className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </HoverScale>
              </div>
            </ScaleIn>
            
            <FadeIn delay={0.4}>
              <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  14-day free trial
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Cancel anytime
                </span>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <RevealOnScroll>
        <section className="relative border-y bg-gradient-to-r from-muted/50 via-muted/30 to-muted/50">
          <div className="container py-16">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {stats.map((stat, index) => (
                <ScaleIn key={stat.label} delay={index * 0.1}>
                  <div className="text-center group">
                    <div className="text-4xl sm:text-5xl font-bold gradient-text mb-2">
                      <Counter to={stat.value} duration={2} />
                      <span>{stat.suffix}</span>
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
                  </div>
                </ScaleIn>
              ))}
            </div>
          </div>
        </section>
      </RevealOnScroll>

      {/* Features Section */}
      <section className="container py-24">
        <RevealOnScroll>
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need to Stay Informed
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Powerful features designed for privacy-conscious individuals and compliance teams
            </p>
          </div>
        </RevealOnScroll>
        
        <StaggerChildren className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <RevealOnScroll key={feature.title}>
                <HoverScale>
                  <Card className="glass-card h-full hover:shadow-2xl transition-all duration-300 group">
                    <CardHeader>
                      <ScaleIn delay={index * 0.05}>
                        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 shadow-lg group-hover:shadow-glow transition-shadow duration-300">
                          <Icon className={`h-7 w-7 ${feature.color}`} />
                        </div>
                      </ScaleIn>
                      <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="leading-relaxed">{feature.description}</CardDescription>
                    </CardContent>
                  </Card>
                </HoverScale>
              </RevealOnScroll>
            )
          })}
        </StaggerChildren>
      </section>

      {/* How It Works Section */}
      <section id="demo" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/5 via-background to-background" />
        <div className="container relative py-24">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <RevealOnScroll>
              <h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-6">
                How PolicyDiff Works
              </h2>
              <p className="text-xl text-muted-foreground">
                Simple, automated, and intelligent privacy monitoring
              </p>
            </RevealOnScroll>
          </div>

          <div className="mx-auto max-w-5xl">
            <div className="grid gap-12 lg:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Choose Companies",
                  description: "Select which companies you want to monitor from our extensive database.",
                  icon: Globe
                },
                {
                  step: "2",
                  title: "We Monitor 24/7",
                  description: "Our system checks for policy changes every day and captures any updates.",
                  icon: Eye
                },
                {
                  step: "3",
                  title: "Get AI Insights",
                  description: "Receive clear explanations of what changed and how it affects your privacy.",
                  icon: Sparkles
                }
              ].map((item, index) => {
                const Icon = item.icon
                return (
                  <RevealOnScroll key={index}>
                    <div className="relative text-center group">
                      <ScaleIn delay={index * 0.2}>
                        <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary shadow-xl text-white text-2xl font-bold group-hover:scale-110 transition-transform duration-300">
                          {item.step}
                        </div>
                      </ScaleIn>
                      <h3 className="mb-3 text-xl font-semibold">{item.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                      {index < 2 && (
                        <ChevronRight className="absolute -right-6 top-10 hidden h-8 w-8 text-muted-foreground/50 lg:block animate-pulse" />
                      )}
                    </div>
                  </RevealOnScroll>
                )
              }
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Current Monitoring Section */}
      <section className="container py-24">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Currently Monitoring
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join thousands tracking privacy changes at these companies
          </p>
        </div>
        
        <AsyncErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <CompanyGrid limit={12} />
          </Suspense>
        </AsyncErrorBoundary>

        <div className="mt-12 text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">
              View All Companies
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Recent Changes Preview */}
      <section className="bg-muted/30">
        <div className="container py-24">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Latest Policy Changes
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              See what companies changed their policies recently
            </p>
          </div>
          
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <AsyncErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <RecentDiffsRealtime limit={5} autoRefresh showNotifications />
                </Suspense>
              </AsyncErrorBoundary>
            </div>
            <div>
              <AsyncErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <LiveActivityFeed maxItems={8} showGlobalActivity />
                </Suspense>
              </AsyncErrorBoundary>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24 items-center">
            <RevealOnScroll>
              <div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-8">
                  Why Choose <span className="gradient-text">PolicyDiff</span>?
                </h2>
                <div className="space-y-5">
                  {benefits.map((benefit, index) => (
                    <SlideIn key={index} direction="right" delay={index * 0.1}>
                      <div className="flex gap-4 items-start">
                        <div className="flex-shrink-0 h-6 w-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mt-0.5">
                          <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-lg text-muted-foreground leading-relaxed">{benefit}</span>
                      </div>
                    </SlideIn>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
            
            <RevealOnScroll>
              <div className="relative">
                <Card className="card-premium relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-secondary/20 blur-3xl" />
                  <CardHeader className="relative">
                    <Badge className="badge-gradient mb-3 w-fit">
                      Premium Features
                    </Badge>
                    <CardTitle className="text-2xl">Unlock Advanced Capabilities</CardTitle>
                    <CardDescription className="text-base">
                      Get more from PolicyDiff with our premium plans
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 relative">
                    <div className="flex items-center gap-4 group">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Lock className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-base">Unlimited AI analyses</span>
                    </div>
                    <div className="flex items-center gap-4 group">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-base">Team collaboration</span>
                    </div>
                    <div className="flex items-center gap-4 group">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <BarChart3 className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-base">Advanced analytics</span>
                    </div>
                    <Button className="btn-premium w-full mt-8">
                      View Pricing
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden gradient-primary">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(ellipse_at_center,transparent,white)]" />
        <div className="container relative py-32">
          <div className="mx-auto max-w-3xl text-center">
            <FadeIn>
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-white mb-6">
                Start Protecting Your Privacy Today
              </h2>
            </FadeIn>
            <SlideIn direction="up" delay={0.1}>
              <p className="text-xl text-white/90 mb-12">
                Join thousands who trust PolicyDiff to keep them informed about their digital rights
              </p>
            </SlideIn>
            <ScaleIn delay={0.2}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <HoverScale>
                  <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 min-w-[200px] h-14 text-lg shadow-2xl">
                    <Link href="/dashboard">
                      Start Free Trial
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </HoverScale>
                <HoverScale>
                  <Button asChild size="lg" variant="ghost" className="text-white border-white/20 hover:bg-white/10 hover:text-white min-w-[200px] h-14 text-lg">
                    <Link href="/about">
                      Learn More
                    </Link>
                  </Button>
                </HoverScale>
              </div>
            </ScaleIn>
          </div>
        </div>
      </section>
    </div>
  )
}