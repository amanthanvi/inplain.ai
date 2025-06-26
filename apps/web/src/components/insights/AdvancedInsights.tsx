'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertTriangle,
  TrendingUp,
  Shield,
  Lightbulb,
  Eye,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  Target,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  Zap,
  Brain,
  Gauge,
  GitBranch,
  Layers,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EnhancedInsight } from '@/lib/ai/enhanced-ai-service'

// Visualization components
import { 
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart
} from 'recharts'

interface AdvancedInsightsProps {
  insights: EnhancedInsight[]
  loading?: boolean
  onInsightClick?: (insight: EnhancedInsight) => void
  viewMode?: 'grid' | 'list' | 'timeline'
  filters?: {
    types?: string[]
    severities?: string[]
    minConfidence?: number
  }
}

const insightIcons = {
  risk: AlertTriangle,
  opportunity: Lightbulb,
  trend: TrendingUp,
  comparison: GitBranch,
  prediction: Eye,
  recommendation: Target
}

const severityColors = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'warning',
  low: 'secondary',
  info: 'default'
} as const

const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']

export function AdvancedInsights({
  insights,
  loading = false,
  onInsightClick,
  viewMode = 'grid',
  filters
}: AdvancedInsightsProps) {
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set())
  const [selectedTab, setSelectedTab] = useState<string>('all')
  const [animatedMetrics, setAnimatedMetrics] = useState<Record<string, number>>({})

  // Filter insights based on criteria
  const filteredInsights = insights.filter(insight => {
    if (filters?.types && !filters.types.includes(insight.type)) return false
    if (filters?.severities && !filters.severities.includes(insight.severity)) return false
    if (filters?.minConfidence && insight.confidence < filters.minConfidence) return false
    return true
  })

  // Group insights by type for tabs
  const groupedInsights = filteredInsights.reduce((acc, insight) => {
    const type = insight.type
    if (!acc[type]) acc[type] = []
    acc[type].push(insight)
    return acc
  }, {} as Record<string, EnhancedInsight[]>)

  // Animate metrics on mount
  useEffect(() => {
    const metrics: Record<string, number> = {}
    insights.forEach(insight => {
      if (insight.details.metrics) {
        Object.entries(insight.details.metrics).forEach(([key, value]) => {
          const uniqueKey = `${insight.id}-${key}`
          metrics[uniqueKey] = 0
          setTimeout(() => {
            setAnimatedMetrics(prev => ({ ...prev, [uniqueKey]: value }))
          }, 100)
        })
      }
    })
  }, [insights])

  const toggleExpanded = (insightId: string) => {
    setExpandedInsights(prev => {
      const newSet = new Set(prev)
      if (newSet.has(insightId)) {
        newSet.delete(insightId)
      } else {
        newSet.add(insightId)
      }
      return newSet
    })
  }

  const renderInsightCard = (insight: EnhancedInsight) => {
    const Icon = insightIcons[insight.type]
    const isExpanded = expandedInsights.has(insight.id)

    return (
      <motion.div
        key={insight.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn(
          "group cursor-pointer",
          viewMode === 'list' && "mb-4"
        )}
        onClick={() => onInsightClick?.(insight)}
      >
        <Card className="h-full hover:shadow-lg transition-all duration-200 border-l-4"
          style={{
            borderLeftColor: insight.severity === 'critical' ? '#ef4444' :
                           insight.severity === 'high' ? '#f59e0b' :
                           insight.severity === 'medium' ? '#3b82f6' :
                           '#10b981'
          }}
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  insight.type === 'risk' && "bg-red-100 dark:bg-red-900/20",
                  insight.type === 'opportunity' && "bg-green-100 dark:bg-green-900/20",
                  insight.type === 'trend' && "bg-blue-100 dark:bg-blue-900/20",
                  insight.type === 'prediction' && "bg-purple-100 dark:bg-purple-900/20",
                  insight.type === 'recommendation' && "bg-yellow-100 dark:bg-yellow-900/20",
                  insight.type === 'comparison' && "bg-pink-100 dark:bg-pink-900/20"
                )}>
                  <Icon className={cn(
                    "h-5 w-5",
                    insight.type === 'risk' && "text-red-600 dark:text-red-400",
                    insight.type === 'opportunity' && "text-green-600 dark:text-green-400",
                    insight.type === 'trend' && "text-blue-600 dark:text-blue-400",
                    insight.type === 'prediction' && "text-purple-600 dark:text-purple-400",
                    insight.type === 'recommendation' && "text-yellow-600 dark:text-yellow-400",
                    insight.type === 'comparison' && "text-pink-600 dark:text-pink-400"
                  )} />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{insight.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={severityColors[insight.severity]}>
                      {insight.severity}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Gauge className="h-3 w-3" />
                      {Math.round(insight.confidence * 100)}% confidence
                    </Badge>
                    {insight.details.timeline && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {insight.details.timeline}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpanded(insight.id)
                }}
              >
                {isExpanded ? <ChevronUp /> : <ChevronDown />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{insight.summary}</p>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* Evidence */}
                  {insight.details.evidence.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Evidence
                      </h4>
                      <ul className="space-y-1">
                        {insight.details.evidence.map((evidence, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{evidence}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Implications */}
                  {insight.details.implications.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Implications
                      </h4>
                      <ul className="space-y-1">
                        {insight.details.implications.map((implication, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-yellow-500 mt-0.5">!</span>
                            <span>{implication}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  {insight.details.actions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Recommended Actions
                      </h4>
                      <ul className="space-y-1">
                        {insight.details.actions.map((action, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Metrics Visualization */}
                  {insight.details.metrics && Object.keys(insight.details.metrics).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Metrics
                      </h4>
                      {renderMetricsVisualization(insight)}
                    </div>
                  )}

                  {/* Related Insights */}
                  {insight.relatedInsights && insight.relatedInsights.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Related Insights
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {insight.relatedInsights.map((relatedId) => {
                          const related = insights.find(i => i.id === relatedId)
                          if (!related) return null
                          return (
                            <Badge
                              key={relatedId}
                              variant="outline"
                              className="cursor-pointer hover:bg-accent"
                              onClick={(e) => {
                                e.stopPropagation()
                                onInsightClick?.(related)
                              }}
                            >
                              {related.title}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sources */}
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Sources: {insight.sources.join(', ')}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  const renderMetricsVisualization = (insight: EnhancedInsight) => {
    if (!insight.visualData || !insight.details.metrics) return null

    const metrics = Object.entries(insight.details.metrics)
    const data = metrics.map(([key, value]) => ({
      name: key,
      value: animatedMetrics[`${insight.id}-${key}`] || 0,
      fullValue: value
    }))

    if (insight.visualData.type === 'chart' && insight.visualData.data.type === 'gauge' && metrics.length > 0) {
      // Render gauge chart for single metric
      const firstMetric = metrics[0]
      if (!firstMetric) return null
      const value = animatedMetrics[`${insight.id}-${firstMetric[0]}`] || 0
      const percentage = (value / insight.visualData.data.max) * 100

      return (
        <div className="relative h-32">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold">{Math.round(value)}</div>
              <div className="text-sm text-muted-foreground">{firstMetric[0]}</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { value: percentage, fill: percentage > 70 ? '#10b981' : percentage > 30 ? '#f59e0b' : '#ef4444' },
                  { value: 100 - percentage, fill: '#e5e7eb' }
                ]}
                cx="50%"
                cy="50%"
                startAngle={180}
                endAngle={0}
                innerRadius={40}
                outerRadius={60}
                paddingAngle={0}
                dataKey="value"
              >
                {[
                  { value: percentage, fill: percentage > 70 ? '#10b981' : percentage > 30 ? '#f59e0b' : '#ef4444' },
                  { value: 100 - percentage, fill: '#e5e7eb' }
                ].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )
    }

    if (insight.visualData.type === 'chart' && insight.visualData.data.type === 'radar') {
      // Render radar chart for multiple metrics
      return (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.6}
              />
              <ChartTooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )
    }

    // Default bar chart for other metrics
    return (
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <ChartTooltip />
            <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderOverviewMetrics = () => {
    const criticalCount = filteredInsights.filter(i => i.severity === 'critical').length
    const highCount = filteredInsights.filter(i => i.severity === 'high').length
    const avgConfidence = filteredInsights.reduce((sum, i) => sum + i.confidence, 0) / filteredInsights.length || 0

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredInsights.length}</div>
            <p className="text-xs text-muted-foreground">
              {insights.length - filteredInsights.length} filtered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <Progress value={(criticalCount / filteredInsights.length) * 100} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{highCount}</div>
            <Progress value={(highCount / filteredInsights.length) * 100} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgConfidence * 100)}%</div>
            <div className="flex items-center gap-1 mt-2">
              <Brain className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">AI Analysis</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Metrics */}
      {renderOverviewMetrics()}

      {/* Insights Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="all" className="gap-2">
            <Activity className="h-4 w-4" />
            All ({filteredInsights.length})
          </TabsTrigger>
          {Object.entries(groupedInsights).map(([type, typeInsights]) => {
            const Icon = insightIcons[type as keyof typeof insightIcons]
            return (
              <TabsTrigger key={type} value={type} className="gap-2">
                <Icon className="h-4 w-4" />
                {type} ({typeInsights.length})
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className={cn(
            viewMode === 'grid' && "grid grid-cols-1 md:grid-cols-2 gap-4",
            viewMode === 'list' && "space-y-4",
            viewMode === 'timeline' && "relative"
          )}>
            {filteredInsights.map(renderInsightCard)}
          </div>
        </TabsContent>

        {Object.entries(groupedInsights).map(([type, typeInsights]) => (
          <TabsContent key={type} value={type} className="mt-6">
            <div className={cn(
              viewMode === 'grid' && "grid grid-cols-1 md:grid-cols-2 gap-4",
              viewMode === 'list' && "space-y-4",
              viewMode === 'timeline' && "relative"
            )}>
              {typeInsights.map(renderInsightCard)}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* AI Analysis Badge */}
      <div className="flex items-center justify-center pt-4">
        <Badge variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Powered by Advanced AI Analysis
        </Badge>
      </div>
    </div>
  )
}