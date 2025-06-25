'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { CompanyGrid } from '@/components/CompanyGrid'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { AsyncErrorBoundary } from '@/components/error-boundary'
import { Search, Filter, Building2, CheckCircle } from 'lucide-react'
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
import { Card, CardContent } from '@/components/ui/card'

export default function CompaniesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [categories, setCategories] = useState<string[]>([])
  const [totalCompanies, setTotalCompanies] = useState(0)

  useEffect(() => {
    // Fetch categories from API
    fetch('/api/companies')
      .then(res => res.json())
      .then(data => {
        setCategories(data.categories || [])
        setTotalCompanies(data.total || 0)
      })
      .catch(console.error)
  }, [])

  return (
    <div className="container py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Tracked Companies
            </h1>
            <p className="text-muted-foreground">
              Monitoring {totalCompanies} companies for privacy policy changes
            </p>
          </div>
        </div>
        
        <Card className="mt-6 border-primary/20">
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Real-time Monitoring</p>
                  <p className="text-sm text-muted-foreground">Daily checks for changes</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">AI-Powered Analysis</p>
                  <p className="text-sm text-muted-foreground">Understand what changed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Instant Alerts</p>
                  <p className="text-sm text-muted-foreground">Get notified of updates</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
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
          <CompanyGrid 
            searchQuery={searchQuery} 
            category={selectedCategory === 'all' ? undefined : selectedCategory}
          />
        </Suspense>
      </AsyncErrorBoundary>
    </div>
  )
}