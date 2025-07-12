/**
 * Production-Ready Privacy Score Display Component
 * 
 * Displays comprehensive privacy scores, grades, and risk assessments
 * with interactive breakdowns and actionable insights
 */

'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  Lock,
  Eye,
  Users,
  Clock,
  Database,
  Share2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

interface PrivacyScoreDisplayProps {
  score: number
  grade: string
  riskLevel: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  dimensions: {
    DATA_COLLECTION: { score: number; findings: string[] }
    USER_CONTROL: { score: number; findings: string[] }
    DATA_SHARING: { score: number; findings: string[] }
    TRANSPARENCY: { score: number; findings: string[] }
    SECURITY: { score: number; findings: string[] }
    RETENTION: { score: number; findings: string[] }
  }
  topRisks?: Array<{
    category: string
    risk: string
    severity: number
    description: string
  }>
  compliance?: {
    gdpr: boolean
    ccpa: boolean
    coppa: boolean
    hipaa?: boolean
  }
  comparisons?: {
    industry_average: number
    percentile: number
    trend: 'improving' | 'stable' | 'worsening'
  }
  recommendations?: Array<{
    priority: 'high' | 'medium' | 'low'
    action: string
    impact: string
  }>
  onActionClick?: (action: string) => void
}

const gradeColors = {
  'A+': 'text-green-600 dark:text-green-400',
  'A': 'text-green-600 dark:text-green-400',
  'A-': 'text-green-600 dark:text-green-400',
  'B+': 'text-blue-600 dark:text-blue-400',
  'B': 'text-blue-600 dark:text-blue-400',
  'B-': 'text-blue-600 dark:text-blue-400',
  'C+': 'text-yellow-600 dark:text-yellow-400',
  'C': 'text-yellow-600 dark:text-yellow-400',
  'C-': 'text-yellow-600 dark:text-yellow-400',
  'D+': 'text-orange-600 dark:text-orange-400',
  'D': 'text-orange-600 dark:text-orange-400',
  'D-': 'text-orange-600 dark:text-orange-400',
  'F': 'text-red-600 dark:text-red-400'
}

