'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, Shield,
  Calendar, Filter, Download, RefreshCw, Eye, Users,
  Clock, Globe, Zap, Target, Brain, Star
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  FadeIn, SlideIn, ScaleIn, HoverScale,
  Counter, PulseAnimation 
} from '@/components/ui/framer-animations'

// Mock data generators for analytics
const generateTrendData = (points: number) => {
  return Array.from({ length: points }, (_, i) => ({
    date: new Date(Date.now() - (points - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    value: Math.floor(Math.random() * 100) + 20
  }))
}

const riskMetrics = [
  { label: 'Data Collection', current: 7.2, previous: 6.8, trend: 'up' },
  { label: 'Third-Party Sharing', current: 5.4, previous: 5.9, trend: 'down' },
  { label: 'Retention Policies', current: 6.1, previous: 6.0, trend: 'up' },
  { label: 'User Rights', current: 8.3, previous: 7.9, trend: 'up' },
  { label: 'Transparency', current: 7.8, previous: 7.5, trend: 'up' }
]

const companyRankings = [
  { company: 'Apple', score: 9.2, change: '+0.3', category: 'tech' },
  { company: 'Signal', score: 9.0, change: '0.0', category: 'messaging' },
  { company: 'DuckDuckGo', score: 8.8, change: '+0.1', category: 'search' },
  { company: 'Microsoft', score: 7.9, change: '+0.2', category: 'tech' },
  { company: 'Google', score: 6.5, change: '-0.1', category: 'tech' },
  { company: 'Meta', score: 4.2, change: '-0.4', category: 'social' },
  { company: 'TikTok', score: 3.1, change: '-0.2', category: 'social' }
]

const industryTrends = [
  { sector: 'Technology', avgScore: 6.8, change: 2.3, companies: 45 },
  { sector: 'Social Media', avgScore: 4.1, change: -1.2, companies: 12 },
  { sector: 'E-commerce', avgScore: 5.9, change: 0.8, companies: 28 },
  { sector: 'Finance', avgScore: 7.2, change: 1.5, companies: 19 },
  { sector: 'Healthcare', avgScore: 8.1, change: 0.4, companies: 15 }
]

interface ChartProps {
  data: any[]
  title: string
  color?: string
}

function TrendChart({ data, title, color = 'primary' }: ChartProps) {
  const maxValue = Math.max(...data.map(d => d.value))
  
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
      <div className="relative h-32">
        <svg className="w-full h-full" viewBox="0 0 400 120">
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" className="text-primary" stopOpacity="0.3" />
              <stop offset="100%" className="text-primary" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <line
              key={y}
              x1="0"
              y1={120 - (y / 100 * 100)}
              x2="400"
              y2={120 - (y / 100 * 100)}
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeWidth="1"
            />
          ))}
          
          {/* Data area */}
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            d={`M 0,${120 - (data[0]?.value / maxValue * 100)} ${data.map((point, i) => 
              `L ${(i / (data.length - 1)) * 400},${120 - (point.value / maxValue * 100)}`
            ).join(' ')}`}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
          
          {/* Data points */}
          {data.map((point, i) => (
            <motion.circle
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.1 + 1, duration: 0.3 }}
              cx={(i / (data.length - 1)) * 400}
              cy={120 - (point.value / maxValue * 100)}
              r="3"
              fill="hsl(var(--primary))"
            />
          ))}
        </svg>
      </div>
    </div>
  )
}

function RiskMeter({ score, label, max = 10 }: { score: number, label: string, max?: number }) {
  const percentage = (score / max) * 100
  const getColor = (score: number) => {
    if (score >= 8) return 'from-green-500 to-emerald-500'
    if (score >= 6) return 'from-amber-500 to-orange-500'
    return 'from-red-500 to-rose-500'
  }
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-bold">{score.toFixed(1)}</span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, delay: 0.2 }}
          className={cn(
            "h-full bg-gradient-to-r rounded-full",
            getColor(score)
          )}
        />
      </div>
    </div>
  )
}

