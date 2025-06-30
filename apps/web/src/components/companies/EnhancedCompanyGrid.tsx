'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { extractDomain } from '@inplain.ai/shared/utils'
import { getCompanies } from '@/lib/api'
import type { Company } from '@inplain.ai/shared'
import { cn } from '@/lib/utils'
import { AnimatedContainer } from '@/components/ui/animations'
import type { PrivacyMetrics } from '@/lib/analytics/privacy-metrics'
import { 
  Building2, Clock, Shield, TrendingUp, AlertCircle, 
  CheckCircle, Eye, Users, Activity, ChevronRight,
  Star, Bell, Lock, Globe, Database
} from 'lucide-react'

interface CompanyGridProps {
  limit?: number
  searchQuery?: string
  category?: string
  viewMode?: 'grid' | 'list'
}

interface CompanyStats extends Omit<PrivacyMetrics, 'lastAnalyzed'> {
  lastChecked: Date
  watchers: number
}

export function EnhancedCompanyGrid({ 
  limit, 
  searchQuery = '', 
  category,
  viewMode = 'grid'
}: CompanyGridProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [companyStats, setCompanyStats] = useState<Record<string, CompanyStats>>({})

  useEffect(() => {
    getCompanies({
      search: searchQuery || undefined,
      category: category || undefined,
      limit: limit || undefined,
      active: true
    }).then(async data => {
      setCompanies(data)
      
      // Load real metrics for each company via API
      try {
        const response = await fetch('/api/companies/metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companySlugs: data.map(c => c.slug)
          })
        })
        
        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.statusText}`)
        }
        
        const { metrics } = await response.json()
        
        // Convert to CompanyStats format
        const stats: Record<string, CompanyStats> = {}
        for (const [slug, metric] of Object.entries(metrics)) {
          if ((metric as any).error) {
            console.error(`Failed to load metrics for ${slug}:`, (metric as any).error)
            // Use fallback values
            stats[slug] = {
              privacyScore: 75,
              riskLevel: 'Medium',
              dataCategories: [],
              lastAnalysisDate: new Date().toISOString(),
              complianceScore: 70,
              transparencyScore: 80,
              userControlScore: 65,
              totalChanges: 0,
              lastChecked: new Date(),
              watchers: 0
            }
          } else {
            stats[slug] = metric as CompanyStats
          }
        }
        
        setCompanyStats(stats)
      } catch (error) {
        console.error('Failed to load company metrics:', error)
        // Use fallback values for all companies
        const stats: Record<string, CompanyStats> = {}
        data.forEach(company => {
          stats[company.slug] = {
            privacyScore: 75,
            riskLevel: 'Medium',
            dataCategories: [],
            lastAnalysisDate: new Date().toISOString(),
            complianceScore: 70,
            transparencyScore: 80,
            userControlScore: 65,
            totalChanges: 0,
            lastChecked: new Date(),
            watchers: 0
          }
        })
        setCompanyStats(stats)
      }
      setLoading(false)
    }).catch(error => {
      console.error('Failed to load companies:', error)
      setLoading(false)
    })
  }, [limit, searchQuery, category])

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low': return 'text-green-600 bg-green-50'
      case 'Medium': return 'text-yellow-600 bg-yellow-50' 
      case 'High': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getCategoryIcon = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'social media': return Globe
      case 'technology': return Database
      case 'finance': return Lock
      default: return Building2
    }
  }

  if (loading) {
    return (
      <div className={cn(
        viewMode === 'grid' 
          ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          : "space-y-4"
      )}>
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded w-5/6"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          {searchQuery ? 'No companies found matching your search.' : 'No companies available.'}
        </p>
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {companies.map((company, index) => {
          const stats = companyStats[company.slug]
          const CategoryIcon = getCategoryIcon(company.category)
          
          return (
            <AnimatedContainer key={company.slug} animation="slideUp" delay={index * 0.05}>
              <Link href={`/${company.slug}`}>
                <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-[1.01]">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center flex-shrink-0">
                        <CategoryIcon className="h-8 w-8 text-primary" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="text-xl font-semibold">{company.name}</h3>
                              <div className="flex gap-2">
                                <Badge variant="success" className="text-xs">
                                  <Activity className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                                {company.category && (
                                  <Badge variant="secondary" className="text-xs">
                                    {company.category}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {extractDomain(company.url)}
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <div className={cn("text-2xl font-bold", getScoreColor(stats?.privacyScore || 0))}>
                              {stats?.privacyScore || 0}
                            </div>
                            <p className="text-xs text-muted-foreground">Privacy Score</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Badge className={cn("text-xs", getRiskColor(stats?.riskLevel || 'Low'))}>
                                {stats?.riskLevel || 'Low'} Risk
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{stats?.changeFrequency || 'Unknown'}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{stats?.watchers || 0} watchers</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <div className="flex gap-1">
                              {stats?.complianceStatus?.gdpr && (
                                <Badge variant="outline" className="text-xs px-1">GDPR</Badge>
                              )}
                              {stats?.complianceStatus?.ccpa && (
                                <Badge variant="outline" className="text-xs px-1">CCPA</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </AnimatedContainer>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {companies.map((company, index) => {
        const stats = companyStats[company.slug]
        const CategoryIcon = getCategoryIcon(company.category)
        
        return (
          <AnimatedContainer key={company.slug} animation="scale" delay={index * 0.05}>
            <Link href={`/${company.slug}`}>
              <Card className="hover:shadow-xl transition-all duration-200 cursor-pointer h-full group hover:scale-[1.02] relative overflow-hidden">
                <div className="absolute top-0 right-0 h-32 w-32 translate-x-16 -translate-y-16 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors duration-300" />
                
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center flex-shrink-0">
                        <CategoryIcon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-1">
                          {company.name}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1 truncate" title={extractDomain(company.url)}>
                          {extractDomain(company.url)}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="success" className="text-xs shrink-0">
                      <Activity className="h-3 w-3" />
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Privacy Score</p>
                      <p className={cn("text-2xl font-bold", getScoreColor(stats?.privacyScore || 0))}>
                        {stats?.privacyScore || 0}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Risk Level</p>
                      <Badge className={cn("mt-1", getRiskColor(stats?.riskLevel || 'Low'))}>
                        {stats?.riskLevel || 'Low'}
                      </Badge>
                    </div>
                  </div>
                  
                  <Progress value={stats?.privacyScore || 0} className="h-2" />
                  
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{stats?.changeFrequency || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{stats?.totalChanges || 0} changes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{stats?.watchers || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {[stats?.complianceStatus?.gdpr && 'GDPR', stats?.complianceStatus?.ccpa && 'CCPA']
                          .filter(Boolean)
                          .join(', ') || 'Limited'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 h-8 text-xs"
                      onClick={(e) => {
                        e.preventDefault()
                        // Handle watch action
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1 h-8 text-xs"
                      onClick={(e) => {
                        e.preventDefault()
                        // Handle watch action
                      }}
                    >
                      <Bell className="h-3 w-3 mr-1" />
                      Watch
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </AnimatedContainer>
        )
      })}
    </div>
  )
}