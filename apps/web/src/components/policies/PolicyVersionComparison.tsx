'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  GitCompare, ChevronLeft, ChevronRight, Calendar, FileText,
  AlertCircle, CheckCircle, X, Info, Download, Share2, Eye,
  TrendingUp, TrendingDown, Minus, Sparkles
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import DiffMatchPatch from 'diff-match-patch'
import { AnimatedContainer } from '@/components/ui/animations'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface PolicyVersion {
  id: string
  date: Date
  version: string
  changeCount: number
  changeType: 'minor' | 'moderate' | 'major'
  summary: string
  content: string
  stats?: {
    additions: number
    deletions: number
    modifications: number
  }
  aiAnalysis?: {
    impactScore: number
    keyChanges: string[]
    recommendations: string[]
  }
}

interface PolicyVersionComparisonProps {
  companySlug: string
  versions?: PolicyVersion[]
  className?: string
}

export function PolicyVersionComparison({ 
  companySlug, 
  versions: propVersions,
  className 
}: PolicyVersionComparisonProps) {
  const [versions, setVersions] = useState<PolicyVersion[]>(propVersions || [])
  const [selectedVersions, setSelectedVersions] = useState<[string, string]>(['', ''])
  const [viewMode, setViewMode] = useState<'unified' | 'split' | 'inline'>('unified')
  const [showOnlyChanges, setShowOnlyChanges] = useState(true)
  const [loading, setLoading] = useState(!propVersions)
  const [diffResults, setDiffResults] = useState<any[]>([])

  useEffect(() => {
    if (!propVersions) {
      // Fetch versions from API
      fetch(`/api/companies/${companySlug}/versions`)
        .then(res => res.json())
        .then(data => {
          // Generate mock data for now
          const mockVersions: PolicyVersion[] = Array.from({ length: 10 }, (_, i) => ({
            id: `v${i + 1}`,
            date: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000), // 30 days apart
            version: `${2024 - Math.floor(i / 4)}.${12 - (i % 12)}.${28 - i}`,
            changeCount: Math.floor(Math.random() * 20) + 5,
            changeType: ['minor', 'moderate', 'major'][Math.floor(Math.random() * 3)] as any,
            summary: `Updated ${['data collection', 'third-party sharing', 'user rights', 'cookie policy'][i % 4]} section`,
            content: generateMockPolicyContent(i),
            stats: {
              additions: Math.floor(Math.random() * 50) + 10,
              deletions: Math.floor(Math.random() * 30) + 5,
              modifications: Math.floor(Math.random() * 20) + 5
            },
            aiAnalysis: {
              impactScore: Math.floor(Math.random() * 30) + 70,
              keyChanges: [
                'Enhanced data retention policies',
                'Updated third-party partner list',
                'Clarified user opt-out procedures'
              ].slice(0, Math.floor(Math.random() * 3) + 1),
              recommendations: [
                'Review new data sharing agreements',
                'Update consent forms if applicable'
              ]
            }
          }))
          
          setVersions(mockVersions)
          if (mockVersions.length >= 2) {
            setSelectedVersions([mockVersions[1]?.id || '', mockVersions[0]?.id || ''])
          }
          setLoading(false)
        })
        .catch(err => {
          console.error('Failed to load versions:', err)
          setLoading(false)
        })
    }
  }, [companySlug, propVersions])

  useEffect(() => {
    if (selectedVersions[0] && selectedVersions[1]) {
      const v1 = versions.find(v => v.id === selectedVersions[0])
      const v2 = versions.find(v => v.id === selectedVersions[1])
      
      if (v1 && v2) {
        const dmp = new (DiffMatchPatch as any)()
        const diffs = dmp.diff_main(v1.content, v2.content)
        dmp.diff_cleanupSemantic(diffs)
        setDiffResults(diffs)
      }
    }
  }, [selectedVersions, versions])

  const renderDiffView = () => {
    if (!diffResults.length) return null

    switch (viewMode) {
      case 'unified':
        return (
          <div className="prose prose-sm max-w-none">
            {diffResults.map((diff, index) => {
              const [op, text] = diff
              if (op === 0) {
                return showOnlyChanges ? null : (
                  <span key={index} className="text-muted-foreground">{text}</span>
                )
              } else if (op === -1) {
                return (
                  <span key={index} className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through">
                    {text}
                  </span>
                )
              } else {
                return (
                  <span key={index} className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                    {text}
                  </span>
                )
              }
            })}
          </div>
        )
      
      case 'split':
        const leftContent: JSX.Element[] = []
        const rightContent: JSX.Element[] = []
        
        diffResults.forEach((diff, index) => {
          const [op, text] = diff
          if (op === 0) {
            const elem = <span key={index} className="text-muted-foreground">{text}</span>
            leftContent.push(elem)
            rightContent.push(elem)
          } else if (op === -1) {
            leftContent.push(
              <span key={index} className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                {text}
              </span>
            )
          } else {
            rightContent.push(
              <span key={index} className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                {text}
              </span>
            )
          }
        })
        
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="prose prose-sm max-w-none">
              <h4 className="text-sm font-medium mb-2">Previous Version</h4>
              {leftContent}
            </div>
            <div className="prose prose-sm max-w-none">
              <h4 className="text-sm font-medium mb-2">Current Version</h4>
              {rightContent}
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'minor': return <Minus className="h-4 w-4" />
      case 'moderate': return <TrendingUp className="h-4 w-4" />
      case 'major': return <TrendingDown className="h-4 w-4" />
      default: return <Info className="h-4 w-4" />
    }
  }

  const getChangeColor = (type: string) => {
    switch (type) {
      case 'minor': return 'text-blue-600 bg-blue-50'
      case 'moderate': return 'text-yellow-600 bg-yellow-50'
      case 'major': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const v1 = versions.find(v => v.id === selectedVersions[0])
  const v2 = versions.find(v => v.id === selectedVersions[1])

  return (
    <TooltipProvider>
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Version Comparison
              </CardTitle>
              <CardDescription>
                Compare different versions of privacy policies to track changes over time
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button size="sm" variant="outline">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Version Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Compare From</label>
              <Select value={selectedVersions[0]} onValueChange={(v) => setSelectedVersions([v, selectedVersions[1]])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select older version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((version, index) => (
                    <SelectItem 
                      key={version.id} 
                      value={version.id}
                      disabled={version.id === selectedVersions[1] || index === 0}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{format(version.date, 'MMM d, yyyy')}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          v{version.version}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Compare To</label>
              <Select value={selectedVersions[1]} onValueChange={(v) => setSelectedVersions([selectedVersions[0], v])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select newer version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((version) => (
                    <SelectItem 
                      key={version.id} 
                      value={version.id}
                      disabled={version.id === selectedVersions[0]}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{format(version.date, 'MMM d, yyyy')}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          v{version.version}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Comparison Summary */}
          {v1 && v2 && (
            <AnimatedContainer animation="fade">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Time Difference</p>
                        <p className="text-lg font-semibold">
                          {formatDistanceToNow(v1.date, { addSuffix: false })}
                        </p>
                      </div>
                      <Calendar className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Changes</p>
                        <p className="text-lg font-semibold">{v2.changeCount}</p>
                      </div>
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Impact Level</p>
                        <Badge className={cn("mt-1", getChangeColor(v2.changeType))}>
                          {getChangeIcon(v2.changeType)}
                          <span className="ml-1 capitalize">{v2.changeType}</span>
                        </Badge>
                      </div>
                      <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Analysis */}
              {v2.aiAnalysis && (
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Impact Score</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{v2.aiAnalysis.impactScore}%</span>
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all"
                            style={{ width: `${v2.aiAnalysis.impactScore}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium mb-2">Key Changes</p>
                      <ul className="space-y-1">
                        {v2.aiAnalysis.keyChanges.map((change, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    {v2.aiAnalysis.recommendations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Recommendations</p>
                        <ul className="space-y-1">
                          {v2.aiAnalysis.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </AnimatedContainer>
          )}

          {/* View Options */}
          <div className="flex items-center justify-between">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList>
                <TabsTrigger value="unified">Unified</TabsTrigger>
                <TabsTrigger value="split">Split View</TabsTrigger>
                <TabsTrigger value="inline">Inline</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showOnlyChanges}
                  onChange={(e) => setShowOnlyChanges(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Show only changes
              </label>
              
              <Button size="sm" variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                View Full
              </Button>
            </div>
          </div>

          {/* Diff View */}
          <ScrollArea className="h-[600px] border rounded-lg p-4">
            {v1 && v2 ? (
              renderDiffView()
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Select two versions to compare
              </div>
            )}
          </ScrollArea>

          {/* Statistics */}
          {v2?.stats && (
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Additions</p>
                <p className="text-2xl font-bold text-green-600">+{v2.stats.additions}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Deletions</p>
                <p className="text-2xl font-bold text-red-600">-{v2.stats.deletions}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Modifications</p>
                <p className="text-2xl font-bold text-yellow-600">~{v2.stats.modifications}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

function generateMockPolicyContent(index: number): string {
  const sections = [
    "Data Collection: We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support.",
    "Information Usage: We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.",
    "Data Sharing: We may share your information with third-party service providers who perform services on our behalf, such as payment processing and data analytics.",
    "Data Security: We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.",
    "User Rights: You have the right to access, update, or delete your personal information. You may also opt out of certain communications from us.",
    "Cookies: We use cookies and similar tracking technologies to track activity on our service and hold certain information to improve your experience.",
    "Children's Privacy: Our service is not directed to children under 13, and we do not knowingly collect personal information from children under 13.",
    "Changes to Policy: We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page.",
    "Contact Information: If you have any questions about this privacy policy, please contact us at privacy@example.com.",
    "International Transfers: Your information may be transferred to and maintained on servers located outside of your state, province, country, or other governmental jurisdiction."
  ]
  
  // Shuffle and modify sections based on index to simulate changes
  return sections
    .map((section, i) => {
      if ((index + i) % 3 === 0) {
        return section + " [Updated section with additional details and clarifications.]"
      }
      return section
    })
    .slice(0, 7 + (index % 3))
    .join("\n\n")
}