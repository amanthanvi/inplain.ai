'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  ExternalLink, Bell, Star, Shield, Activity, 
  FileText, History, TrendingUp, ChevronRight,
  Building2, Clock, AlertCircle, Sparkles,
  BarChart3, Brain, Zap, Eye, Download,
  Share2, RefreshCw, Gauge, Target, Award,
  CheckCircle
} from 'lucide-react'
import { AdvancedInsights } from '@/components/insights/AdvancedInsights'
import { AnimatedContainer } from '@/components/ui/animations'
import { cn } from '@/lib/utils'
import type { Company } from '@inplain.ai/shared'
import type { EnhancedInsight } from '@/lib/ai/enhanced-ai-service'
import type { PrivacyScoreResult } from '@/lib/privacy/advanced-scoring'

// Score visualization component
function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const getColor = () => {
    if (score >= 80) return '#10b981'
    if (score >= 60) return '#3b82f6'
    if (score >= 40) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className="relative h-48 w-48 mx-auto">
      <svg className="transform -rotate-90 w-48 h-48">
        <circle
          cx="96"
          cy="96"
          r="88"
          stroke="currentColor"
          strokeWidth="12"
          fill="none"
          className="text-muted-foreground/20"
        />
        <circle
          cx="96"
          cy="96"
          r="88"
          stroke={getColor()}
          strokeWidth="12"
          fill="none"
          strokeDasharray={`${(score / 100) * 553} 553`}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-5xl font-bold">{score}</div>
        <div className="text-2xl font-semibold text-muted-foreground">{grade}</div>
        <div className="text-sm text-muted-foreground mt-1">Privacy Score</div>
      </div>
    </div>
  )
}

// Dimension breakdown component
function DimensionBreakdown({ dimensions }: { dimensions: PrivacyScoreResult['breakdown'] }) {
  const dimensionInfo = {
    dataMinimization: { label: 'Data Minimization', icon: Shield },
    purposeLimitation: { label: 'Purpose Limitation', icon: Target },
    transparency: { label: 'Transparency', icon: Eye },
    userControl: { label: 'User Control', icon: Zap },
    security: { label: 'Security', icon: Shield },
    accountability: { label: 'Accountability', icon: Award },
    lawfulness: { label: 'Lawfulness', icon: FileText }
  }

  return (
    <div className="space-y-3">
      {Object.entries(dimensions).map(([key, score]) => {
        const info = dimensionInfo[key as keyof typeof dimensionInfo]
        const Icon = info?.icon || Shield
        
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{info?.label || key}</span>
              </div>
              <span className="font-medium">{score}/100</span>
            </div>
            <Progress value={score} className="h-2" />
          </div>
        )
      })}
    </div>
  )
}

interface EnhancedCompanyPageProps {
  company: Company
}

