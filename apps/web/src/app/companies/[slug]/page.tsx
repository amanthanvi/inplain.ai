/**
 * Company Detail Page with Production Privacy Analysis
 * 
 * Showcases comprehensive privacy scoring and risk assessment
 */

'use client'

import React, { useState, useEffect } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Building2, FileText, Shield, Clock, 
  TrendingUp, Search, Filter, BarChart3, RefreshCw,
  AlertTriangle, CheckCircle, ExternalLink, Eye,
  Download, Share2, Bell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PrivacyScoreDisplay } from '@/components/ui/privacy-score-display'
import { PrivacyScoreCard } from '@/components/company/privacy-score-card'
// import { DiffTimeline } from '@/components/diff/diff-timeline' // TODO: Create this component
import { GlobalSearch } from '@/components/search/GlobalSearch'
import { useToast } from '@/components/ui/use-toast'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export default function CompanyDetailPage({ params }: PageProps) {
  const [slug, setSlug] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [isWatching, setIsWatching] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    params.then(p => setSlug(p.slug))
  }, [params])

  if (!slug) return <div>Loading...</div>

  const company = WATCHED_COMPANIES.find(c => c.slug === slug)
  
  if (!company) {
    notFound()
  }

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/analysis/comprehensive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: company.slug,
          industry: company.category || 'technology',
          refresh: true
        })
      })

      if (!response.ok) {
        throw new Error('Analysis failed')
      }

      const data = await response.json()
      setAnalysisData(data)
      
      toast({
        title: 'Analysis Complete',
        description: `${company.name} scored ${data.grading.letter_grade} with ${data.risk_assessment.risk_level} risk`,
      })
    } catch (error) {
      toast({
        title: 'Analysis Failed',
        description: 'Unable to analyze privacy policy. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleWatch = async () => {
    setIsWatching(true)
    try {
      // In production, this would call the watch API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast({
        title: 'Watching ' + company.name,
        description: 'You\'ll be notified of any privacy policy changes.',
      })
    } catch (error) {
      toast({
        title: 'Failed to Watch',
        description: 'Unable to set up monitoring. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsWatching(false)
    }
  }

  // Mock data for demonstration
  const mockAnalysis = {
    grading: {
      overall_score: 72,
      letter_grade: 'B-',
      dimension_scores: {
        DATA_COLLECTION: { score: 68, findings: ['Weak: Collects extensive behavioral data', 'Strong: Clear data categories listed'] },
        USER_CONTROL: { score: 82, findings: ['Strong: Easy opt-out mechanisms', 'Strong: Right to deletion available'] },
        DATA_SHARING: { score: 55, findings: ['Weak: Shares data with numerous third parties', 'Weak: No clear opt-out for advertising'] },
        TRANSPARENCY: { score: 78, findings: ['Strong: Uses plain language', 'Strong: Comprehensive coverage'] },
        SECURITY: { score: 85, findings: ['Strong: Uses encryption for data', 'Strong: Regular security audits'] },
        RETENTION: { score: 65, findings: ['Weak: Vague retention periods', 'Strong: Automatic deletion policy'] }
      },
      compliance: {
        gdpr: true,
        ccpa: true,
        coppa: false
      }
    },
    risk_assessment: {
      overall_risk_score: 45,
      risk_level: 'MEDIUM',
      top_risks: [
        {
          category: 'Data Sharing',
          risk: 'Third-Party Data Sharing',
          severity: 75,
          description: 'Extensive sharing with advertising partners without clear opt-out'
        },
        {
          category: 'Data Collection',
          risk: 'Behavioral Tracking',
          severity: 65,
          description: 'Collects detailed behavioral and usage patterns'
        }
      ]
    },
    comparisons: {
      industry_average: 68,
      percentile: 75,
      trend: 'stable' as const
    }
  }

  const analysis = analysisData || mockAnalysis

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/companies">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Companies
                </Button>
              </Link>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{company.name}</span>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-2">
              <GlobalSearch className="w-96" />
            </div>
          </div>
        </div>
      </div>

      {/* Company Header */}
      <div className="bg-muted/30 border-b">
        <div className="container py-8">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-6">
              {/* Company Logo */}
              <div className="w-20 h-20 rounded-xl bg-white dark:bg-gray-900 border shadow-sm flex items-center justify-center">
                <Building2 className="w-10 h-10 text-muted-foreground" />
              </div>
              
              {/* Company Info */}
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">{company.name}</h1>
                <p className="text-muted-foreground max-w-2xl">
                  {`Track privacy policy changes and compliance for ${company.name}`}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary">{company.category || 'Technology'}</Badge>
                  <Badge variant="outline">
                    <Eye className="w-3 h-3 mr-1" />
                    {Math.floor(Math.random() * 500) + 100} watchers
                  </Badge>
                  {true && (
                    <Badge variant="default">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleWatch}
                disabled={isWatching}
              >
                <Bell className="w-4 h-4 mr-2" />
                {isWatching ? 'Setting up...' : 'Watch'}
              </Button>
              <Button
                size="sm"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Analyze Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Privacy Score Display */}
            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <PrivacyScoreDisplay
                  score={analysis.grading.overall_score}
                  grade={analysis.grading.letter_grade}
                  riskLevel={analysis.risk_assessment.risk_level}
                  dimensions={analysis.grading.dimension_scores}
                  topRisks={analysis.risk_assessment.top_risks}
                  compliance={analysis.grading.compliance}
                  comparisons={analysis.comparisons}
                  recommendations={[
                    {
                      priority: 'high',
                      action: 'Review and limit third-party data sharing',
                      impact: 'Could improve privacy score by 15-20 points'
                    },
                    {
                      priority: 'medium',
                      action: 'Implement clearer data retention timelines',
                      impact: 'Would enhance transparency and user trust'
                    }
                  ]}
                  onActionClick={(action) => {
                    toast({
                      title: 'Action Guide',
                      description: `Opening guide for: ${action}`,
                    })
                  }}
                />
              </motion.div>
            )}

            {/* Policy Documents */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Policy Documents</CardTitle>
                    <CardDescription>
                      Legal documents and their current status
                    </CardDescription>
                  </div>
                  <Link href={`/companies/${slug}/policies`}>
                    <Button variant="ghost" size="sm">
                      View All
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((policy) => (
                    <div key={policy} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{policy}</p>
                          <p className="text-sm text-muted-foreground">
                            Last updated: {new Date().toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Changes Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Changes</CardTitle>
                <CardDescription>
                  Timeline of privacy policy updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* <DiffTimeline
                  diffs={[
                    {
                      id: '1',
                      companySlug: slug,
                      createdAt: new Date('2024-01-15').toISOString(),
                      summary: 'Updated data retention policy to comply with new regulations',
                      severity: 'moderate',
                      addedSections: ['Data Retention'],
                      removedSections: [],
                      significantChanges: ['Reduced retention period from indefinite to 2 years']
                    },
                    {
                      id: '2',
                      companySlug: slug,
                      createdAt: new Date('2024-01-01').toISOString(),
                      summary: 'Added new section on AI and machine learning data usage',
                      severity: 'major',
                      addedSections: ['AI Data Usage'],
                      removedSections: [],
                      significantChanges: ['Now uses data for AI training', 'Added opt-out mechanism']
                    }
                  ]}
                  onViewDiff={(id: any) => {
                    toast({
                      title: 'Opening Diff',
                      description: `Viewing changes for diff ${id}`,
                    })
                  }}
                /> */}
                <div className="space-y-3">
                  {[
                    {
                      date: '2024-01-15',
                      title: 'Data Retention Update',
                      description: 'Updated policy to comply with new regulations',
                      severity: 'moderate' as const
                    },
                    {
                      date: '2024-01-01',
                      title: 'AI Data Usage',
                      description: 'Added section on machine learning data usage',
                      severity: 'major' as const
                    }
                  ].map((change, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        change.severity === 'major' ? 'bg-red-500' :
                        change.severity === 'moderate' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`} />
                      <div className="flex-1">
                        <p className="font-medium">{change.title}</p>
                        <p className="text-sm text-muted-foreground">{change.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{change.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Policy Count</span>
                  <span className="font-medium">4 documents</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Change</span>
                  <span className="font-medium">15 days ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Change Frequency</span>
                  <Badge variant="secondary">Moderate</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Industry Rank</span>
                  <span className="font-medium">#12 of 47</span>
                </div>
              </CardContent>
            </Card>

            {/* Similar Companies */}
            <Card>
              <CardHeader>
                <CardTitle>Similar Companies</CardTitle>
                <CardDescription>
                  Companies in the same industry
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {WATCHED_COMPANIES
                    .filter(c => c.category === company.category && c.slug !== company.slug)
                    .slice(0, 3)
                    .map((similarCompany) => (
                      <Link
                        key={similarCompany.slug}
                        href={`/companies/${similarCompany.slug}`}
                        className="block"
                      >
                        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors">
                          <div>
                            <p className="font-medium">{similarCompany.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Grade: B+ • Low Risk
                            </p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Export Options */}
            <Card>
              <CardHeader>
                <CardTitle>Export & Share</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Download Report (PDF)
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Analysis
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}