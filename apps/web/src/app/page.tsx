'use client'

import React, { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUser } from '@clerk/nextjs'
import { CompanyGrid } from '@/components/CompanyGrid'
import { RecentDiffs } from '@/components/RecentDiffs'
import { RecentDiffsRealtime } from '@/components/RecentDiffsRealtime'
import dynamic from 'next/dynamic'

// Lazy load heavy components for better performance
const LazyCompanyGrid = dynamic(() => import('@/components/CompanyGrid').then(mod => ({ default: mod.CompanyGrid })), {
  loading: () => (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
      ))}
    </div>
  ),
  ssr: false
})

const LazyRecentDiffsRealtime = dynamic(() => import('@/components/RecentDiffsRealtime').then(mod => ({ default: mod.RecentDiffsRealtime })), {
  loading: () => <PolicyLoadingSkeleton />,
  ssr: false
})
import { LiveActivityFeed } from '@/components/realtime/LiveActivityFeed'
import { LoadingSpinner, PolicyLoadingSkeleton, AnalysisLoadingState } from '@/components/ui/loading-states'
import { AnimatedContainer, AnimatedList, PageTransition, Shimmer } from '@/components/ui/animations'
import { motion, AnimatePresence } from 'framer-motion'
import { AsyncErrorBoundary } from '@/components/error-boundary'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Shield, Bot, Zap, Bell, TrendingUp, Search, 
  CheckCircle, ArrowRight, Sparkles, Eye, Lock,
  BarChart3, Users, Globe, ChevronRight, Activity,
  LayoutDashboard, Building2, FileText, Code,
  Smartphone, Download, Star, Quote, HelpCircle,
  Mail, Twitter, Github, Linkedin, ExternalLink,
  CheckCircle2, XCircle, Minus, Plus, Copy,
  Chrome, Monitor, FileCode, Rocket, Clock,
  AlertTriangle, BookOpen, Cpu, Layers, Briefcase
} from 'lucide-react'

// Feature data
const features = [
  {
    icon: Shield,
    title: 'Privacy-First Approach',
    description: 'Monitor changes that matter to your data privacy and security',
    color: 'text-blue-600',
    gradient: 'from-blue-500 to-blue-600'
  },
  {
    icon: Bot,
    title: 'AI-Powered Analysis',
    description: 'Understand complex legal changes in plain English instantly',
    color: 'text-purple-600',
    gradient: 'from-purple-500 to-purple-600'
  },
  {
    icon: Bell,
    title: 'Real-Time Alerts',
    description: 'Get notified immediately when policies that affect you change',
    color: 'text-amber-600',
    gradient: 'from-amber-500 to-amber-600'
  },
  {
    icon: BarChart3,
    title: 'Trend Analytics',
    description: 'Track industry-wide privacy trends and compliance patterns',
    color: 'text-green-600',
    gradient: 'from-green-500 to-green-600'
  },
  {
    icon: Globe,
    title: 'Global Coverage',
    description: 'Track policies from companies worldwide in multiple languages',
    color: 'text-cyan-600',
    gradient: 'from-cyan-500 to-cyan-600'
  },
  {
    icon: FileText,
    title: 'Comprehensive Reports',
    description: 'Generate detailed reports for compliance and auditing',
    color: 'text-indigo-600',
    gradient: 'from-indigo-500 to-indigo-600'
  },
  {
    icon: Layers,
    title: 'Version Control',
    description: 'Access complete history of policy changes with diff views',
    color: 'text-rose-600',
    gradient: 'from-rose-500 to-rose-600'
  },
  {
    icon: Cpu,
    title: 'API Access',
    description: 'Integrate policy monitoring into your existing workflows',
    color: 'text-orange-600',
    gradient: 'from-orange-500 to-orange-600'
  }
]

// Stats data
const stats = [
  { label: 'Companies Tracked', value: '500+', icon: Building2 },
  { label: 'Policy Changes Detected', value: '50,000+', icon: FileText },
  { label: 'Active Users', value: '100,000+', icon: Users },
  { label: 'Daily Checks', value: '1M+', icon: Activity }
]

