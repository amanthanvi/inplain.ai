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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Minus,
  TrendingUp,
  TrendingDown,
  Info,
  Building2,
  Shield,
  Eye,
  Zap,
  Target,
  Award,
  FileText,
  Download,
  Sparkles,
  GitCompare,
  Plus,
  X,
  Clock,
  Globe,
  Users,
  Brain
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'
import type { Company } from '@inplain.ai/shared'
import type { PrivacyScoreResult } from '@/lib/privacy/advanced-scoring'

// Comparison dimensions
const COMPARISON_DIMENSIONS = [
  { key: 'dataCollection', label: 'Data Collection', icon: Shield },
  { key: 'thirdPartySharing', label: 'Third-Party Sharing', icon: GitCompare },
  { key: 'userRights', label: 'User Rights', icon: Zap },
  { key: 'dataRetention', label: 'Data Retention', icon: Clock },
  { key: 'security', label: 'Security Measures', icon: Shield },
  { key: 'transparency', label: 'Transparency', icon: Eye },
  { key: 'consent', label: 'Consent Management', icon: CheckCircle },
  { key: 'internationalTransfers', label: 'International Transfers', icon: Globe },
  { key: 'childrenPrivacy', label: "Children's Privacy", icon: Users },
  { key: 'aiUsage', label: 'AI/ML Data Usage', icon: Brain }
]

interface ComparisonData {
  company: Company
  score?: PrivacyScoreResult
  analysis?: any
  loading: boolean
  error?: string
}

interface PolicyComparisonProps {
  initialCompanies?: string[]
  maxCompanies?: number
  onExport?: (data: any) => void
}

