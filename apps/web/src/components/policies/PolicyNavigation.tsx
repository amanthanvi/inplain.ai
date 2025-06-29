'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { 
  FileText, Clock, Shield, TrendingUp, ChevronRight, 
  Calendar, Hash, Eye, AlertCircle, Search, Filter,
  BarChart3, Users, Lock, Globe, Database, Share2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import type { Company } from '@inplain.ai/shared'

interface PolicyInfo {
  slug: string
  name: string
  type: 'privacy' | 'terms' | 'cookies' | 'data'
  lastUpdated: Date
  version: string
  sections: number
  wordCount: number
  readingTime: number
  complianceScore?: number
  riskLevel?: 'low' | 'medium' | 'high'
  changes?: Array<{
    date: Date
    summary: string
    severity: 'minor' | 'moderate' | 'major'
  }>
}

interface PolicyNavigationProps {
  company: Company
  policies: PolicyInfo[]
  currentPolicy?: string
  onPolicySelect?: (policy: PolicyInfo) => void
  className?: string
}

export function PolicyNavigation({ 
  company, 
  policies, 
  currentPolicy,
  onPolicySelect,
  className 
}: PolicyNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'risk'>('date')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  // Filter and sort policies
  const filteredPolicies = policies
    .filter(policy => selectedCategory === 'all' || policy.type === selectedCategory)
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.lastUpdated.getTime() - a.lastUpdated.getTime()
        case 'name':
          return a.name.localeCompare(b.name)
        case 'risk':
          const riskOrder = { high: 0, medium: 1, low: 2 }
          return (riskOrder[a.riskLevel || 'low'] || 2) - (riskOrder[b.riskLevel || 'low'] || 2)
        default:
          return 0
      }
    })

  // Policy categories with icons
  const categories = [
    { id: 'all', label: 'All Policies', icon: FileText, count: policies.length },
    { id: 'privacy', label: 'Privacy', icon: Lock, count: policies.filter(p => p.type === 'privacy').length },
    { id: 'terms', label: 'Terms', icon: FileText, count: policies.filter(p => p.type === 'terms').length },
    { id: 'cookies', label: 'Cookies', icon: Globe, count: policies.filter(p => p.type === 'cookies').length },
    { id: 'data', label: 'Data', icon: Database, count: policies.filter(p => p.type === 'data').length }
  ]

  const handlePolicyClick = (policy: PolicyInfo) => {
    if (onPolicySelect) {
      onPolicySelect(policy)
    } else {
      router.push(`/companies/${company.slug}/policies/${policy.slug}`)
    }
  }

  const getPolicyIcon = (type: PolicyInfo['type']) => {
    switch (type) {
      case 'privacy': return Lock
      case 'terms': return FileText
      case 'cookies': return Globe
      case 'data': return Database
      default: return FileText
    }
  }

  const getRiskBadgeVariant = (level?: PolicyInfo['riskLevel']) => {
    switch (level) {
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      case 'low': return 'success'
      default: return 'outline'
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">Policy Documents</CardTitle>
              <CardDescription className="mt-2">
                Browse and analyze {company.name}'s legal documents and policies
              </CardDescription>
            </div>
            <Badge variant="secondary" className="animate-pulse">
              <Eye className="h-3 w-3 mr-1" />
              Live Monitoring
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Policies</p>
                <p className="text-2xl font-bold">{policies.length}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Update</p>
                <p className="text-lg font-semibold">
                  {policies.length > 0 
                    ? formatDistanceToNow(
                        Math.max(...policies.map(p => p.lastUpdated.getTime())),
                        { addSuffix: true }
                      )
                    : 'N/A'
                  }
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Compliance</p>
                <p className="text-2xl font-bold">
                  {policies.length > 0
                    ? Math.round(
                        policies.reduce((acc, p) => acc + (p.complianceScore || 75), 0) / policies.length
                      )
                    : 0}%
                </p>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Risk</p>
                <p className="text-2xl font-bold">
                  {policies.filter(p => p.riskLevel === 'high').length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 space-y-4 hidden lg:block">
          {/* Categories */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Categories</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1">
                {categories.map((category) => {
                  const Icon = category.icon
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                        "hover:bg-muted focus:bg-muted focus:outline-none",
                        selectedCategory === category.id && "bg-muted font-medium"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {category.label}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {category.count}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sort Options */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Sort By</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1">
                <button
                  onClick={() => setSortBy('date')}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                    "hover:bg-muted focus:bg-muted focus:outline-none",
                    sortBy === 'date' && "bg-muted font-medium"
                  )}
                >
                  Last Updated
                </button>
                <button
                  onClick={() => setSortBy('name')}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                    "hover:bg-muted focus:bg-muted focus:outline-none",
                    sortBy === 'name' && "bg-muted font-medium"
                  )}
                >
                  Name
                </button>
                <button
                  onClick={() => setSortBy('risk')}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                    "hover:bg-muted focus:bg-muted focus:outline-none",
                    sortBy === 'risk' && "bg-muted font-medium"
                  )}
                >
                  Risk Level
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <BarChart3 className="h-4 w-4 mr-2" />
                Compare Policies
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Share2 className="h-4 w-4 mr-2" />
                Export All
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Search className="h-4 w-4 mr-2" />
                Search in Policies
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Policy List */}
        <div className="flex-1">
          {filteredPolicies.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No policies found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedCategory !== 'all' 
                    ? 'Try selecting a different category'
                    : 'No policy documents are available for this company'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className={cn(
              viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'
            )}>
              {filteredPolicies.map((policy) => {
                const Icon = getPolicyIcon(policy.type)
                const isActive = currentPolicy === policy.slug
                
                return (
                  <Card 
                    key={policy.slug}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      isActive && "ring-2 ring-primary"
                    )}
                    onClick={() => handlePolicyClick(policy)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center",
                            "bg-primary/10"
                          )}>
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{policy.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Version {policy.version} • {policy.sections} sections
                            </p>
                          </div>
                        </div>
                        {policy.riskLevel && (
                          <Badge variant={getRiskBadgeVariant(policy.riskLevel)}>
                            {policy.riskLevel} risk
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Last Updated</span>
                          <span>{format(policy.lastUpdated, 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Word Count</span>
                          <span>{policy.wordCount.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Reading Time</span>
                          <span>{policy.readingTime} min</span>
                        </div>
                        {policy.complianceScore && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Compliance</span>
                            <span className="font-medium">{policy.complianceScore}%</span>
                          </div>
                        )}
                      </div>

                      {policy.changes && policy.changes.length > 0 && (
                        <>
                          <Separator className="my-4" />
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Recent Changes</p>
                            {policy.changes.slice(0, 2).map((change, index) => (
                              <div key={index} className="flex items-start gap-2 text-xs">
                                <Badge 
                                  variant={
                                    change.severity === 'major' ? 'destructive' :
                                    change.severity === 'moderate' ? 'secondary' : 'outline'
                                  }
                                  className="text-xs"
                                >
                                  {change.severity}
                                </Badge>
                                <div className="flex-1">
                                  <p className="text-muted-foreground">
                                    {format(change.date, 'MMM d')} - {change.summary}
                                  </p>
                                </div>
                              </div>
                            ))}
                            {policy.changes.length > 2 && (
                              <p className="text-xs text-muted-foreground">
                                +{policy.changes.length - 2} more changes
                              </p>
                            )}
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {policy.slug}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(policy.lastUpdated, { addSuffix: true })}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Actions */}
      <div className="lg:hidden fixed bottom-20 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t">
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? 'List View' : 'Grid View'}
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            <Filter className="h-4 w-4 mr-1" />
            Filter
          </Button>
        </div>
      </div>
    </div>
  )
}