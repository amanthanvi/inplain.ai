'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { EnhancedCompanyGrid } from '@/components/companies/EnhancedCompanyGrid'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { AsyncErrorBoundary } from '@/components/error-boundary'
import { GlobalSearch } from '@/components/search/GlobalSearch'
import { 
  Search, Filter, Building2, CheckCircle, Grid, List,
  TrendingUp, Shield, Bell, Activity, Sparkles
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnimatedContainer } from '@/components/ui/animations'
import { cn } from '@/lib/utils'

// Force dynamic rendering to prevent static export
export const dynamic = 'force-dynamic'

export default function CompaniesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [categories, setCategories] = useState<string[]>([])
  const [totalCompanies, setTotalCompanies] = useState(0)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [stats, setStats] = useState({
    activeMonitoring: 0,
    recentChanges: 0,
    highRisk: 0,
    averageScore: 0
  })

  useEffect(() => {
    // Fetch categories and stats from API
    Promise.all([
      fetch('/api/companies').then(res => res.json()),
      fetch('/api/analytics/dashboard').then(res => res.json()).catch(() => null)
    ]).then(([companiesData, analyticsData]) => {
      setCategories(companiesData.categories || [])
      setTotalCompanies(companiesData.total || 0)
      
      if (analyticsData) {
        setStats({
          activeMonitoring: analyticsData.activeMonitoring || companiesData.total || 0,
          recentChanges: analyticsData.recentChanges || 0,
          highRisk: analyticsData.highRisk || 0,
          averageScore: analyticsData.averageScore || 85
        })
      }
    }).catch(console.error)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        
        <div className="container relative py-8 md:py-12">
          <AnimatedContainer animation="slideUp">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="space-y-4 flex-1">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-white dark:bg-gray-900 shadow-lg flex items-center justify-center">
                    <Building2 className="h-8 w-8 md:h-10 md:w-10 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
                      Tracked Companies
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg max-w-2xl">
                      Monitoring {totalCompanies} companies for privacy policy changes with AI-powered analysis and instant alerts
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
                <Button size="lg" className="shadow-lg">
                  <Bell className="mr-2 h-5 w-5" />
                  Set Up Alerts
                </Button>
                <Button size="lg" variant="outline">
                  <Sparkles className="mr-2 h-5 w-5" />
                  AI Insights
                </Button>
              </div>
            </div>
          </AnimatedContainer>

          {/* Stats Cards */}
          <AnimatedContainer animation="scale" delay={0.1}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              <Card className="relative overflow-hidden">
                <div className="absolute top-0 right-0 h-32 w-32 translate-x-16 -translate-y-16 rounded-full bg-primary/10 blur-2xl" />
                <CardContent className="p-6 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Monitoring</p>
                      <p className="text-3xl font-bold mt-1">{stats.activeMonitoring}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Recent Changes</p>
                      <p className="text-3xl font-bold mt-1">{stats.recentChanges}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">High Risk</p>
                      <p className="text-3xl font-bold mt-1">{stats.highRisk}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Average Score</p>
                      <p className="text-3xl font-bold mt-1">{stats.averageScore}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </AnimatedContainer>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="container py-8">
        <div className="mb-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 max-w-2xl">
              <GlobalSearch className="w-full" />
            </div>
            
            <div className="flex items-center gap-4">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
                <TabsList>
                  <TabsTrigger value="grid">
                    <Grid className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="list">
                    <List className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {selectedCategory !== 'all' && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filtering by:</span>
              <Badge variant="secondary" className="gap-1">
                {selectedCategory}
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="ml-1 hover:text-foreground"
                >
                  ×
                </button>
              </Badge>
            </div>
          )}
        </div>

        <AsyncErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <EnhancedCompanyGrid 
              searchQuery={searchQuery} 
              category={selectedCategory === 'all' ? undefined : selectedCategory}
              viewMode={viewMode}
            />
          </Suspense>
        </AsyncErrorBoundary>
      </div>
    </div>
  )
}