const riskColors = {
  MINIMAL: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', icon: ShieldCheck },
  LOW: { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', icon: Shield },
  MEDIUM: { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', icon: Shield },
  HIGH: { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', icon: ShieldAlert },
  CRITICAL: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', icon: ShieldAlert }
}

const dimensionIcons = {
  DATA_COLLECTION: Database,
  USER_CONTROL: Users,
  DATA_SHARING: Share2,
  TRANSPARENCY: Eye,
  SECURITY: Lock,
  RETENTION: Clock
}

const dimensionLabels = {
  DATA_COLLECTION: 'Data Collection',
  USER_CONTROL: 'User Control',
  DATA_SHARING: 'Data Sharing',
  TRANSPARENCY: 'Transparency',
  SECURITY: 'Security',
  RETENTION: 'Data Retention'
}

export function PrivacyScoreDisplay({
  score,
  grade,
  riskLevel,
  dimensions,
  topRisks = [],
  compliance,
  comparisons,
  recommendations = [],
  onActionClick
}: PrivacyScoreDisplayProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState('overview')

  const RiskIcon = riskColors[riskLevel].icon

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400'
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      {/* Main Score Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Grade Circle */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="relative"
              >
                <div className="w-24 h-24 rounded-full bg-white dark:bg-gray-900 shadow-lg flex items-center justify-center">
                  <span className={cn('text-3xl font-bold', gradeColors[grade as keyof typeof gradeColors])}>
                    {grade}
                  </span>
                </div>
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="absolute inset-0"
                >
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${(score / 100) * 264} 264`}
                      className={cn('transition-all duration-1000', getScoreColor(score))}
                    />
                  </svg>
                </motion.div>
              </motion.div>

              {/* Score Details */}
              <div>
                <h2 className="text-2xl font-bold mb-1">Privacy Score: {score}/100</h2>
                <div className="flex items-center gap-3">
                  <Badge className={cn(riskColors[riskLevel].bg, riskColors[riskLevel].text)}>
                    <RiskIcon className="w-3 h-3 mr-1" />
                    {riskLevel} Risk
                  </Badge>
                  {comparisons && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className="gap-1">
                            {comparisons.trend === 'improving' && <TrendingUp className="w-3 h-3" />}
                            {comparisons.trend === 'worsening' && <TrendingDown className="w-3 h-3" />}
                            Top {comparisons.percentile}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Better than {comparisons.percentile}% of companies</p>
                          <p className="text-xs text-muted-foreground">
                            Industry average: {comparisons.industry_average}/100
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>

            {/* Compliance Badges */}
            {compliance && (
              <div className="flex gap-2">
                {compliance.gdpr && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                    GDPR
                  </Badge>
                )}
                {compliance.ccpa && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                    CCPA
                  </Badge>
                )}
                {compliance.coppa && (
                  <Badge variant="secondary" className="bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300">
                    COPPA
                  </Badge>
                )}
                {compliance.hipaa && (
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
                    HIPAA
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Detailed Analysis Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Quick Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Privacy Analysis Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dimension Overview */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(dimensions).map(([key, data]) => {
                  const Icon = dimensionIcons[key as keyof typeof dimensionIcons]
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {dimensionLabels[key as keyof typeof dimensionLabels]}
                          </span>
                        </div>
                        <span className={cn('text-sm font-bold', getScoreColor(data.score))}>
                          {data.score}
                        </span>
                      </div>
                      <Progress value={data.score} className="h-2" />
                    </div>
                  )
                })}
              </div>

              {/* Key Findings */}
              {topRisks.length > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Top Concerns
                  </h4>
                  <ul className="space-y-1">
                    {topRisks.slice(0, 3).map((risk, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-orange-500 mt-0.5">•</span>
                        <span>{risk.risk}: {risk.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dimensions" className="space-y-4">
          {Object.entries(dimensions).map(([key, data]) => {
            const Icon = dimensionIcons[key as keyof typeof dimensionIcons]
            const isExpanded = expandedSection === key
            
            return (
              <Card key={key} className="overflow-hidden">
                <CardHeader 
                  className="cursor-pointer"
                  onClick={() => toggleSection(key)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        data.score >= 80 ? 'bg-green-100 dark:bg-green-900/20' :
                        data.score >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                        'bg-red-100 dark:bg-red-900/20'
                      )}>
                        <Icon className={cn(
                          'w-5 h-5',
                          data.score >= 80 ? 'text-green-600 dark:text-green-400' :
                          data.score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        )} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {dimensionLabels[key as keyof typeof dimensionLabels]}
                        </CardTitle>
                        <CardDescription>
                          Score: {data.score}/100
                        </CardDescription>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp /> : <ChevronDown />}
                  </div>
                </CardHeader>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CardContent className="pt-0">
                        <Progress value={data.score} className="h-3 mb-4" />
                        {data.findings.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold">Key Findings:</h4>
                            <ul className="space-y-1">
                              {data.findings.map((finding, index) => (
                                <li key={index} className="text-sm flex items-start gap-2">
                                  <span className={finding.startsWith('Strong') ? 'text-green-500' : 'text-orange-500'}>
                                    {finding.startsWith('Strong') ? '✓' : '!'}
                                  </span>
                                  <span className="text-muted-foreground">{finding}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Assessment</CardTitle>
              <CardDescription>
                Identified privacy risks and their severity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topRisks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>No significant privacy risks identified</p>
                </div>
              ) : (
                topRisks.map((risk, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className={cn(
                      'p-2 rounded-lg',
                      risk.severity >= 80 ? 'bg-red-100 dark:bg-red-900/20' :
                      risk.severity >= 60 ? 'bg-orange-100 dark:bg-orange-900/20' :
                      'bg-yellow-100 dark:bg-yellow-900/20'
                    )}>
                      <AlertTriangle className={cn(
                        'w-4 h-4',
                        risk.severity >= 80 ? 'text-red-600 dark:text-red-400' :
                        risk.severity >= 60 ? 'text-orange-600 dark:text-orange-400' :
                        'text-yellow-600 dark:text-yellow-400'
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium">{risk.risk}</h4>
                        <Badge variant="outline" className={cn(
                          risk.severity >= 80 ? 'text-red-600 border-red-600' :
                          risk.severity >= 60 ? 'text-orange-600 border-orange-600' :
                          'text-yellow-600 border-yellow-600'
                        )}>
                          Severity: {risk.severity}%
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{risk.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Category: {risk.category}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommended Actions</CardTitle>
              <CardDescription>
                Steps you can take to protect your privacy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recommendations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Info className="w-12 h-12 mx-auto mb-2" />
                  <p>No specific actions needed at this time</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={
                              rec.priority === 'high' ? 'destructive' :
                              rec.priority === 'medium' ? 'default' :
                              'secondary'
                            }>
                              {rec.priority} priority
                            </Badge>
                          </div>
                          <h4 className="font-medium mb-1">{rec.action}</h4>
                          <p className="text-sm text-muted-foreground">{rec.impact}</p>
                        </div>
                        {onActionClick && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onActionClick(rec.action)}
                          >
                            Take Action
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}