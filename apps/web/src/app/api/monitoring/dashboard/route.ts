/**
 * Monitoring Dashboard API
 * 
 * Provides real-time monitoring data for the production dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { MonitoringDashboard, HealthMonitor, MetricsCollector } from '@/lib/monitoring/production-monitoring'
import { auth as clerkAuth } from '@clerk/nextjs/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const { userId } = await clerkAuth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Check if user is admin - for now, allow authenticated users
    // TODO: Implement proper admin role checking
    const isAdmin = true // Temporarily allow all authenticated users
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }
    
    // Get time range from query params
    const timeRange = request.nextUrl.searchParams.get('range') || '1h'
    const duration = parseDuration(timeRange)
    
    // Get dashboard data
    const dashboardData = await MonitoringDashboard.getData()
    
    // Get additional metrics based on time range
    const endTime = Date.now()
    const startTime = endTime - duration
    
    const [
      requestMetrics,
      errorMetrics,
      performanceMetrics,
      aiMetrics
    ] = await Promise.all([
      MetricsCollector.getMetrics('request_count', startTime, endTime),
      MetricsCollector.getMetrics('error_count', startTime, endTime),
      MetricsCollector.getMetrics('response_time', startTime, endTime),
      MetricsCollector.getMetrics('ai_request_count', startTime, endTime)
    ])
    
    // Calculate additional statistics
    const stats = {
      totalRequests: requestMetrics.reduce((sum, m) => sum + m.value, 0),
      totalErrors: errorMetrics.reduce((sum, m) => sum + m.value, 0),
      errorRate: requestMetrics.length > 0 
        ? (errorMetrics.length / requestMetrics.length) * 100 
        : 0,
      avgResponseTime: performanceMetrics.length > 0
        ? performanceMetrics.reduce((sum, m) => sum + m.value, 0) / performanceMetrics.length
        : 0,
      totalAIRequests: aiMetrics.reduce((sum, m) => sum + m.value, 0)
    }
    
    // Get top endpoints by request count
    const endpointCounts = new Map<string, number>()
    requestMetrics.forEach(m => {
      const path = m.tags.path || 'unknown'
      endpointCounts.set(path, (endpointCounts.get(path) || 0) + 1)
    })
    
    const topEndpoints = Array.from(endpointCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }))
    
    // Get error breakdown
    const errorTypes = new Map<string, number>()
    errorMetrics.forEach(m => {
      const type = m.tags.error_type || 'unknown'
      errorTypes.set(type, (errorTypes.get(type) || 0) + 1)
    })
    
    const errorBreakdown = Array.from(errorTypes.entries())
      .map(([type, count]) => ({ type, count }))
    
    // Format response
    const response = {
      ...dashboardData,
      timeRange,
      stats,
      metrics: {
        ...dashboardData.metrics,
        timeSeries: {
          requests: formatTimeSeries(requestMetrics),
          errors: formatTimeSeries(errorMetrics),
          performance: formatTimeSeries(performanceMetrics),
          ai: formatTimeSeries(aiMetrics)
        }
      },
      insights: {
        topEndpoints,
        errorBreakdown,
        peakRequestTime: findPeakTime(requestMetrics),
        slowestEndpoints: findSlowestEndpoints(performanceMetrics)
      }
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=60' // Cache for 1 minute
      }
    })
  } catch (error) {
    console.error('Error fetching monitoring data:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch monitoring data' },
      { status: 500 }
    )
  }
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([mhd])$/)
  if (!match) {
    return 60 * 60 * 1000 // Default to 1 hour
  }
  
  const value = parseInt(match[1] || '60')
  const unit = match[2] || 'h'
  
  switch (unit) {
    case 'm':
      return value * 60 * 1000
    case 'h':
      return value * 60 * 60 * 1000
    case 'd':
      return value * 24 * 60 * 60 * 1000
    default:
      return value * 60 * 60 * 1000 // Default to hours
  }
}

/**
 * Format metrics for time series chart
 */
function formatTimeSeries(metrics: any[]): any[] {
  // Group by 5-minute intervals
  const interval = 5 * 60 * 1000
  const grouped = new Map<number, number[]>()
  
  metrics.forEach(m => {
    const bucket = Math.floor(m.timestamp / interval) * interval
    if (!grouped.has(bucket)) {
      grouped.set(bucket, [])
    }
    grouped.get(bucket)!.push(m.value)
  })
  
  // Calculate averages for each interval
  return Array.from(grouped.entries())
    .map(([timestamp, values]) => ({
      timestamp,
      value: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Find peak request time
 */
function findPeakTime(metrics: any[]): { time: string; count: number } | null {
  if (metrics.length === 0) return null
  
  // Group by hour
  const hourly = new Map<number, number>()
  
  metrics.forEach(m => {
    const hour = new Date(m.timestamp).getHours()
    hourly.set(hour, (hourly.get(hour) || 0) + 1)
  })
  
  let peakHour = 0
  let peakCount = 0
  
  hourly.forEach((count, hour) => {
    if (count > peakCount) {
      peakCount = count
      peakHour = hour
    }
  })
  
  return {
    time: `${peakHour}:00 - ${(peakHour + 1) % 24}:00`,
    count: peakCount
  }
}

/**
 * Find slowest endpoints
 */
function findSlowestEndpoints(metrics: any[]): any[] {
  const endpointTimes = new Map<string, number[]>()
  
  metrics.forEach(m => {
    const path = m.tags.path || 'unknown'
    if (!endpointTimes.has(path)) {
      endpointTimes.set(path, [])
    }
    endpointTimes.get(path)!.push(m.value)
  })
  
  return Array.from(endpointTimes.entries())
    .map(([path, times]) => ({
      path,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      maxTime: Math.max(...times),
      count: times.length
    }))
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 5)
}