// Use cases data
const useCases = [
  {
    title: 'Privacy Officers',
    icon: Shield,
    description: 'Stay compliant with evolving regulations and track competitor policies',
    benefits: ['GDPR compliance tracking', 'Automated reporting', 'Risk assessment tools']
  },
  {
    title: 'Legal Teams',
    icon: Briefcase,
    description: 'Monitor legal changes and maintain comprehensive documentation',
    benefits: ['Legal change summaries', 'Audit trails', 'Compliance alerts']
  },
  {
    title: 'Product Teams',
    icon: Rocket,
    description: 'Understand privacy requirements before building new features',
    benefits: ['Feature impact analysis', 'Privacy by design', 'Integration guidelines']
  },
  {
    title: 'Developers',
    icon: Code,
    description: 'Integrate privacy monitoring into your applications via API',
    benefits: ['RESTful API', 'Webhooks', 'SDK libraries']
  }
]

// Pricing tiers
const pricingTiers = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for individuals',
    features: [
      { text: 'Track up to 5 companies', included: true },
      { text: 'Weekly email alerts', included: true },
      { text: 'Basic AI analysis', included: true },
      { text: 'Community support', included: true },
      { text: 'API access', included: false },
      { text: 'Custom reports', included: false },
      { text: 'Priority support', included: false }
    ],
    cta: 'Start Free',
    href: '/signup',
    popular: false
  },
  {
    name: 'Professional',
    price: '$29',
    period: '/month',
    description: 'For privacy professionals',
    features: [
      { text: 'Track up to 50 companies', included: true },
      { text: 'Real-time alerts', included: true },
      { text: 'Advanced AI analysis', included: true },
      { text: 'API access (1000 calls/mo)', included: true },
      { text: 'Custom reports', included: true },
      { text: 'Email support', included: true },
      { text: 'Dedicated account manager', included: false }
    ],
    cta: 'Start Trial',
    href: '/signup?plan=pro',
    popular: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations',
    features: [
      { text: 'Unlimited company tracking', included: true },
      { text: 'Real-time alerts', included: true },
      { text: 'Advanced AI analysis', included: true },
      { text: 'Unlimited API access', included: true },
      { text: 'White-label reports', included: true },
      { text: 'Priority support', included: true },
      { text: 'Dedicated account manager', included: true }
    ],
    cta: 'Contact Sales',
    href: '/contact-sales',
    popular: false
  }
]

// FAQ data
const faqs = [
  {
    question: 'How does InPlain.AI detect privacy policy changes?',
    answer: 'We use advanced web scraping technology combined with machine learning to monitor privacy policies across thousands of websites. Our system checks for changes multiple times per day and uses AI to identify meaningful updates.'
  },
  {
    question: 'What types of changes can InPlain.AI detect?',
    answer: 'We detect all types of changes including data collection updates, third-party sharing modifications, user rights changes, cookie policy updates, and compliance-related changes. Our AI categorizes these changes by impact and risk level.'
  },
  {
    question: 'How accurate is the AI analysis?',
    answer: 'Our AI models are trained on millions of privacy policy documents and achieve over 95% accuracy in identifying and categorizing changes. The system continuously learns and improves from user feedback.'
  },
  {
    question: 'Can I integrate InPlain.AI with my existing tools?',
    answer: 'Yes! We offer a comprehensive REST API, webhooks for real-time notifications, and integrations with popular tools like Slack, Microsoft Teams, and Zapier. Enterprise customers can also request custom integrations.'
  },
  {
    question: 'Is my data secure with InPlain.AI?',
    answer: 'Absolutely. We use bank-level encryption for all data transmission and storage. We\'re SOC 2 compliant and undergo regular security audits. We never share your data with third parties.'
  },
  {
    question: 'Do you offer a free trial?',
    answer: 'Yes! We offer a 14-day free trial of our Professional plan with no credit card required. You can also use our Free plan indefinitely to track up to 5 companies.'
  }
]

