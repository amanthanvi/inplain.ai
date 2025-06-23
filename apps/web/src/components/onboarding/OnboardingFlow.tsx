'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/contexts/auth-context'
import { 
  ArrowRight, ArrowLeft, Check, Sparkles, Shield, Bell, 
  BarChart3, Search, Users, Zap, Star, ChevronRight,
  Building, Eye, Brain, Target, Rocket
} from 'lucide-react'
import { FadeIn, SlideIn, ScaleIn, HoverScale } from '@/components/ui/framer-animations'
import { cn } from '@/lib/utils'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: any
  content: React.ReactNode
}

const popularCompanies = [
  { slug: 'google', name: 'Google', icon: '🔍' },
  { slug: 'facebook', name: 'Facebook', icon: '👤' },
  { slug: 'amazon', name: 'Amazon', icon: '📦' },
  { slug: 'microsoft', name: 'Microsoft', icon: '🪟' },
  { slug: 'apple', name: 'Apple', icon: '🍎' },
  { slug: 'netflix', name: 'Netflix', icon: '🎬' }
]

const useCases = [
  {
    id: 'personal',
    title: 'Personal Privacy',
    description: 'Track how companies use your personal data',
    icon: Shield,
    color: 'text-blue-600'
  },
  {
    id: 'business',
    title: 'Business Compliance',
    description: 'Monitor competitors and industry standards',
    icon: Building,
    color: 'text-purple-600'
  },
  {
    id: 'research',
    title: 'Research & Analysis',
    description: 'Study privacy trends and policy evolution',
    icon: BarChart3,
    color: 'text-green-600'
  },
  {
    id: 'legal',
    title: 'Legal Professional',
    description: 'Stay updated on policy changes for clients',
    icon: Users,
    color: 'text-amber-600'
  }
]

export { EnhancedOnboardingFlow as OnboardingFlow } from './EnhancedOnboardingFlow'

