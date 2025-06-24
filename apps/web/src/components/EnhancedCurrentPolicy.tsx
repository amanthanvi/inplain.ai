'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AIAnalysisPanel } from '@/components/ai/AIAnalysisPanel'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useStreamingAnalysis } from '@/hooks/useStreamingAnalysis'
import { InteractiveMarkdown } from './InteractiveMarkdown'
import { formatAnalysisToMarkdown } from '@/lib/analysis-formatter'
import { 
  FileText, Calendar, Hash, Sparkles, Shield, AlertCircle, 
  Clock, BarChart3, TrendingUp, Download, ExternalLink,
  Eye, ChevronRight, Info
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { FadeIn, SlideIn, HoverScale } from '@/components/ui/framer-animations'
import { cn } from '@/lib/utils'
import { useAuth } from '@clerk/nextjs'

interface EnhancedCurrentPolicyProps {
  slug: string
}

interface PolicyMetric {
  label: string
  value: string | number
  icon: any
  trend?: 'up' | 'down' | 'neutral'
  color?: string
}

export function EnhancedCurrentPolicy({ slug }: EnhancedCurrentPolicyProps) {
  const [snapshot, setSnapshot] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const streaming = useStreamingAnalysis()
  const { userId, isLoaded } = useAuth()

  useEffect(() => {
    fetchSnapshot()
  }, [slug])

  const fetchSnapshot = async () => {
    try {
      const response = await fetch(`/api/snapshot/${slug}`)
      
      if (response.status === 404) {
        setSnapshot(null)
        setLoading(false)
        return
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch snapshot')
      }
      
      const data = await response.json()
      setSnapshot(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policy')
    } finally {
      setLoading(false)
    }
  }

  const analyzePolicy = async () => {
    setAnalyzing(true)
    setError(null)
    try {
      const response = await fetch(`/api/analyze/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          analysisType: 'comprehensive',
          includeRiskScore: true 
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error('Please sign in to use AI analysis features')
        }
        throw new Error(errorData.error || `Analysis failed (${response.status})`)
      }
      
      const data = await response.json()
      if (data.analysis) {
        setAnalysis(data.analysis)
      } else {
        throw new Error('No analysis data received')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze policy'
      setError(errorMessage)
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    )
  }

  if (!snapshot) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No policy snapshot available</p>
            <p className="text-sm text-muted-foreground mt-1">
              The first snapshot will be captured during the next daily check
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const metrics: PolicyMetric[] = [
    {
      label: 'Words',
      value: snapshot.content.wordCount.toLocaleString(),
      icon: FileText,
      color: 'text-blue-600'
    },
    {
      label: 'Reading Time',
      value: `${Math.ceil(snapshot.content.wordCount / 200)} min`,
      icon: Clock,
      color: 'text-green-600'
    },
    {
      label: 'Complexity',
      value: snapshot.content.characterCount > 10000 ? 'High' : 'Medium',
      icon: BarChart3,
      color: 'text-amber-600'
    },
    {
      label: 'Last Updated',
      value: formatDistanceToNow(new Date(snapshot.snapshot.capturedAt), { addSuffix: true }),
      icon: Calendar,
      color: 'text-purple-600'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <FadeIn>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
          <CardHeader className="relative">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">Current Policy Analysis</CardTitle>
                <CardDescription className="mt-2">
                  Comprehensive overview and AI-powered insights
                </CardDescription>
              </div>
              <Badge variant="secondary" className="animate-pulse">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Ready
              </Badge>
            </div>
          </CardHeader>
        </Card>
      </FadeIn>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <SlideIn key={metric.label} delay={index * 0.05} direction="up">
              <HoverScale>
                <Card className="relative overflow-hidden hover:shadow-lg transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                        <p className="text-xl font-semibold mt-1">{metric.value}</p>
                      </div>
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center",
                        "bg-muted"
                      )}>
                        <Icon className={cn("h-4 w-4", metric.color)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </HoverScale>
            </SlideIn>
          )
        })}
      </div>

      {/* Main Content Tabs */}
      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
              <TabsTrigger value="details">Full Details</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <TabsContent value="overview" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Privacy Score</p>
                    <p className="text-sm text-muted-foreground">Based on policy transparency</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">7.5/10</p>
                  <Badge variant="secondary">Good</Badge>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Data Collection Practices</span>
                  <Badge variant="outline">Moderate</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Third-party Sharing</span>
                  <Badge variant="outline">Limited</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">User Rights</span>
                  <Badge variant="outline">Comprehensive</Badge>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm" asChild>
                  <a href={snapshot.snapshot.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Original
                  </a>
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ai-analysis">
            <AIAnalysisPanel
              slug={slug}
              onAnalyze={analyzePolicy}
              isAnalyzing={analyzing || streaming.isStreaming}
              analysis={analysis || streaming.analysis}
              error={error || streaming.error}
            />
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <h4 className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Policy Content Preview
              </h4>
              <div className="mt-3 p-4 bg-muted/50 rounded-lg max-h-96 overflow-y-auto">
                <p className="text-sm text-muted-foreground line-clamp-10">
                  {snapshot.content.text?.substring(0, 1000)}...
                </p>
              </div>
              <Button 
                variant="outline" 
                className="mt-4 w-full"
                onClick={() => setActiveTab('ai-analysis')}
              >
                Get AI Analysis
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </TabsContent>
        </CardContent>
      </Card>
    </div>
  )
}