// Testimonials data
const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Chief Privacy Officer',
    company: 'TechCorp Inc.',
    image: '/testimonials/sarah.jpg',
    content: 'InPlain.AI has transformed how we handle privacy compliance. The real-time alerts and AI analysis save us hours every week.',
    rating: 5
  },
  {
    name: 'Michael Rodriguez',
    role: 'Legal Counsel',
    company: 'Global Retail Co.',
    image: '/testimonials/michael.jpg',
    content: 'The ability to track competitor privacy policies and industry trends has given us a significant strategic advantage.',
    rating: 5
  },
  {
    name: 'Emily Thompson',
    role: 'Product Manager',
    company: 'StartupXYZ',
    image: '/testimonials/emily.jpg',
    content: 'We use InPlain.AI to ensure our new features comply with privacy regulations. It\'s become an essential part of our development process.',
    rating: 5
  }
]

function HomePage() {
  const { user, isLoaded } = useUser()
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [showStickyCTA, setShowStickyCTA] = useState(false)

  // Show sticky CTA after scrolling past hero section
  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = window.innerHeight
      setShowStickyCTA(window.scrollY > heroHeight)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Copy code example
  const copyCodeExample = () => {
    const code = `// Track privacy policy changes
const response = await fetch('https://api.inplain.ai/v1/policies/google.com', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});

// Force dynamic rendering to prevent static export
export const dynamic = 'force-dynamic'

const data = await response.json();
console.log(data.changes);`
    
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  // Show logged-in user experience
  if (isLoaded && user) {
    return (
      <PageTransition>
        <div className="flex flex-col">
          {/* Logged-in User Hero Section */}
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
            <div className="container relative py-16 sm:py-20">
              <AnimatedContainer animation="slideUp" className="mx-auto max-w-4xl text-center">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
                  Welcome back, {user.firstName || 'there'}!
                </h1>
                <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
                  Your privacy monitoring dashboard is ready. Check out the latest policy updates from companies you're tracking.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                  <AnimatedContainer delay={0.2}>
                    <Button asChild size="lg" className="bg-primary hover:bg-primary/90 min-w-[200px] h-14 text-lg group">
                      <Link href="/dashboard">
                        <LayoutDashboard className="mr-2 h-5 w-5" />
                        Go to Dashboard
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  </AnimatedContainer>
                  <AnimatedContainer delay={0.3}>
                    <Button asChild size="lg" variant="outline" className="min-w-[200px] h-14 text-lg">
                      <Link href="/watchlist">
                        <Bell className="mr-2 h-5 w-5" />
                        View Watchlist
                      </Link>
                    </Button>
                  </AnimatedContainer>
                </div>
              </AnimatedContainer>
            </div>
          </section>

          {/* Quick Stats for Logged-in Users */}
          <section className="py-12 border-y bg-muted/30">
            <div className="container">
              <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
                <AnimatedContainer animation="scale" className="text-center">
                  <div className="text-3xl font-bold text-primary">12</div>
                  <div className="text-sm text-muted-foreground">Companies Watched</div>
                </AnimatedContainer>
                <AnimatedContainer delay={0.1} animation="scale" className="text-center">
                  <div className="text-3xl font-bold text-primary">3</div>
                  <div className="text-sm text-muted-foreground">New Updates Today</div>
                </AnimatedContainer>
                <AnimatedContainer delay={0.2} animation="scale" className="text-center">
                  <div className="text-3xl font-bold text-primary">24</div>
                  <div className="text-sm text-muted-foreground">Alerts This Month</div>
                </AnimatedContainer>
                <AnimatedContainer delay={0.3} animation="scale" className="text-center">
                  <div className="text-3xl font-bold text-primary">Active</div>
                  <div className="text-sm text-muted-foreground">Monitoring Status</div>
                </AnimatedContainer>
              </div>
            </div>
          </section>

          {/* Recent Activity Section */}
          <section className="py-16">
            <div className="container">
              <AnimatedContainer animation="fade" className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                  Recent Policy Updates
                </h2>
                <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                  Stay informed about the latest changes from companies you're monitoring
                </p>
              </AnimatedContainer>
              
              <div className="grid gap-8 lg:grid-cols-2">
                <AnimatedContainer delay={0.2} animation="slide">
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        Latest Changes
                      </CardTitle>
                      <CardDescription>
                        Real-time updates from your watchlist
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AsyncErrorBoundary>
                        <LazyRecentDiffsRealtime />
                      </AsyncErrorBoundary>
                    </CardContent>
                  </Card>
                </AnimatedContainer>
                
                <AnimatedContainer delay={0.3} animation="slide">
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        Suggested Companies
                      </CardTitle>
                      <CardDescription>
                        Popular companies you might want to track
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AsyncErrorBoundary>
                        <LazyCompanyGrid limit={4} />
                      </AsyncErrorBoundary>
                      <div className="mt-4 text-center">
                        <Button asChild variant="outline" size="sm">
                          <Link href="/companies">
                            Browse All Companies
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </AnimatedContainer>
              </div>
            </div>
          </section>
        </div>
      </PageTransition>
    )
  }

  // Show public homepage for non-authenticated users
  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "InPlain.AI",
            "description": "AI-powered privacy policy monitoring and analysis platform",
            "url": "https://inplain.ai",
            "applicationCategory": "PrivacyApplication",
            "operatingSystem": "Web",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD",
              "description": "Free tier available"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.9",
              "ratingCount": "1250"
            },
            "publisher": {
              "@type": "Organization",
              "name": "InPlain.AI",
              "url": "https://inplain.ai"
            }
          })
        }}
      />
    <PageTransition>
      <div className="flex flex-col">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/20">
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
          <div className="container relative py-24 sm:py-32 lg:py-40">
            <AnimatedContainer animation="slideUp" className="mx-auto max-w-5xl text-center">
              <Badge className="mb-4 animate-pulse" variant="secondary">
                <Activity className="h-3 w-3 mr-1" />
                Live Monitoring Active
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl mb-6">
                Privacy Policies
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">
                  Made Simple
                </span>
              </h1>
              <p className="mx-auto mb-10 max-w-3xl text-lg sm:text-xl text-muted-foreground">
                Stop missing critical privacy policy updates. InPlain.AI monitors changes across 
                500+ companies, translates legal jargon into plain English, and alerts you instantly 
                when your data rights change.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
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
                    <Link href="#demo">
                      <Eye className="mr-2 h-5 w-5" />
                      Watch Demo
                    </Link>
                  </Button>
                </AnimatedContainer>
              </div>
              <AnimatedContainer delay={0.4} className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  No credit card required
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  14-day free trial
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Cancel anytime
                </div>
              </AnimatedContainer>
            </AnimatedContainer>
          </div>
        </section>

        {/* Problem Statement Section */}
        <section className="py-20 bg-muted/30">
          <div className="container">
            <AnimatedContainer animation="fade" className="mx-auto max-w-4xl">
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Privacy Policies Are Broken
                </h2>
                <p className="text-lg text-muted-foreground">
                  And companies are counting on you not to notice
                </p>
              </div>
              <div className="grid gap-8 md:grid-cols-3">
                <AnimatedContainer delay={0.1} animation="slideUp">
                  <Card className="h-full border-destructive/20 bg-destructive/5">
                    <CardHeader>
                      <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
                      <CardTitle>67% Change Without Notice</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        Most companies update their privacy policies without notifying users, 
                        often removing rights or adding data collection practices.
                      </p>
                    </CardContent>
                  </Card>
                </AnimatedContainer>
                <AnimatedContainer delay={0.2} animation="slideUp">
                  <Card className="h-full border-destructive/20 bg-destructive/5">
                    <CardHeader>
                      <BookOpen className="h-8 w-8 text-destructive mb-2" />
                      <CardTitle>20,000+ Words Average</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        The average privacy policy is longer than Shakespeare's Macbeth, 
                        filled with legal jargon designed to confuse users.
                      </p>
                    </CardContent>
                  </Card>
                </AnimatedContainer>
                <AnimatedContainer delay={0.3} animation="slideUp">
                  <Card className="h-full border-destructive/20 bg-destructive/5">
                    <CardHeader>
                      <Clock className="h-8 w-8 text-destructive mb-2" />
                      <CardTitle>76 Days to Read</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        It would take the average person 76 work days per year to read all 
                        the privacy policies they encounter.
                      </p>
                    </CardContent>
                  </Card>
                </AnimatedContainer>
              </div>
            </AnimatedContainer>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 border-y">
          <div className="container">
            <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
              {stats.map((stat, index) => (
                <AnimatedContainer
                  key={stat.label}
                  delay={index * 0.1}
                  animation="scale"
                  className="text-center"
                >
                  <stat.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <div className="text-3xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </AnimatedContainer>
              ))}
            </div>
          </div>
        </section>

        {/* Features Showcase Section */}
        <section className="py-24 relative">
          <div className="container">
            <AnimatedContainer animation="fade" className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Everything You Need to Stay Protected
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Comprehensive privacy monitoring with enterprise-grade features
              </p>
            </AnimatedContainer>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <AnimatedContainer
                    key={feature.title}
                    delay={index * 0.05}
                    animation="slideUp"
                  >
                    <Card className="h-full hover:shadow-lg transition-all duration-300 group hover:border-primary/50">
                      <CardHeader>
                        <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${feature.gradient} p-2.5 text-white mb-4 group-hover:scale-110 transition-transform`}>
                          <Icon className="h-full w-full" />
                        </div>
                        <CardTitle className="text-lg">{feature.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </CardContent>
                    </Card>
                  </AnimatedContainer>
                )
              })}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24 bg-muted/30">
          <div className="container">
            <AnimatedContainer animation="fade" className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                How InPlain.AI Works
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Get started in minutes, not hours
              </p>
            </AnimatedContainer>

            <div className="mx-auto max-w-4xl">
              <div className="space-y-8">
                {[
                  {
                    step: 1,
                    title: 'Select Companies to Track',
                    description: 'Choose from our database of 500+ companies or add custom URLs',
                    icon: Search
                  },
                  {
                    step: 2,
                    title: 'We Monitor 24/7',
                    description: 'Our AI continuously scans for privacy policy changes across all your tracked companies',
                    icon: Eye
                  },
                  {
                    step: 3,
                    title: 'Instant AI Analysis',
                    description: 'When changes are detected, our AI analyzes the impact and categorizes by risk level',
                    icon: Bot
                  },
                  {
                    step: 4,
                    title: 'Get Notified Immediately',
                    description: 'Receive alerts via email, Slack, or webhooks with clear summaries of what changed',
                    icon: Bell
                  }
                ].map((item, index) => (
                  <AnimatedContainer key={item.step} delay={index * 0.1} animation="slide">
                    <div className="flex gap-6 items-start">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                          {item.step}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                        <p className="text-muted-foreground">{item.description}</p>
                      </div>
                      <div className="flex-shrink-0 hidden sm:block">
                        <item.icon className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    {index < 3 && (
                      <div className="ml-6 mt-8 mb-8 border-l-2 border-dashed border-muted-foreground/30 h-8" />
                    )}
                  </AnimatedContainer>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Live Demo Section */}
        <section id="demo" className="py-24 relative overflow-hidden">
          <div className="container relative">
            <AnimatedContainer animation="fade" className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                See InPlain.AI in Action
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Watch how we transform complex privacy policies into actionable insights
              </p>
            </AnimatedContainer>
            
            <div className="grid gap-8 lg:grid-cols-2">
              <AnimatedContainer delay={0.2} animation="slide">
                <Card className="h-full hover:shadow-lg transition-all duration-300 border-primary/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Popular Companies
                    </CardTitle>
                    <CardDescription>
                      Track privacy policies from leading tech companies
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
                        <LazyCompanyGrid limit={6} />
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
                      <LazyRecentDiffsRealtime />
                    </AsyncErrorBoundary>
                  </CardContent>
                </Card>
              </AnimatedContainer>
            </div>

            {/* AI Analysis Example */}
            <AnimatedContainer delay={0.4} animation="slideUp" className="mt-12">
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
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-1 flex-shrink-0" />
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

        {/* Use Cases Section */}
        <section className="py-24 bg-muted/30">
          <div className="container">
            <AnimatedContainer animation="fade" className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Built for Every Privacy Professional
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Whether you're ensuring compliance or building privacy-first products
              </p>
            </AnimatedContainer>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {useCases.map((useCase, index) => (
                <AnimatedContainer key={useCase.title} delay={index * 0.1} animation="slideUp">
                  <Card className="h-full hover:shadow-lg transition-all duration-300">
                    <CardHeader>
                      <useCase.icon className="h-8 w-8 text-primary mb-2" />
                      <CardTitle className="text-xl">{useCase.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">{useCase.description}</p>
                      <ul className="space-y-2">
                        {useCase.benefits.map((benefit) => (
                          <li key={benefit} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </AnimatedContainer>
              ))}
            </div>
          </div>
        </section>

        {/* Browser Extension Section */}
        <section className="py-24">
          <div className="container">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <AnimatedContainer animation="slide">
                <div>
                  <Badge className="mb-4" variant="secondary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    New Feature
                  </Badge>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                    Browser Extension
                  </h2>
                  <p className="text-lg text-muted-foreground mb-6">
                    Get instant privacy insights while browsing. Our Chrome extension shows you 
                    privacy policy summaries and recent changes right when you visit any website.
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>One-click privacy policy summary on any website</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Real-time alerts for policy changes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Privacy score and risk assessment</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Seamless sync with your InPlain.AI account</span>
                    </li>
                  </ul>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button size="lg" className="group">
                      <Chrome className="mr-2 h-5 w-5" />
                      Add to Chrome
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Button>
                    <Button size="lg" variant="outline">
                      <Monitor className="mr-2 h-5 w-5" />
                      Other Browsers
                    </Button>
                  </div>
                </div>
              </AnimatedContainer>
              <AnimatedContainer delay={0.2} animation="slide">
                <div className="relative">
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Download className="h-16 w-16 text-primary mx-auto mb-4" />
                      <p className="text-lg font-medium">Extension Preview</p>
                      <p className="text-sm text-muted-foreground">Available on Chrome Web Store</p>
                    </div>
                  </div>
                </div>
              </AnimatedContainer>
            </div>
          </div>
        </section>

        {/* API Section */}
        <section className="py-24 bg-muted/30">
          <div className="container">
            <AnimatedContainer animation="fade" className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Powerful API for Developers
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Integrate privacy monitoring into your applications with our RESTful API
              </p>
            </AnimatedContainer>

            <div className="grid gap-8 lg:grid-cols-2">
              <AnimatedContainer delay={0.1} animation="slide">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCode className="h-5 w-5 text-primary" />
                      Simple Integration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted rounded-lg p-4 font-mono text-sm mb-4 relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={copyCodeExample}
                      >
                        {copiedCode ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <pre className="text-muted-foreground">
{`// Track privacy policy changes
const response = await fetch('https://api.inplain.ai/v1/policies/google.com', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});