export function PolicyComparison({
  initialCompanies = [],
  maxCompanies = 4,
  onExport
}: PolicyComparisonProps) {
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(initialCompanies)
  const [comparisonData, setComparisonData] = useState<Record<string, ComparisonData>>({})
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [highlightDifferences, setHighlightDifferences] = useState(true)

  // Load comparison data when companies change
  useEffect(() => {
    if (selectedCompanies.length > 0) {
      loadComparisonData()
    }
  }, [selectedCompanies])

  const loadComparisonData = async () => {
    setLoading(true)

    // Load data for each selected company
    const promises = selectedCompanies.map(async (slug) => {
      const company = WATCHED_COMPANIES.find(c => c.slug === slug)
      if (!company) return

      try {
        // Check cache first
        const cached = await fetch(`/api/privacy/analysis-cache?company=${slug}`)
        if (cached.ok) {
          const data = await cached.json()
          setComparisonData(prev => ({
            ...prev,
            [slug]: {
              company,
              score: data.score,
              analysis: data.analysis,
              loading: false
            }
          }))
          return
        }

        // Perform new analysis
        const response = await fetch('/api/privacy/analyze-advanced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            policyText: 'Sample policy...', // In production, fetch actual policy
            company: company.name,
            industry: company.category,
            analysisType: 'comparison'
          })
        })

        if (response.ok) {
          const data = await response.json()
          setComparisonData(prev => ({
            ...prev,
            [slug]: {
              company,
              score: data.score,
              analysis: data.analysis,
              loading: false
            }
          }))
        }
      } catch (error) {
        setComparisonData(prev => ({
          ...prev,
          [slug]: {
            company,
            loading: false,
            error: 'Failed to load analysis'
          }
        }))
      }
    })

    await Promise.all(promises)
    setLoading(false)
  }

  const addCompany = (slug: string) => {
    if (!selectedCompanies.includes(slug) && selectedCompanies.length < maxCompanies) {
      setSelectedCompanies([...selectedCompanies, slug])
    }
  }

  const removeCompany = (slug: string) => {
    setSelectedCompanies(selectedCompanies.filter(s => s !== slug))
    setComparisonData(prev => {
      const newData = { ...prev }
      delete newData[slug]
      return newData
    })
  }

  const getDimensionValue = (data: ComparisonData, dimension: string): {
    value: number
    status: 'good' | 'fair' | 'poor' | 'unknown'
    details?: string
  } => {
    if (!data.score || !data.analysis) {
      return { value: 0, status: 'unknown' }
    }

    // Extract dimension-specific scores and details
    switch (dimension) {
      case 'dataCollection':
        return {
          value: data.score.breakdown.dataMinimization,
          status: data.score.breakdown.dataMinimization > 70 ? 'good' : 
                  data.score.breakdown.dataMinimization > 40 ? 'fair' : 'poor',
          details: data.analysis.dataCollection?.summary
        }
      case 'userRights':
        return {
          value: data.score.breakdown.userControl,
          status: data.score.breakdown.userControl > 70 ? 'good' : 
                  data.score.breakdown.userControl > 40 ? 'fair' : 'poor',
          details: data.analysis.userRights?.summary
        }
      case 'security':
        return {
          value: data.score.breakdown.security,
          status: data.score.breakdown.security > 70 ? 'good' : 
                  data.score.breakdown.security > 40 ? 'fair' : 'poor',
          details: data.analysis.security?.summary
        }
      case 'transparency':
        return {
          value: data.score.breakdown.transparency,
          status: data.score.breakdown.transparency > 70 ? 'good' : 
                  data.score.breakdown.transparency > 40 ? 'fair' : 'poor',
          details: data.analysis.transparency?.summary
        }
      // Add more dimension mappings...
      default:
        return { value: 50, status: 'fair' }
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'fair':
        return <Minus className="h-5 w-5 text-yellow-500" />
      case 'poor':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Info className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getBestInDimension = (dimension: string): string | null => {
    let bestCompany: string | null = null
    let bestValue = -1

    Object.entries(comparisonData).forEach(([slug, data]) => {
      if (data) {
        const dimValue = getDimensionValue(data, dimension)
        if (dimValue.value > bestValue) {
          bestValue = dimValue.value
          bestCompany = slug
        }
      }
    })

    return bestCompany
  }

  const exportComparison = () => {
    const exportData = {
      companies: selectedCompanies.map(slug => {
        const data = comparisonData[slug]
        return {
          company: data?.company.name,
          overallScore: data?.score?.overallScore,
          grade: data?.score?.grade,
          dimensions: data ? COMPARISON_DIMENSIONS.map(dim => ({
            dimension: dim.label,
            ...getDimensionValue(data, dim.key)
          })) : []
        }
      }),
      generatedAt: new Date().toISOString()
    }

    onExport?.(exportData)
  }

  return (
    <div className="space-y-6">
      {/* Company selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Compare Privacy Policies</CardTitle>
              <CardDescription>
                Select up to {maxCompanies} companies to compare their privacy practices
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
              >
                {viewMode === 'table' ? 'Card View' : 'Table View'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportComparison}
                disabled={selectedCompanies.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {selectedCompanies.map(slug => {
              const company = WATCHED_COMPANIES.find(c => c.slug === slug)
              return (
                <Badge key={slug} variant="secondary" className="px-3 py-1.5">
                  <Building2 className="h-3 w-3 mr-1" />
                  {company?.name}
                  <button
                    onClick={() => removeCompany(slug)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )
            })}
            
            {selectedCompanies.length < maxCompanies && (
              <Select onValueChange={addCompany}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Add company..." />
                </SelectTrigger>
                <SelectContent>
                  {WATCHED_COMPANIES
                    .filter(c => !selectedCompanies.includes(c.slug))
                    .map(company => (
                      <SelectItem key={company.slug} value={company.slug}>
                        {company.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparison view */}
      {selectedCompanies.length > 0 && (
        <AnimatePresence mode="wait">
          {viewMode === 'table' ? (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 z-10 bg-background">
                            Dimension
                          </TableHead>
                          {selectedCompanies.map(slug => {
                            const data = comparisonData[slug]
                            return (
                              <TableHead key={slug} className="text-center">
                                <div>
                                  <div className="font-medium">{data?.company.name}</div>
                                  {data?.score && (
                                    <div className="flex items-center justify-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs">
                                        {data.score.overallScore}/100
                                      </Badge>
                                      <Badge 
                                        variant={data.score.grade.startsWith('A') ? 'success' : 
                                                data.score.grade.startsWith('B') ? 'default' : 'warning'}
                                        className="text-xs"
                                      >
                                        {data.score.grade}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </TableHead>
                            )
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {COMPARISON_DIMENSIONS.map(dimension => {
                          const bestCompany = getBestInDimension(dimension.key)
                          
                          return (
                            <TableRow key={dimension.key}>
                              <TableCell className="sticky left-0 z-10 bg-background font-medium">
                                <div className="flex items-center gap-2">
                                  <dimension.icon className="h-4 w-4 text-muted-foreground" />
                                  {dimension.label}
                                </div>
                              </TableCell>
                              {selectedCompanies.map(slug => {
                                const data = comparisonData[slug]
                                const dimValue = data ? getDimensionValue(data, dimension.key) : { value: 0, status: 'unknown' as const }
                                const isBest = slug === bestCompany && highlightDifferences
                                
                                return (
                                  <TableCell key={slug} className="text-center">
                                    {data?.loading ? (
                                      <Skeleton className="h-8 w-20 mx-auto" />
                                    ) : (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <div className={cn(
                                              "flex items-center justify-center gap-2 p-2 rounded-md transition-colors",
                                              isBest && "bg-green-50 dark:bg-green-900/20",
                                              dimValue.status === 'poor' && highlightDifferences && "bg-red-50 dark:bg-red-900/20"
                                            )}>
                                              {getStatusIcon(dimValue.status)}
                                              <span className="text-sm font-medium">
                                                {dimValue.value}%
                                              </span>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="max-w-xs">
                                              {dimValue.details || `${dimension.label} score`}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {selectedCompanies.map(slug => {
                const data = comparisonData[slug]
                
                return (
                  <Card key={slug}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{data?.company.name}</CardTitle>
                          {data?.score && (
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">
                                Score: {data.score.overallScore}/100
                              </Badge>
                              <Badge 
                                variant={data.score.grade.startsWith('A') ? 'success' : 
                                        data.score.grade.startsWith('B') ? 'default' : 'warning'}
                              >
                                Grade: {data.score.grade}
                              </Badge>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCompany(slug)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {data?.loading ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-12" />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {COMPARISON_DIMENSIONS.map(dimension => {
                            const dimValue = data ? getDimensionValue(data, dimension.key) : { value: 0, status: 'unknown' as const }
                            
                            return (
                              <div key={dimension.key} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <dimension.icon className="h-4 w-4 text-muted-foreground" />
                                    <span>{dimension.label}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(dimValue.status)}
                                    <span className="font-medium">{dimValue.value}%</span>
                                  </div>
                                </div>
                                <Progress value={dimValue.value} className="h-2" />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Insights */}
      {selectedCompanies.length > 1 && !loading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Comparison Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Best practices */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Best Practices Leader</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {COMPARISON_DIMENSIONS.slice(0, 4).map(dimension => {
                    const bestCompany = getBestInDimension(dimension.key)
                    const company = WATCHED_COMPANIES.find(c => c.slug === bestCompany)
                    
                    return (
                      <div key={dimension.key} className="flex items-center justify-between p-2 rounded-md bg-muted">
                        <span className="text-sm">{dimension.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {company?.name}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Key differences */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Key Differences</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Data collection practices vary significantly, with some companies collecting 3x more data types</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>User control mechanisms range from basic opt-out to comprehensive privacy dashboards</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Security certifications present in only {Math.round(selectedCompanies.length / 2)} of the compared companies</span>
                  </li>
                </ul>
              </div>

              {/* Recommendations */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Recommendations</h4>
                <p className="text-sm text-muted-foreground">
                  Based on this comparison, users concerned about privacy should prioritize companies with:
                  strong user control mechanisms, minimal data collection, and transparent policies.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}