export function EnhancedCompanyPage({ company }: EnhancedCompanyPageProps) {
  const { user, isLoaded: userLoaded } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisStage, setAnalysisStage] = useState('')
  const [scoreResult, setScoreResult] = useState<PrivacyScoreResult | null>(null)
  const [insights, setInsights] = useState<EnhancedInsight[]>([])
  const [comparison, setComparison] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [isWatched, setIsWatched] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Load analysis on mount
  useEffect(() => {
    loadAnalysis()
  }, [company.slug])

  const loadAnalysis = async (fresh = false) => {
    try {
      setLoading(true)
      setAnalysisProgress(0)
      
      // Check if we have cached analysis
      if (!fresh) {
        const cached = await fetch(`/api/privacy/analysis-cache?company=${company.slug}`)
        if (cached.ok) {
          const data = await cached.json()
          if (data.score && data.insights) {
            setScoreResult(data.score)
            setInsights(data.insights)
            setComparison(data.comparison)
            setLoading(false)
            return
          }
        }
      }

      // Perform new analysis with streaming
      const response = await fetch('/api/privacy/analyze-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyText: 'Sample privacy policy text...', // In production, fetch actual policy
          company: company.name,
          industry: company.category,
          analysisType: 'comprehensive',
          perspectives: ['privacyExpert', 'userAdvocate', 'securityAdvisor'],
          includeComparison: true,
          streamResponse: true
        })
      })

      if (!response.ok) throw new Error('Analysis failed')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('event:')) {
            const event = line.slice(6).trim()
            const dataLine = lines[lines.indexOf(line) + 1]
            
            if (dataLine?.startsWith('data:')) {
              const data = JSON.parse(dataLine.slice(5))
              
              switch (event) {
                case 'progress':
                  setAnalysisProgress(data.progress * 100)
                  setAnalysisStage(data.stage)
                  break
                case 'score':
                  setScoreResult(data)
                  break
                case 'insights':
                  setInsights(data)
                  break
                case 'comparison':
                  setComparison(data)
                  break
                case 'complete':
                  setLoading(false)
                  break
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setLoading(false)
      // Show error state
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAnalysis(true)
    setRefreshing(false)
  }

  const handleWatchToggle = async () => {
    if (!user) {
      router.push('/login')
      return
    }

    try {
      const endpoint = isWatched ? '/api/watchlist/remove' : '/api/watchlist/add'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companySlug: company.slug })
      })

      if (response.ok) {
        setIsWatched(!isWatched)
      }
    } catch (error) {
      console.error('Watchlist error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="container py-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Loading header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-lg" />
                <div>
                  <Skeleton className="h-8 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </div>

            {/* Analysis progress */}
            <Card>
              <CardContent className="py-12">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="flex items-center justify-center mb-4">
                    <Brain className="h-12 w-12 text-primary animate-pulse" />
                  </div>
                  <h3 className="text-xl font-semibold text-center">Analyzing Privacy Policy</h3>
                  <p className="text-sm text-muted-foreground text-center">{analysisStage}</p>
                  <Progress value={analysisProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {Math.round(analysisProgress)}% complete
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Enhanced header */}
      <div className="bg-gradient-to-b from-primary/5 to-background">
        <div className="container py-8">
          <AnimatedContainer animation="slideUp">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{company.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="success">
                        <Activity className="h-3 w-3 mr-1" />
                        Active Monitoring
                      </Badge>
                      {company.category && (
                        <Badge variant="secondary">
                          {company.category}
                        </Badge>
                      )}
                      {scoreResult && (
                        <Badge variant={scoreResult.grade.startsWith('A') ? 'success' : 
                                       scoreResult.grade.startsWith('B') ? 'default' :
                                       'warning'}>
                          Grade: {scoreResult.grade}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <p className="text-muted-foreground max-w-2xl">
                  Advanced AI-powered privacy policy analysis with real-time monitoring and insights
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={isWatched ? "default" : "outline"}
                  onClick={handleWatchToggle}
                  disabled={!userLoaded}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  {isWatched ? 'Watching' : 'Watch'}
                </Button>
                <Button variant="outline" asChild>
                  <a href={company.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Policy
                  </a>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                  Refresh
                </Button>
                <Button variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </AnimatedContainer>
        </div>
      </div>

      {/* Main content */}
      <div className="container py-8">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full mb-8">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="insights">AI Insights</TabsTrigger>
              <TabsTrigger value="details">Policy Details</TabsTrigger>
              <TabsTrigger value="history">Change History</TabsTrigger>
              <TabsTrigger value="comparison">Compare</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-8">
              {/* Score overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle>Privacy Score</CardTitle>
                    <CardDescription>
                      AI-powered privacy assessment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {scoreResult && (
                      <ScoreGauge score={scoreResult.overallScore} grade={scoreResult.grade} />
                    )}
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Score Breakdown</CardTitle>
                    <CardDescription>
                      Privacy principles evaluation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {scoreResult && (
                      <DimensionBreakdown dimensions={scoreResult.breakdown} />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Industry Rank</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      #{comparison?.rank || '-'} / {comparison?.totalCompanies || '-'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Better than {comparison?.betterThan || 0}%
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Privacy Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      <span className="text-2xl font-bold">
                        {scoreResult?.comparison.trend || 'stable'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Risk Level</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={
                      scoreResult && scoreResult.overallScore > 70 ? 'success' :
                      scoreResult && scoreResult.overallScore > 50 ? 'warning' :
                      'destructive'
                    } className="text-lg py-1 px-3">
                      {scoreResult && scoreResult.overallScore > 70 ? 'Low' :
                       scoreResult && scoreResult.overallScore > 50 ? 'Medium' : 'High'}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Certifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {scoreResult?.certifications.map(cert => (
                        <Badge key={cert} variant="outline" className="text-xs">
                          {cert}
                        </Badge>
                      )) || <span className="text-muted-foreground">None</span>}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Strengths and weaknesses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-green-500" />
                      Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {scoreResult?.strengths.map((strength, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                      Areas for Improvement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {scoreResult?.improvements.map((improvement, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-yellow-500 mt-0.5">!</span>
                          <span>{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Privacy flags */}
              {scoreResult?.flags && Object.values(scoreResult.flags).some(v => v) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Privacy Concerns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {Object.entries(scoreResult.flags).map(([flag, active]) => (
                        <div key={flag} className={cn(
                          "flex items-center gap-2",
                          !active && "opacity-50"
                        )}>
                          {active ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          <span className="text-sm capitalize">
                            {flag.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="insights">
              <AdvancedInsights
                insights={insights}
                loading={loading}
                viewMode="grid"
              />
            </TabsContent>

            <TabsContent value="details">
              {/* Policy details content */}
              <Card>
                <CardHeader>
                  <CardTitle>Current Privacy Policy Analysis</CardTitle>
                  <CardDescription>
                    Detailed breakdown of privacy practices
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Detailed policy analysis coming soon...
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              {/* Change history content */}
              <Card>
                <CardHeader>
                  <CardTitle>Policy Change History</CardTitle>
                  <CardDescription>
                    Track all privacy policy updates over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Change history visualization coming soon...
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comparison">
              {/* Comparison content */}
              <Card>
                <CardHeader>
                  <CardTitle>Industry Comparison</CardTitle>
                  <CardDescription>
                    Compare privacy practices with industry peers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Comparison tools coming soon...
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}