const data = await response.json();
console.log(data.changes);`}
                      </pre>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Features include:</p>
                      <ul className="space-y-1 text-sm">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          RESTful API with JSON responses
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Webhooks for real-time updates
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Rate limiting and caching included
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedContainer>

              <AnimatedContainer delay={0.2} animation="slide">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5 text-primary" />
                      API Endpoints
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <code className="text-sm font-mono text-primary">GET /policies/:domain</code>
                        <p className="text-xs text-muted-foreground mt-1">Get current policy and recent changes</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <code className="text-sm font-mono text-primary">POST /webhooks/subscribe</code>
                        <p className="text-xs text-muted-foreground mt-1">Subscribe to policy change notifications</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <code className="text-sm font-mono text-primary">GET /analysis/:domain</code>
                        <p className="text-xs text-muted-foreground mt-1">Get AI analysis of policy changes</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <code className="text-sm font-mono text-primary">GET /trends</code>
                        <p className="text-xs text-muted-foreground mt-1">Industry-wide privacy trends</p>
                      </div>
                    </div>
                    <div className="mt-6">
                      <Button asChild variant="outline" className="w-full">
                        <Link href="/docs/api">
                          View API Documentation
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedContainer>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-24">
          <div className="container">
            <AnimatedContainer animation="fade" className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Choose the plan that fits your needs. No hidden fees.
              </p>
            </AnimatedContainer>

            <div className="grid gap-8 lg:grid-cols-3 max-w-5xl mx-auto">
              {pricingTiers.map((tier, index) => (
                <AnimatedContainer key={tier.name} delay={index * 0.1} animation="slideUp">
                  <Card className={`h-full ${tier.popular ? 'border-primary shadow-lg relative' : ''}`}>
                    {tier.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-8">
                      <CardTitle className="text-2xl">{tier.name}</CardTitle>
                      <CardDescription>{tier.description}</CardDescription>
                      <div className="mt-4">
                        <span className="text-4xl font-bold">{tier.price}</span>
                        <span className="text-muted-foreground">{tier.period}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3 mb-8">
                        {tier.features.map((feature) => (
                          <li key={feature.text} className="flex items-start gap-3">
                            {feature.included ? (
                              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
                            )}
                            <span className={feature.included ? '' : 'text-muted-foreground/60'}>
                              {feature.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <Button 
                        asChild 
                        className="w-full" 
                        variant={tier.popular ? 'default' : 'outline'}
                        size="lg"
                      >
                        <Link href={tier.href}>
                          {tier.cta}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </AnimatedContainer>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24 bg-muted/30">
          <div className="container">
            <AnimatedContainer animation="fade" className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Trusted by Privacy Leaders
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                See what our customers have to say
              </p>
            </AnimatedContainer>

            <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
              {testimonials.map((testimonial, index) => (
                <AnimatedContainer key={testimonial.name} delay={index * 0.1} animation="slideUp">
                  <Card className="h-full">
                    <CardHeader>
                      <div className="flex items-center gap-1 mb-4">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`h-4 w-4 ${i < testimonial.rating ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`} 
                          />
                        ))}
                      </div>
                      <Quote className="h-8 w-8 text-primary/20 mb-2" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-6">{testimonial.content}</p>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{testimonial.name}</p>
                          <p className="text-xs text-muted-foreground">{testimonial.role} at {testimonial.company}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </AnimatedContainer>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24">
          <div className="container">
            <AnimatedContainer animation="fade" className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Frequently Asked Questions
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Everything you need to know about InPlain.AI
              </p>
            </AnimatedContainer>

            <div className="max-w-3xl mx-auto">
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <AnimatedContainer key={index} delay={index * 0.05} animation="slideUp">
                    <Card 
                      className="cursor-pointer hover:shadow-md transition-all duration-200"
                      onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-lg pr-4">{faq.question}</h3>
                          {openFAQ === index ? (
                            <Minus className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <Plus className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      </CardHeader>
                      {openFAQ === index && (
                        <CardContent className="pt-0">
                          <p className="text-muted-foreground">{faq.answer}</p>
                        </CardContent>
                      )}
                    </Card>
                  </AnimatedContainer>
                ))}
              </div>
              <div className="mt-12 text-center">
                <p className="text-muted-foreground mb-4">Still have questions?</p>
                <Button asChild variant="outline">
                  <Link href="/contact">
                    <Mail className="mr-2 h-4 w-4" />
                    Contact Support
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-24 bg-primary text-primary-foreground">
          <div className="container">
            <AnimatedContainer animation="scale" className="text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Start Protecting Your Privacy Today
              </h2>
              <p className="mx-auto max-w-2xl text-lg mb-8 opacity-90">
                Join 100,000+ users who trust InPlain.AI to monitor their digital privacy
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="secondary" className="min-w-[200px] h-14 text-lg">
                  <Link href="/signup">
                    Start 14-Day Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="min-w-[200px] h-14 text-lg bg-transparent hover:bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20">
                  <Link href="/demo">
                    Schedule Demo
                  </Link>
                </Button>
              </div>
              <p className="mt-6 text-sm opacity-75">
                No credit card required • Cancel anytime • GDPR compliant
              </p>
            </AnimatedContainer>
          </div>
        </section>

        {/* Enhanced Footer */}
        <footer className="py-16 bg-muted/50 border-t">
          <div className="container">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5 mb-8">
              <div className="lg:col-span-2">
                <h3 className="font-bold text-lg mb-4">InPlain.AI</h3>
                <p className="text-muted-foreground mb-4 max-w-sm">
                  Making privacy policies accessible and understandable for everyone. 
                  Track changes, get alerts, stay protected.
                </p>
                <div className="flex gap-4">
                  <Button asChild size="icon" variant="ghost">
                    <Link href="https://twitter.com/inplainai" target="_blank">
                      <Twitter className="h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild size="icon" variant="ghost">
                    <Link href="https://github.com/inplain-ai" target="_blank">
                      <Github className="h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild size="icon" variant="ghost">
                    <Link href="https://linkedin.com/company/inplainai" target="_blank">
                      <Linkedin className="h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/features" className="text-muted-foreground hover:text-foreground">Features</Link></li>
                  <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link></li>
                  <li><Link href="/api" className="text-muted-foreground hover:text-foreground">API</Link></li>
                  <li><Link href="/extension" className="text-muted-foreground hover:text-foreground">Browser Extension</Link></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-4">Company</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/about" className="text-muted-foreground hover:text-foreground">About</Link></li>
                  <li><Link href="/blog" className="text-muted-foreground hover:text-foreground">Blog</Link></li>
                  <li><Link href="/careers" className="text-muted-foreground hover:text-foreground">Careers</Link></li>
                  <li><Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-4">Resources</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/docs" className="text-muted-foreground hover:text-foreground">Documentation</Link></li>
                  <li><Link href="/guides" className="text-muted-foreground hover:text-foreground">Guides</Link></li>
                  <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="text-muted-foreground hover:text-foreground">Terms of Service</Link></li>
                </ul>
              </div>
            </div>
            
            <div className="border-t pt-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  © 2024 InPlain.AI. All rights reserved.
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
                  <Link href="/terms" className="hover:text-foreground">Terms</Link>
                  <Link href="/cookies" className="hover:text-foreground">Cookies</Link>
                </div>
              </div>
            </div>
          </div>
        </footer>

        {/* Sticky CTA Bar */}
        <AnimatePresence>
          {showStickyCTA && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-primary text-primary-foreground shadow-lg border-t"
            >
              <div className="container py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:block">
                      <p className="font-medium">Ready to protect your privacy?</p>
                      <p className="text-sm opacity-90">Join 100,000+ users monitoring policy changes</p>
                    </div>
                    <div className="sm:hidden">
                      <p className="font-medium text-sm">Start protecting your privacy</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      asChild 
                      size="sm" 
                      variant="secondary"
                      className="font-medium"
                    >
                      <Link href="/signup">
                        Start Free Trial
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary-foreground hover:bg-primary-foreground/10"
                      onClick={() => setShowStickyCTA(false)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
    </>
  )
}

export default HomePage