'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Sparkles,
  FileText,
  Eye,
  Lock,
  Users,
  TrendingUp,
  BookOpen
} from 'lucide-react'
import { PolicySummary } from '@/lib/ai/policy-summarizer'
import { cn } from '@/lib/utils'

interface PolicySummaryCardProps {
  summary: PolicySummary
  onViewFullPolicy?: () => void
  className?: string
}

export function PolicySummaryCard({ 
  summary, 
  onViewFullPolicy,
  className 
}: PolicySummaryCardProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getComplexityIcon = (complexity: string) => {
    switch (complexity) {
      case 'simple': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'moderate': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'complex': return <AlertTriangle className="h-4 w-4 text-red-500" />
      default: return null
    }
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Powered Summary
            </CardTitle>
            <CardDescription>
              Quick overview of the privacy policy
            </CardDescription>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{summary.readingTime} min read</span>
            </div>
            <div className="flex items-center gap-1">
              {getComplexityIcon(summary.complexity)}
              <span className="capitalize">{summary.complexity}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Executive Summary */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm leading-relaxed">{summary.executive}</p>
        </div>

        {/* Risk Assessment */}
        <Alert className={cn("border", getRiskColor(summary.risks.level))}>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Privacy Risk Level</span>
                <Badge variant="outline" className={getRiskColor(summary.risks.level)}>
                  {summary.risks.level.toUpperCase()}
                </Badge>
              </div>
              {summary.risks.factors.length > 0 && (
                <ul className="text-sm space-y-1 mt-2">
                  {summary.risks.factors.map((factor, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </AlertDescription>
        </Alert>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview" className="text-xs">
              <Eye className="h-3 w-3 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="data" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Data
            </TabsTrigger>
            <TabsTrigger value="rights" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              Rights
            </TabsTrigger>
            <TabsTrigger value="tips" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              Tips
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Key Points
            </h4>
            <ul className="space-y-2">
              {summary.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="data" className="mt-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Data Collected</h4>
              <div className="flex flex-wrap gap-2">
                {summary.dataCollection.types.map((type, index) => (
                  <Badge key={index} variant="secondary">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Purposes</h4>
              <ul className="space-y-1">
                {summary.dataCollection.purposes.map((purpose, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {purpose}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-1">Retention Period</h4>
              <p className="text-sm text-muted-foreground">
                {summary.dataCollection.retention}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="rights" className="mt-4 space-y-3">
            <h4 className="text-sm font-medium">Your Rights</h4>
            <div className="space-y-2">
              {summary.userRights.map((right, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{right}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tips" className="mt-4 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Recommendations
            </h4>
            <ul className="space-y-2">
              {summary.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-primary">→</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>

        {/* View Full Policy Button */}
        {onViewFullPolicy && (
          <Button 
            onClick={onViewFullPolicy}
            className="w-full"
            variant="outline"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            View Full Policy
          </Button>
        )}
      </CardContent>
    </Card>
  )
}