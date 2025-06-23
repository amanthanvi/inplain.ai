'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import { useToastContext } from '@/contexts/toast-context'
import { 
  ArrowRight, ArrowLeft, Check, Sparkles, Shield, Bell, 
  BarChart3, Search, Users, Zap, Star, ChevronRight,
  Building, Eye, Brain, Target, Rocket, Globe, Lock,
  TrendingUp, AlertTriangle, Clock, Lightbulb, Gift,
  CreditCard, Crown, Gem, Heart, PlayCircle
} from 'lucide-react'
import { 
  FadeIn, SlideIn, ScaleIn, HoverScale, 
  FloatingElement, PulseAnimation, TextReveal,
  Counter, GradientBackground, Spotlight
} from '@/components/ui/framer-animations'
import { cn } from '@/lib/utils'

interface OnboardingStep {
  id: string
  title: string
  subtitle?: string
  description: string
  icon: any
  color: string
  content: React.ReactNode
  validation?: () => boolean
}

// Enhanced company data with more metadata
const popularCompanies = [
  { slug: 'google', name: 'Google', icon: '🔍', category: 'tech', riskLevel: 'medium' },
  { slug: 'meta', name: 'Meta', icon: '👤', category: 'social', riskLevel: 'high' },
  { slug: 'amazon', name: 'Amazon', icon: '📦', category: 'ecommerce', riskLevel: 'medium' },
  { slug: 'microsoft', name: 'Microsoft', icon: '🪟', category: 'tech', riskLevel: 'low' },
  { slug: 'apple', name: 'Apple', icon: '🍎', category: 'tech', riskLevel: 'low' },
  { slug: 'netflix', name: 'Netflix', icon: '🎬', category: 'entertainment', riskLevel: 'medium' },
  { slug: 'spotify', name: 'Spotify', icon: '🎵', category: 'entertainment', riskLevel: 'medium' },
  { slug: 'twitter', name: 'X (Twitter)', icon: '𝕏', category: 'social', riskLevel: 'high' },
  { slug: 'linkedin', name: 'LinkedIn', icon: '💼', category: 'professional', riskLevel: 'medium' },
  { slug: 'tiktok', name: 'TikTok', icon: '🎭', category: 'social', riskLevel: 'high' },
  { slug: 'uber', name: 'Uber', icon: '🚗', category: 'transport', riskLevel: 'medium' },
  { slug: 'airbnb', name: 'Airbnb', icon: '🏠', category: 'travel', riskLevel: 'medium' }
]

const useCases = [
  {
    id: 'personal',
    title: 'Personal Privacy Guardian',
    subtitle: 'Protect your digital footprint',
    description: 'Monitor how companies handle your personal data and get alerts on policy changes',
    icon: Shield,
    color: 'from-blue-500 to-cyan-500',
    features: ['Privacy risk scoring', 'Personal data tracking', 'Opt-out assistance']
  },
  {
    id: 'business',
    title: 'Business Compliance Pro',
    subtitle: 'Stay ahead of regulations',
    description: 'Track industry standards, competitor policies, and compliance requirements',
    icon: Building,
    color: 'from-purple-500 to-pink-500',
    features: ['Competitor analysis', 'Compliance monitoring', 'Industry benchmarks']
  },
  {
    id: 'researcher',
    title: 'Privacy Researcher',
    subtitle: 'Deep insights & analytics',
    description: 'Analyze privacy trends, policy evolution, and generate comprehensive reports',
    icon: BarChart3,
    color: 'from-green-500 to-emerald-500',
    features: ['Trend analysis', 'Historical data', 'Export capabilities']
  },
  {
    id: 'legal',
    title: 'Legal Professional',
    subtitle: 'Client protection toolkit',
    description: 'Monitor policy changes, track compliance, and protect client interests',
    icon: Users,
    color: 'from-amber-500 to-orange-500',
    features: ['Legal alerts', 'Case documentation', 'Client reports']
  }
]

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for getting started',
    features: [
      'Monitor up to 5 companies',
      'Basic AI analysis',
      'Email notifications',
      'Monthly summaries'
    ],
    icon: Heart,
    color: 'from-gray-500 to-gray-600'
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$19',
    period: '/month',
    description: 'For power users',
    features: [
      'Unlimited companies',
      'Advanced AI analysis',
      'Real-time alerts',
      'API access',
      'Priority support'
    ],
    icon: Crown,
    popular: true,
    color: 'from-primary to-purple-600'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: 'pricing',
    description: 'For teams & organizations',
    features: [
      'Everything in Premium',
      'Team collaboration',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee'
    ],
    icon: Gem,
    color: 'from-purple-600 to-pink-600'
  }
]