export function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [timeRange, setTimeRange] = useState('30d')
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const trendData = generateTrendData(30)
  const changeData = generateTrendData(30)
  
  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }
  
  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 sm:w-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="trends" className="text-xs sm:text-sm">Trends</TabsTrigger>
            <TabsTrigger value="companies" className="text-xs sm:text-sm">Companies</TabsTrigger>
            <TabsTrigger value="risks" className="text-xs sm:text-sm">Risks</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="flex-shrink-0">
            <Filter className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Filter</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="flex-shrink-0">
            <RefreshCw className={cn("h-4 w-4 sm:mr-2", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" className="flex-shrink-0">
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              {[
                { title: 'Avg Privacy Score', value: 6.8, suffix: '/10', change: '+0.3', icon: Shield },
                { title: 'Policy Changes', value: 47, suffix: '', change: '+12%', icon: TrendingUp },
                { title: 'Risk Alerts', value: 8, suffix: '', change: '-25%', icon: AlertTriangle },
                { title: 'Coverage', value: 95, suffix: '%', change: '+5%', icon: Target }
              ].map((metric, index) => {
                const Icon = metric.icon
                return (
                  <ScaleIn key={metric.title} delay={index * 0.1}>
                    <Card className="glass-card hover:shadow-lg transition-all group">
                      <CardContent className="p-3 md:p-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                          <div className="flex-1">
                            <p className="text-xs md:text-sm text-muted-foreground truncate">{metric.title}</p>
                            <div className="flex items-baseline gap-1">
                              <span className="text-lg md:text-2xl font-bold">
                                <Counter to={metric.value} duration={1.5} />
                              </span>
                              <span className="text-xs md:text-sm text-muted-foreground">{metric.suffix}</span>
                            </div>
                            <p className="text-xs text-green-600 mt-1">{metric.change}</p>
                          </div>
                          <Icon className="h-6 w-6 md:h-8 md:w-8 text-primary/30 group-hover:text-primary group-hover:scale-110 transition-all mt-2 md:mt-0 self-end md:self-auto" />
                        </div>
                      </CardContent>
                    </Card>
                  </ScaleIn>
                )
              })}
            </div>
            
            {/* Charts Grid */}
            <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Privacy Score Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TrendChart data={trendData} title="30-Day Average" />
                </CardContent>
              </Card>
              
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Policy Changes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TrendChart data={changeData} title="Monthly Changes" color="secondary" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="trends" className="space-y-4 md:space-y-6">
            <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
              {/* Industry Trends */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Industry Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {industryTrends.map((industry, index) => (
                      <SlideIn key={industry.sector} direction="right" delay={index * 0.05}>
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div>
                            <div className="font-medium">{industry.sector}</div>
                            <div className="text-sm text-muted-foreground">
                              {industry.companies} companies
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{industry.avgScore.toFixed(1)}</div>
                            <div className={cn(
                              "text-sm flex items-center gap-1",
                              industry.change > 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {industry.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {Math.abs(industry.change)}%
                            </div>
                          </div>
                        </div>
                      </SlideIn>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Risk Categories */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Risk Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {riskMetrics.map((metric, index) => (
                      <FadeIn key={metric.label} delay={index * 0.1}>
                        <RiskMeter score={metric.current} label={metric.label} />
                      </FadeIn>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="companies" className="space-y-4 md:space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Privacy Score Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {companyRankings.map((company, index) => (
                    <SlideIn key={company.company} direction="left" delay={index * 0.05}>
                      <div className="flex items-center justify-between p-3 md:p-4 rounded-xl border hover:bg-muted/50 transition-colors group">
                        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                          <div className="text-lg md:text-2xl font-bold text-muted-foreground/50 flex-shrink-0">
                            #{index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{company.company}</div>
                            <Badge variant="outline" className="text-xs mt-1">
                              {company.category}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-lg md:text-2xl font-bold">
                              {company.score.toFixed(1)}
                            </div>
                            <div className={cn(
                              "text-xs",
                              company.change.startsWith('+') ? "text-green-600" :
                              company.change.startsWith('-') ? "text-red-600" :
                              "text-muted-foreground"
                            )}>
                              {company.change}
                            </div>
                          </div>
                          
                          <div className="w-12 md:w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(company.score / 10) * 100}%` }}
                              transition={{ duration: 1, delay: index * 0.1 }}
                              className={cn(
                                "h-full rounded-full",
                                company.score >= 8 ? "bg-green-500" :
                                company.score >= 6 ? "bg-amber-500" :
                                "bg-red-500"
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </SlideIn>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="risks" className="space-y-4 md:space-y-6">
            <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
              <Card className="glass-card lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Risk Assessment Matrix
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-square max-w-md mx-auto relative">
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1">
                      {Array.from({ length: 9 }, (_, i) => {
                        const row = Math.floor(i / 3)
                        const col = i % 3
                        const intensity = row * 3 + col + 1
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className={cn(
                              "rounded-lg flex items-center justify-center text-xs font-medium",
                              intensity <= 3 ? "bg-green-100 text-green-800" :
                              intensity <= 6 ? "bg-amber-100 text-amber-800" :
                              "bg-red-100 text-red-800"
                            )}
                          >
                            {Math.floor(Math.random() * 5)}
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    Risk distribution across impact and likelihood
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base">Action Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { text: "Review Meta data policies", priority: "high" },
                      { text: "Update TikTok monitoring", priority: "medium" },
                      { text: "Check Google changes", priority: "low" }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          item.priority === 'high' ? "bg-red-500" :
                          item.priority === 'medium' ? "bg-amber-500" :
                          "bg-green-500"
                        )} />
                        <span className="text-sm">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}