export function OnboardingFlowLegacy() {
  const router = useRouter()
  const { user, updatePreferences } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedUseCase, setSelectedUseCase] = useState<string>('')
  const [preferences, setPreferences] = useState({
    emailAlerts: true,
    majorChangesOnly: true,
    weeklyDigest: false
  })

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to PolicyDiff!',
      description: 'Let\'s get you set up in just a few steps',
      icon: Rocket,
      content: (
        <div className="space-y-6 text-center">
          <div className="mx-auto h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-12 w-12 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">
              Your Privacy Intelligence Platform
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              PolicyDiff helps you track privacy policy changes with AI-powered insights.
              Let's personalize your experience.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto pt-4">
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary" />
              <span>Real-time monitoring</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary" />
              <span>AI analysis</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary" />
              <span>Smart alerts</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary" />
              <span>Risk scoring</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'use-case',
      title: 'How will you use PolicyDiff?',
      description: 'This helps us tailor the experience for you',
      icon: Target,
      content: (
        <div className="space-y-4">
          <div className="grid gap-3">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon
              return (
                <SlideIn key={useCase.id} delay={index * 0.05} direction="right">
                  <HoverScale>
                    <button
                      onClick={() => setSelectedUseCase(useCase.id)}
                      className="w-full text-left"
                    >
                      <Card className={cn(
                        "p-4 cursor-pointer transition-all",
                        selectedUseCase === useCase.id 
                          ? "border-primary shadow-lg" 
                          : "hover:border-primary/50"
                      )}>
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <Icon className={cn("h-5 w-5", useCase.color)} />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{useCase.title}</div>
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {useCase.description}
                            </div>
                          </div>
                          {selectedUseCase === useCase.id && (
                            <Check className="h-5 w-5 text-primary mt-0.5" />
                          )}
                        </div>
                      </Card>
                    </button>
                  </HoverScale>
                </SlideIn>
              )
            })}
          </div>
        </div>
      )
    },
    {
      id: 'companies',
      title: 'Select companies to monitor',
      description: 'Choose from popular companies or search for others',
      icon: Building,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {popularCompanies.map((company, index) => (
              <ScaleIn key={company.slug} delay={index * 0.05}>
                <button
                  onClick={() => {
                    setSelectedCompanies(prev => 
                      prev.includes(company.slug)
                        ? prev.filter(s => s !== company.slug)
                        : [...prev, company.slug]
                    )
                  }}
                  className="w-full"
                >
                  <Card className={cn(
                    "p-4 cursor-pointer transition-all text-center",
                    selectedCompanies.includes(company.slug)
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}>
                    <div className="text-2xl mb-2">{company.icon}</div>
                    <div className="font-medium text-sm">{company.name}</div>
                    {selectedCompanies.includes(company.slug) && (
                      <Check className="h-4 w-4 text-primary mx-auto mt-2" />
                    )}
                  </Card>
                </button>
              </ScaleIn>
            ))}
          </div>
          <div className="text-center">
            <Button variant="outline" size="sm">
              <Search className="h-4 w-4 mr-2" />
              Browse All Companies
            </Button>
          </div>
          {selectedCompanies.length > 0 && (
            <div className="text-center text-sm text-muted-foreground">
              {selectedCompanies.length} companies selected
            </div>
          )}
        </div>
      )
    },
    {
      id: 'notifications',
      title: 'How should we notify you?',
      description: 'Stay informed about important policy changes',
      icon: Bell,
      content: (
        <div className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              <input
                type="checkbox"
                checked={preferences.emailAlerts}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  emailAlerts: e.target.checked
                }))}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium">Email Alerts</div>
                <div className="text-sm text-muted-foreground">
                  Get notified when policies change
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              <input
                type="checkbox"
                checked={preferences.majorChangesOnly}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  majorChangesOnly: e.target.checked
                }))}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium">Major Changes Only</div>
                <div className="text-sm text-muted-foreground">
                  Filter out minor updates and focus on significant changes
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              <input
                type="checkbox"
                checked={preferences.weeklyDigest}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  weeklyDigest: e.target.checked
                }))}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium">Weekly Digest</div>
                <div className="text-sm text-muted-foreground">
                  Receive a summary of all changes once a week
                </div>
              </div>
            </label>
          </div>
        </div>
      )
    },
    {
      id: 'complete',
      title: 'You\'re all set!',
      description: 'Welcome to your privacy intelligence dashboard',
      icon: Check,
      content: (
        <div className="space-y-6 text-center">
          <div className="mx-auto h-24 w-24 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <Check className="h-12 w-12 text-green-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Setup Complete!</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your dashboard is ready. You're now monitoring {selectedCompanies.length} companies
              with AI-powered insights.
            </p>
          </div>
          <div className="space-y-4 max-w-sm mx-auto">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="text-sm font-medium">Next Steps:</div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3" />
                  Explore your personalized dashboard
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3" />
                  Try AI analysis on any policy
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3" />
                  Set up custom alerts
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ]

  const handleNext = async () => {
    if (currentStep === steps.length - 1) {
      // Save preferences and redirect to dashboard
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
      router.push('/dashboard')
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    setCurrentStep(prev => prev - 1)
  }

  const canProceed = () => {
    const currentStepObj = steps[currentStep]
    if (!currentStepObj) return false
    
    switch (currentStepObj.id) {
      case 'use-case':
        return selectedUseCase !== ''
      case 'companies':
        return selectedCompanies.length > 0
      default:
        return true
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-subtle">
      <div className="w-full max-w-2xl">
        <FadeIn>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-muted">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
            
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                {React.createElement(steps[currentStep].icon, {
                  className: "h-6 w-6 text-primary"
                })}
              </div>
              <CardTitle className="text-2xl">{steps[currentStep].title}</CardTitle>
              <CardDescription>{steps[currentStep].description}</CardDescription>
            </CardHeader>
            
            <CardContent className="pt-6">
              {steps[currentStep].content}
              
              <div className="flex items-center justify-between mt-8">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className={cn(currentStep === 0 && "invisible")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                
                <div className="flex items-center gap-2">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        index === currentStep
                          ? "w-8 bg-primary"
                          : index < currentStep
                          ? "bg-primary/50"
                          : "bg-muted"
                      )}
                    />
                  ))}
                </div>
                
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  {currentStep === steps.length - 1 ? (
                    <>
                      Go to Dashboard
                      <Rocket className="h-4 w-4 ml-2" />
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
        </FadeIn>
      </div>
    </div>
  )
}