export function EnhancedOnboardingFlow() {
  const router = useRouter()
  const { user, updatePreferences } = useAuth()
  const { success: showSuccessToast, error: showErrorToast } = useToastContext()
  const [currentStep, setCurrentStep] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  // User selections
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedUseCase, setSelectedUseCase] = useState<string>('')
  const [selectedPlan, setSelectedPlan] = useState<string>('free')
  const [companySearch, setCompanySearch] = useState('')
  const [preferences, setPreferences] = useState({
    emailAlerts: true,
    majorChangesOnly: true,
    weeklyDigest: false,
    riskAlerts: true,
    competitorUpdates: false
  })
  
  // Filter companies based on search
  const filteredCompanies = popularCompanies.filter(company =>
    company.name.toLowerCase().includes(companySearch.toLowerCase()) ||
    company.category.includes(companySearch.toLowerCase())
  )

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to PolicyDiff Pro',
      subtitle: 'Your AI-Powered Privacy Intelligence Platform',
      description: 'Let\'s create your personalized privacy monitoring experience',
      icon: Rocket,
      color: 'from-blue-500 to-purple-600',
      content: (
        <div className="space-y-8">
          <Spotlight className="relative">
            <GradientBackground className="absolute inset-0 opacity-10 rounded-2xl">
              <div />
            </GradientBackground>
            <div className="relative space-y-6 text-center p-8">
              <FloatingElement>
                <div className="mx-auto h-32 w-32 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 p-1">
                  <div className="h-full w-full rounded-full bg-background flex items-center justify-center">
                    <Sparkles className="h-16 w-16 text-primary" />
                  </div>
                </div>
              </FloatingElement>
              
              <div className="space-y-3">
                <TextReveal text="Your Privacy, Protected by AI" className="text-3xl font-bold" />
                <p className="text-muted-foreground max-w-lg mx-auto text-lg">
                  Join thousands who trust PolicyDiff to monitor privacy policies, 
                  detect changes, and understand their impact with cutting-edge AI analysis.
                </p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                {[
                  { icon: Shield, label: 'Privacy First', value: '100%' },
                  { icon: Brain, label: 'AI Insights', value: '24/7' },
                  { icon: Globe, label: 'Companies', value: '500+' },
                  { icon: Users, label: 'Active Users', value: '10K+' }
                ].map((stat, index) => (
                  <ScaleIn key={stat.label} delay={index * 0.1}>
                    <div className="glass-card p-4">
                      <stat.icon className="h-8 w-8 text-primary mx-auto mb-2" />
                      <div className="text-2xl font-bold">
                        <Counter to={parseInt(stat.value) || 100} duration={2} />
                        {stat.value.replace(/\d+/, '')}
                      </div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  </ScaleIn>
                ))}
              </div>
              
              <div className="flex items-center justify-center gap-2 text-sm">
                <Lock className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">
                  Your data is encrypted and never shared
                </span>
              </div>
            </div>
          </Spotlight>
        </div>
      )
    },
    {
      id: 'use-case',
      title: 'How will you use PolicyDiff?',
      subtitle: 'We\'ll customize your experience',
      description: 'Select your primary use case to get tailored features and insights',
      icon: Target,
      color: 'from-purple-500 to-pink-500',
      content: (
        <div className="space-y-6">
          <div className="grid gap-4">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon
              return (
                <motion.div
                  key={useCase.id}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <HoverScale>
                    <button
                      onClick={() => setSelectedUseCase(useCase.id)}
                      className="w-full text-left group"
                    >
                      <Card className={cn(
                        "relative overflow-hidden transition-all duration-300",
                        selectedUseCase === useCase.id 
                          ? "border-primary shadow-xl ring-2 ring-primary ring-offset-2" 
                          : "hover:border-primary/50 hover:shadow-lg"
                      )}>
                        <div className={cn(
                          "absolute inset-0 opacity-10 bg-gradient-to-br",
                          useCase.color
                        )} />
                        
                        <div className="relative p-6">
                          <div className="flex items-start gap-4">
                            <div className={cn(
                              "h-14 w-14 rounded-xl flex items-center justify-center bg-gradient-to-br text-white shadow-lg",
                              useCase.color
                            )}>
                              <Icon className="h-7 w-7" />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">{useCase.title}</h3>
                                {selectedUseCase === useCase.id && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="ml-auto"
                                  >
                                    <Check className="h-5 w-5 text-primary" />
                                  </motion.div>
                                )}
                              </div>
                              <p className="text-sm text-primary font-medium">{useCase.subtitle}</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {useCase.description}
                              </p>
                              
                              <div className="flex gap-2 mt-3">
                                {useCase.features.map((feature, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {feature}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </button>
                  </HoverScale>
                </motion.div>
              )
            })}
          </div>
        </div>
      ),
      validation: () => selectedUseCase !== ''
    },
    {
      id: 'companies',
      title: 'Select companies to monitor',
      subtitle: 'Start with popular choices or search for specific ones',
      description: 'You can always add more companies later',
      icon: Building,
      color: 'from-green-500 to-emerald-500',
      content: (
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search companies by name or category..."
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Tabs defaultValue="popular" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="popular">Popular</TabsTrigger>
              <TabsTrigger value="category">By Category</TabsTrigger>
              <TabsTrigger value="risk">By Risk Level</TabsTrigger>
            </TabsList>
            
            <TabsContent value="popular" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <AnimatePresence mode="popLayout">
                  {filteredCompanies.map((company, index) => (
                    <motion.div
                      key={company.slug}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <button
                        onClick={() => {
                          setSelectedCompanies(prev => 
                            prev.includes(company.slug)
                              ? prev.filter(s => s !== company.slug)
                              : [...prev, company.slug]
                          )
                        }}
                        className="w-full group"
                      >
                        <Card className={cn(
                          "p-4 cursor-pointer transition-all text-center relative overflow-hidden",
                          selectedCompanies.includes(company.slug)
                            ? "border-primary bg-primary/5 shadow-lg"
                            : "hover:border-primary/50 hover:shadow-md"
                        )}>
                          <AnimatePresence>
                            {selectedCompanies.includes(company.slug) && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="absolute top-2 right-2"
                              >
                                <Check className="h-4 w-4 text-primary" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                          
                          <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                            {company.icon}
                          </div>
                          <div className="font-medium text-sm">{company.name}</div>
                          <Badge 
                            variant={
                              company.riskLevel === 'high' ? 'destructive' :
                              company.riskLevel === 'medium' ? 'warning' : 'secondary'
                            } 
                            className="text-xs mt-1"
                          >
                            {company.riskLevel} risk
                          </Badge>
                        </Card>
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </TabsContent>
            
            <TabsContent value="category" className="space-y-4">
              <div className="text-center text-muted-foreground p-8">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p>Category view coming soon</p>
              </div>
            </TabsContent>
            
            <TabsContent value="risk" className="space-y-4">
              <div className="text-center text-muted-foreground p-8">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p>Risk level view coming soon</p>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedCompanies.length} companies selected
              {selectedCompanies.length > 0 && (
                <span className="text-primary ml-1">
                  • {selectedCompanies.length > 5 ? 'Great coverage!' : 'Select a few more for better insights'}
                </span>
              )}
            </div>
            <Button variant="link" size="sm">
              Can\'t find a company? Request it →
            </Button>
          </div>
        </div>
      ),
      validation: () => selectedCompanies.length > 0
    },
    {
      id: 'plan',
      title: 'Choose your plan',
      subtitle: '14-day free trial on all plans',
      description: 'Upgrade, downgrade, or cancel anytime',
      icon: CreditCard,
      color: 'from-amber-500 to-orange-500',
      content: (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan, index) => {
              const Icon = plan.icon
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <button
                    onClick={() => setSelectedPlan(plan.id)}
                    className="w-full h-full"
                  >
                    <Card className={cn(
                      "relative h-full p-6 cursor-pointer transition-all duration-300",
                      selectedPlan === plan.id 
                        ? "border-primary shadow-xl ring-2 ring-primary ring-offset-2 scale-105" 
                        : "hover:border-primary/50 hover:shadow-lg hover:scale-105",
                      plan.popular && "border-primary/50"
                    )}>
                      {plan.popular && (
                        <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 badge-gradient">
                          Most Popular
                        </Badge>
                      )}
                      
                      <div className="space-y-4">
                        <div className={cn(
                          "h-12 w-12 rounded-lg flex items-center justify-center bg-gradient-to-br text-white mx-auto",
                          plan.color
                        )}>
                          <Icon className="h-6 w-6" />
                        </div>
                        
                        <div className="text-center">
                          <h3 className="font-semibold text-lg">{plan.name}</h3>
                          <div className="flex items-baseline justify-center gap-1 mt-2">
                            <span className="text-3xl font-bold">{plan.price}</span>
                            <span className="text-muted-foreground">{plan.period}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {plan.description}
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          {plan.features.map((feature, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                        
                        {selectedPlan === plan.id && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-4 right-4"
                          >
                            <Check className="h-5 w-5 text-primary" />
                          </motion.div>
                        )}
                      </div>
                    </Card>
                  </button>
                </motion.div>
              )
            })}
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              <Gift className="h-4 w-4 inline mr-1" />
              All plans include a 14-day free trial. No credit card required.
            </p>
          </div>
        </div>
      ),
      validation: () => selectedPlan !== ''
    },
    {
      id: 'notifications',
      title: 'Set up your notifications',
      subtitle: 'Stay informed without being overwhelmed',
      description: 'Fine-tune how and when we alert you about policy changes',
      icon: Bell,
      color: 'from-pink-500 to-rose-500',
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            {[
              {
                id: 'emailAlerts',
                title: 'Email Alerts',
                description: 'Get notified about policy changes via email',
                icon: Bell,
                recommended: true
              },
              {
                id: 'majorChangesOnly',
                title: 'Major Changes Only',
                description: 'Filter out minor updates and focus on significant changes',
                icon: AlertTriangle,
                recommended: true
              },
              {
                id: 'weeklyDigest',
                title: 'Weekly Digest',
                description: 'Receive a comprehensive summary every Monday',
                icon: Clock
              },
              {
                id: 'riskAlerts',
                title: 'High-Risk Alerts',
                description: 'Immediate notifications for critical privacy changes',
                icon: Shield,
                recommended: true
              },
              {
                id: 'competitorUpdates',
                title: 'Competitor Updates',
                description: 'Track when competitors update their policies',
                icon: TrendingUp,
                businessOnly: true
              }
            ].map((pref, index) => {
              const Icon = pref.icon
              const isBusinessOnly = pref.businessOnly && selectedUseCase !== 'business'
              
              return (
                <motion.div
                  key={pref.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <label className={cn(
                    "flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all",
                    preferences[pref.id as keyof typeof preferences] && !isBusinessOnly
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50",
                    isBusinessOnly && "opacity-50 cursor-not-allowed"
                  )}>
                    <input
                      type="checkbox"
                      checked={preferences[pref.id as keyof typeof preferences]}
                      onChange={(e) => !isBusinessOnly && setPreferences(prev => ({
                        ...prev,
                        [pref.id]: e.target.checked
                      }))}
                      className="mt-0.5"
                      disabled={isBusinessOnly}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="font-medium">{pref.title}</span>
                        {pref.recommended && (
                          <Badge variant="secondary" className="text-xs">
                            Recommended
                          </Badge>
                        )}
                        {isBusinessOnly && (
                          <Badge variant="outline" className="text-xs">
                            Business only
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {pref.description}
                      </p>
                    </div>
                  </label>
                </motion.div>
              )
            })}
          </div>
          
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="h-4 w-4 text-amber-600" />
              Pro Tip
            </div>
            <p className="text-sm text-muted-foreground">
              Start with recommended settings and adjust based on your needs. 
              You can change these anytime in your account settings.
            </p>
          </div>
        </div>
      ),
      validation: () => true
    },
    {
      id: 'complete',
      title: 'Welcome to PolicyDiff Pro!',
      subtitle: 'Your privacy command center is ready',
      description: 'Let\'s dive into your personalized dashboard',
      icon: Check,
      color: 'from-green-500 to-emerald-500',
      content: (
        <div className="space-y-8">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="mx-auto h-32 w-32 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 p-1 mb-6"
            >
              <div className="h-full w-full rounded-full bg-background flex items-center justify-center">
                <Check className="h-16 w-16 text-green-600" />
              </div>
            </motion.div>
            
            <h3 className="text-3xl font-bold mb-3">You\'re All Set!</h3>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Your personalized privacy monitoring system is ready to protect your digital rights.
            </p>
          </div>
          
          <div className="grid gap-4 max-w-lg mx-auto">
            <Card className="glass-card p-6">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                Your Setup Summary
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Use Case</span>
                  <span className="font-medium">
                    {useCases.find(u => u.id === selectedUseCase)?.title}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Companies</span>
                  <span className="font-medium">{selectedCompanies.length} selected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium capitalize">{selectedPlan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Notifications</span>
                  <span className="font-medium">
                    {Object.values(preferences).filter(Boolean).length} active
                  </span>
                </div>
              </div>
            </Card>
            
            <Card className="glass-card p-6">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Quick Start Guide
              </h4>
              <div className="space-y-2">
                {[
                  'View your AI-powered dashboard',
                  'Try analyzing any privacy policy',
                  'Set up custom risk alerts',
                  'Explore historical changes'
                ].map((action, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <ChevronRight className="h-4 w-4 text-primary" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          
          <div className="text-center">
            <Button 
              size="lg" 
              className="btn-premium min-w-[200px]"
            >
              <PlayCircle className="h-5 w-5 mr-2" />
              Launch Dashboard
            </Button>
          </div>
        </div>
      ),
      validation: () => true
    }
  ]

  const handleNext = async () => {
    if (currentStep === steps.length - 1) {
      // Save preferences and redirect
      try {
        if (user) {
          await updatePreferences({
            watchlist: selectedCompanies,
            notifications: {
              email: preferences.emailAlerts,
              majorChanges: preferences.majorChangesOnly,
              weeklyDigest: preferences.weeklyDigest
            }
          })
        }
        
        showSuccessToast(
          'Welcome to PolicyDiff!',
          'Your account has been set up successfully.'
        )
        
        router.push('/dashboard')
      } catch (error) {
        showErrorToast(
          'Setup failed',
          'There was an error saving your preferences. Please try again.'
        )
      }
    } else {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentStep(prev => prev + 1)
        setIsTransitioning(false)
      }, 300)
    }
  }

  const handleBack = () => {
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentStep(prev => prev - 1)
      setIsTransitioning(false)
    }, 300)
  }

  const canProceed = () => {
    const step = steps[currentStep]
    return step && (!step.validation || step.validation())
  }

  const currentStepData = steps[currentStep]
  
  if (!currentStepData) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="absolute inset-0 bg-grid-slate-100/5 dark:bg-grid-slate-800/5" />
      </div>

      <div className="w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Progress bar */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-primary to-secondary"
                  initial={{ width: '0%' }}
                  animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
            <div className="relative flex justify-between">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                    index <= currentStep
                      ? "bg-primary text-primary-foreground shadow-lg scale-110"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    index + 1
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main card */}
          <Card className="glass-card overflow-hidden">
            <div className={cn(
              "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
              currentStepData.color
            )} />
            
            <CardHeader className="text-center pb-4">
              <motion.div
                key={currentStep}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "mx-auto mb-4 h-16 w-16 rounded-2xl flex items-center justify-center bg-gradient-to-br text-white shadow-xl",
                  currentStepData.color
                )}
              >
                {React.createElement(currentStepData.icon, {
                  className: "h-8 w-8"
                })}
              </motion.div>
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <CardTitle className="text-2xl">{currentStepData.title}</CardTitle>
                  {currentStepData.subtitle && (
                    <p className="text-lg text-primary mt-1">{currentStepData.subtitle}</p>
                  )}
                  <CardDescription className="mt-2">
                    {currentStepData.description}
                  </CardDescription>
                </motion.div>
              </AnimatePresence>
            </CardHeader>
            
            <CardContent className="pt-2 pb-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentStepData.content}
                </motion.div>
              </AnimatePresence>
              
              <div className="flex items-center justify-between mt-8">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 0 || isTransitioning}
                  className={cn(
                    "min-w-[120px]",
                    currentStep === 0 && "invisible"
                  )}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                
                <div className="flex items-center gap-1">
                  {steps.map((_, index) => (
                    <motion.div
                      key={index}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        index === currentStep
                          ? "w-8 bg-primary"
                          : index < currentStep
                          ? "w-1.5 bg-primary/50"
                          : "w-1.5 bg-muted"
                      )}
                      whileHover={{ scale: 1.2 }}
                    />
                  ))}
                </div>
                
                <Button
                  onClick={handleNext}
                  disabled={!canProceed() || isTransitioning}
                  className="btn-premium min-w-[120px]"
                >
                  {currentStep === steps.length - 1 ? (
                    <>
                      Complete
                      <Check className="h-4 w-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Skip option */}
          {currentStep < steps.length - 1 && (
            <div className="text-center">
              <Button
                variant="link"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="text-muted-foreground"
              >
                Skip for now →
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}