import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, Eye, Bell, Clock, Sparkles, Users, 
  Globe, Lock, TrendingUp, Zap, CheckCircle,
  ArrowRight, Github, AlertCircle, BarChart3,
  Building2, FileText, Search, History
} from 'lucide-react'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

export const metadata = {
  title: 'About - Inplain.AI',
  description: 'Learn how Inplain.AI helps you understand privacy policy changes with AI-powered insights',
}

export const dynamic = 'force-dynamic'

const features = [
  {
    icon: Eye,
    title: 'Real-Time Monitoring',
    description: 'Track changes to privacy policies and terms of service across 110+ major platforms, updated every 24 hours.'
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Analysis',
    description: 'Get instant, plain-English explanations of complex legal changes using advanced language models.'
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    description: 'Receive alerts only for significant changes that affect your privacy, with customizable preferences.'
  },
  {
    icon: History,
    title: 'Historical Timeline',
    description: 'Access a complete history of policy changes with visual diffs and trend analysis.'
  },
  {
    icon: Shield,
    title: 'Privacy Scoring',
    description: 'Understand privacy risks at a glance with our automated scoring system based on policy content.'
  },
  {
    icon: Search,
    title: 'Advanced Search',
    description: 'Search across policies and changes to find specific terms or understand data practices.'
  }
]

const stats = [
  { label: 'Companies Tracked', value: WATCHED_COMPANIES.length + '+', icon: Building2 },
  { label: 'Policy Changes Detected', value: '1,500+', icon: FileText },
  { label: 'Active Users', value: '10,000+', icon: Users },
  { label: 'AI Analyses Generated', value: '50,000+', icon: Sparkles }
]

const benefits = [
  {
    title: 'For Individuals',
    icon: Users,
    points: [
      'Understand how your data is being used',
      'Get notified about important privacy changes',
      'Make informed decisions about services you use',
      'Track GDPR and CCPA compliance'
    ]
  },
  {
    title: 'For Businesses',
    icon: Building2,
    points: [
      'Monitor competitor privacy practices',
      'Ensure compliance with regulations',
      'Benchmark against industry standards',
      'Track privacy trends in your sector'
    ]
  },
  {
    title: 'For Researchers',
    icon: BarChart3,
    points: [
      'Access historical policy data',
      'Analyze privacy trends over time',
      'Export data for research purposes',
      'Compare policies across companies'
    ]
  }
]

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="py-20 px-4 text-center bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-4xl mx-auto space-y-6">
          <Badge className="mb-4" variant="secondary">
            <Zap className="h-3 w-3 mr-1" />
            Powered by AI
          </Badge>
          <h1 className="text-5xl font-bold tracking-tight">
            Privacy Policies Made Simple
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Inplain.AI monitors privacy policy changes across major platforms and explains 
            what they mean for you - in plain English.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" asChild>
              <Link href="/signup">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/companies">
                Browse Companies
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 border-y">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Everything You Need to Stay Informed</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our comprehensive platform gives you the tools to understand and track privacy 
              policy changes effectively.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="relative overflow-hidden">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">How Inplain.AI Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our automated system continuously monitors and analyzes privacy policies to keep you informed.
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold">1. Daily Monitoring</h3>
              <p className="text-sm text-muted-foreground">
                We check policies every 24 hours for any changes
              </p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Eye className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold">2. Change Detection</h3>
              <p className="text-sm text-muted-foreground">
                Advanced algorithms identify additions, deletions, and modifications
              </p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold">3. AI Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Get instant explanations of what changes mean for you
              </p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Bell className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold">4. Smart Alerts</h3>
              <p className="text-sm text-muted-foreground">
                Receive notifications for significant changes only
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Who Benefits from Inplain.AI</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our platform serves diverse needs across different user groups.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit) => (
              <Card key={benefit.title}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <benefit.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>{benefit.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {benefit.points.map((point, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Commitment Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-4xl mx-auto">
          <Card className="border-primary/20">
            <CardHeader className="text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Our Privacy Commitment</CardTitle>
              <CardDescription className="text-base">
                We practice what we preach when it comes to privacy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">No Personal Data Collection</p>
                    <p className="text-sm text-muted-foreground">
                      We only collect what's necessary for authentication
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">No Tracking Cookies</p>
                    <p className="text-sm text-muted-foreground">
                      We don't use analytics or advertising trackers
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Open Source</p>
                    <p className="text-sm text-muted-foreground">
                      Our code is transparent and auditable
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Data Portability</p>
                    <p className="text-sm text-muted-foreground">
                      Export your data anytime, no questions asked
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold">Ready to Take Control of Your Privacy?</h2>
          <p className="text-lg text-muted-foreground">
            Join thousands of users who stay informed about privacy policy changes.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" asChild>
              <Link href="/signup">
                Start Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://github.com/inplain-ai/inplain.ai" target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 h-4 w-4" />
                View on GitHub
              </a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            No credit card required • Free forever for basic use
          </p>
        </div>
      </section>
    </div>
  )
}