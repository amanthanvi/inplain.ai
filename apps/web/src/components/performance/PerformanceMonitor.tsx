'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Zap,
  HardDrive,
  Globe,
  Download,
  RefreshCw
} from 'lucide-react'
import { usePerformance } from './PerformanceProvider'
import { WEB_VITALS_THRESHOLDS, analyzeBundleSize } from '@/lib/performance/index'
import { cn } from '@/lib/utils'

export function PerformanceMonitor() {
  const { monitor, memoryMonitor, report } = usePerformance()
  const [bundleAnalysis, setBundleAnalysis] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    // Analyze bundle on mount (client-side only)
    if (typeof window !== 'undefined') {
      analyzeBundleSize().then(setBundleAnalysis)
    }
  }, [])

  const analyzePerformance = async () => {
    setIsAnalyzing(true)
    const analysis = await analyzeBundleSize()
    setBundleAnalysis(analysis)
    setIsAnalyzing(false)
  }

  const getVitalStatus = (value: number | undefined, metric: keyof typeof WEB_VITALS_THRESHOLDS) => {
    if (!value) return { status: 'unknown', color: 'secondary' as const }
    
    const thresholds = WEB_VITALS_THRESHOLDS[metric]
    if (value <= thresholds.good) {
      return { status: 'good', color: 'success' as const }
    } else if (value <= thresholds.needsImprovement) {
      return { status: 'needs improvement', color: 'warning' as const }
    } else {
      return { status: 'poor', color: 'destructive' as const }
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Performance Monitor
          </CardTitle>
          <CardDescription>
            Loading performance metrics...
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Core Web Vitals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Core Web Vitals
          </CardTitle>
          <CardDescription>
            Key metrics that impact user experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* LCP */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Largest Contentful Paint (LCP)
                </span>
                {report.coreWebVitals.LCP && (
                  <Badge variant={getVitalStatus(report.coreWebVitals.LCP.avg, 'LCP').color}>
                    {getVitalStatus(report.coreWebVitals.LCP.avg, 'LCP').status}
                  </Badge>
                )}
              </div>
              <div className="text-2xl font-bold">
                {report.coreWebVitals.LCP 
                  ? formatDuration(report.coreWebVitals.LCP.avg)
                  : 'N/A'}
              </div>
              <Progress 
                value={report.coreWebVitals.LCP 
                  ? Math.min((report.coreWebVitals.LCP.avg / WEB_VITALS_THRESHOLDS.LCP.needsImprovement) * 100, 100)
                  : 0}
                className="h-2"
              />
            </div>

            {/* FID */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  First Input Delay (FID)
                </span>
                {report.coreWebVitals.FID && (
                  <Badge variant={getVitalStatus(report.coreWebVitals.FID.avg, 'FID').color}>
                    {getVitalStatus(report.coreWebVitals.FID.avg, 'FID').status}
                  </Badge>
                )}
              </div>
              <div className="text-2xl font-bold">
                {report.coreWebVitals.FID 
                  ? formatDuration(report.coreWebVitals.FID.avg)
                  : 'N/A'}
              </div>
              <Progress 
                value={report.coreWebVitals.FID 
                  ? Math.min((report.coreWebVitals.FID.avg / WEB_VITALS_THRESHOLDS.FID.needsImprovement) * 100, 100)
                  : 0}
                className="h-2"
              />
            </div>

            {/* CLS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Cumulative Layout Shift (CLS)
                </span>
                {report.coreWebVitals.CLS && (
                  <Badge variant={getVitalStatus(report.coreWebVitals.CLS.avg, 'CLS').color}>
                    {getVitalStatus(report.coreWebVitals.CLS.avg, 'CLS').status}
                  </Badge>
                )}
              </div>
              <div className="text-2xl font-bold">
                {report.coreWebVitals.CLS 
                  ? report.coreWebVitals.CLS.avg.toFixed(3)
                  : 'N/A'}
              </div>
              <Progress 
                value={report.coreWebVitals.CLS 
                  ? Math.min((report.coreWebVitals.CLS.avg / WEB_VITALS_THRESHOLDS.CLS.needsImprovement) * 100, 100)
                  : 0}
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Memory Usage */}
      {report.memory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Memory Usage
            </CardTitle>
            <CardDescription>
              JavaScript heap memory consumption
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Usage</span>
                <span className="font-medium">{formatBytes(report.memory.current)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Average</span>
                <span className="font-medium">{formatBytes(report.memory.average)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Peak</span>
                <span className="font-medium">{formatBytes(report.memory.max)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Trend</span>
                <div className="flex items-center gap-2">
                  {report.memory.trend > 0 ? (
                    <TrendingUp className="h-4 w-4 text-destructive" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-success" />
                  )}
                  <span className={cn(
                    "font-medium",
                    report.memory.trend > 20 && "text-destructive"
                  )}>
                    {report.memory.trend > 0 ? '+' : ''}{report.memory.trend.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bundle Analysis */}
      {bundleAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Bundle Analysis
            </CardTitle>
            <CardDescription>
              Resource loading performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">JavaScript ({bundleAnalysis.scripts.count} files)</h4>
                  <div className="space-y-1">
                    {bundleAnalysis.scripts.files.slice(0, 3).map((file: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate max-w-[200px]">
                          {file.name}
                        </span>
                        <span className="font-medium">{formatBytes(file.size)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Total</span>
                      <span className="font-medium">{formatBytes(bundleAnalysis.scripts.size)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">CSS ({bundleAnalysis.styles.count} files)</h4>
                  <div className="space-y-1">
                    {bundleAnalysis.styles.files.slice(0, 3).map((file: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate max-w-[200px]">
                          {file.name}
                        </span>
                        <span className="font-medium">{formatBytes(file.size)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Total</span>
                      <span className="font-medium">{formatBytes(bundleAnalysis.styles.size)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Bundle Size</span>
                  <span className="text-lg font-bold">{formatBytes(bundleAnalysis.totalSize)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Performance Recommendations</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {report.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={analyzePerformance} disabled={isAnalyzing}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isAnalyzing && "animate-spin")} />
          Re-analyze
        </Button>
        <Button variant="outline" onClick={() => {
          if (typeof window === 'undefined') return
          const data = JSON.stringify(report, null, 2)
          const blob = new Blob([data], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `performance-report-${new Date().toISOString()}.json`
          a.click()
          URL.revokeObjectURL(url)
        }}>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>
    </div>
  )
}