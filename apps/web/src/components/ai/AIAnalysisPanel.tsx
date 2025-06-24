'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Sparkles, Loader2, AlertCircle, CheckCircle, Info, 
  TrendingUp, Shield, Eye, Brain, Zap, ChevronRight,
  MessageSquare, FileText, BarChart3, AlertTriangle, LogIn
} from 'lucide-react'
import { HoverScale, FadeIn, SlideIn } from '@/components/ui/framer-animations'
import { cn } from '@/lib/utils'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'

interface AIAnalysisPanelProps {
  slug: string
  onAnalyze: () => Promise<void>
  isAnalyzing: boolean
  analysis?: any
  error?: string
}

const analysisPrompts = [
  {
    id: 'summary',
    icon: FileText,
    title: 'Quick Summary',
    description: 'Get a concise overview of the key changes',
    prompt: 'Summarize the main changes in 3-5 bullet points',
    color: 'text-blue-600'
  },
  {
    id: 'impact',
    icon: AlertTriangle,
    title: 'User Impact',
    description: 'Understand how changes affect your privacy',
    prompt: 'What do these changes mean for users?',
    color: 'text-amber-600'
  },
  {
    id: 'comparison',
    icon: BarChart3,
    title: 'Before vs After',
    description: 'Compare what changed between versions',
    prompt: 'Show me what changed from the previous version',
    color: 'text-green-600'
  },
  {
    id: 'risks',
    icon: Shield,
    title: 'Risk Analysis',
    description: 'Identify potential privacy concerns',
    prompt: 'What are the privacy risks in these changes?',
    color: 'text-red-600'
  }
]

const aiCapabilities = [
  { icon: Brain, text: 'Natural language understanding' },
  { icon: Zap, text: 'Instant analysis' },
  { icon: Eye, text: 'Privacy-focused insights' },
  { icon: MessageSquare, text: 'Plain English explanations' }
]

export function AIAnalysisPanel({ 
  slug, 
  onAnalyze, 
  isAnalyzing, 
  analysis, 
  error 
}: AIAnalysisPanelProps) {
  const [selectedPrompt, setSelectedPrompt] = useState('summary')
  const [showGuidance, setShowGuidance] = useState(true)
  const { userId, isLoaded } = useAuth()

  const handleAnalyze = async (promptId: string) => {
    setSelectedPrompt(promptId)
    setShowGuidance(false)
    await onAnalyze()
  }

  if (!analysis && !isAnalyzing && showGuidance) {
    // Show authentication prompt if not logged in
    if (isLoaded && !userId) {
      return (
        <Card className="relative overflow-hidden border-amber-200 bg-amber-50/50">
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <LogIn className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle>Sign In Required</CardTitle>
                  <CardDescription>
                    Create a free account to use AI analysis features
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative space-y-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Get AI-powered insights including:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Plain English summaries of policy changes
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Privacy risk analysis and recommendations
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Side-by-side version comparisons
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  GDPR and CCPA compliance insights
                </li>
              </ul>
            </div>
            <div className="flex gap-3 pt-2">
              <Button asChild className="flex-1">
                <Link href="/signup">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Get Started Free
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/login">
                  Sign In
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card className="relative overflow-hidden border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>AI Policy Analysis</CardTitle>
                <CardDescription>
                  Let our AI help you understand policy changes
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="animate-pulse">
              <Zap className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="relative space-y-6">
          {/* AI Capabilities */}
          <div className="grid grid-cols-2 gap-3">
            {aiCapabilities.map((capability, index) => {
              const Icon = capability.icon
              return (
                <FadeIn key={index} delay={index * 0.1}>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="h-4 w-4 text-primary" />
                    {capability.text}
                  </div>
                </FadeIn>
              )
            })}
          </div>

          {/* Analysis Options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Choose your analysis:</h4>
            <div className="grid gap-3">
              {analysisPrompts.map((prompt, index) => {
                const Icon = prompt.icon
                return (
                  <SlideIn key={prompt.id} delay={index * 0.05} direction="right">
                    <HoverScale>
                      <button
                        onClick={() => handleAnalyze(prompt.id)}
                        className="w-full text-left"
                        disabled={isAnalyzing}
                      >
                        <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center",
                              "bg-muted"
                            )}>
                              <Icon className={cn("h-4 w-4", prompt.color)} />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{prompt.title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {prompt.description}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                          </div>
                        </Card>
                      </button>
                    </HoverScale>
                  </SlideIn>
                )
              })}
            </div>
          </div>

          {/* Quick Start Button */}
          <div className="pt-2">
            <Button 
              onClick={() => handleAnalyze('summary')} 
              className="w-full"
              size="lg"
              disabled={isAnalyzing}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Start with Quick Summary
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {error ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : isAnalyzing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle className="h-5 w-5 text-primary" />
            )}
            AI Analysis
          </CardTitle>
          {!error && !isAnalyzing && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowGuidance(true)}
            >
              Try Another Analysis
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isAnalyzing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Analyzing policy changes...
              </span>
            </div>
            <div className="space-y-2">
              {['Understanding context', 'Identifying key changes', 'Generating insights'].map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    i === 0 ? "bg-primary animate-pulse" : "bg-muted"
                  )} />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="space-y-3">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
            {error.toLowerCase().includes('sign in') ? (
              <div className="flex gap-2">
                <Button size="sm" asChild>
                  <Link href="/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/signup">Create Account</Link>
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => handleAnalyze(selectedPrompt)}>
                Try Again
              </Button>
            )}
          </div>
        )}

        {analysis && !isAnalyzing && !error && (
          <div className="space-y-4">
            <Tabs defaultValue="formatted" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="formatted">Formatted</TabsTrigger>
                <TabsTrigger value="raw">Raw Output</TabsTrigger>
              </TabsList>
              <TabsContent value="formatted" className="space-y-4">
                {/* Render formatted analysis based on type */}
                <div className="prose prose-sm max-w-none">
                  {analysis.structured_content ? (
                    <div>
                      {/* Render structured content */}
                      {analysis.structured_content.summary && (
                        <div className="space-y-2">
                          <h4 className="font-medium flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Summary
                          </h4>
                          <p className="text-muted-foreground">
                            {analysis.structured_content.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">
                      {analysis.content || analysis.raw_content}
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="raw">
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                  {JSON.stringify(analysis, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Model: {analysis.model}</span>
                {analysis.cached && <Badge variant="secondary">Cached</Badge>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(analysis.content || analysis.raw_content)}
              >
                Copy
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}