/**
 * Production Monitoring and Observability
 * 
 * Comprehensive monitoring, metrics collection, and alerting
 * for production environments
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { kv } from '@/app/api/lib/kv-wrapper'
import { performanceMonitor } from './performance'

/**
 * Metric types for monitoring
 */
interface Metric {
  name: string
  value: number
  unit: string
  tags: Record<string, string>
  timestamp: number
}

/**
 * Health check status
 */
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    database: boolean
    redis: boolean
    externalAPIs: boolean
    diskSpace: boolean
    memory: boolean
  }
  metrics: {
    responseTime: number
    errorRate: number
    requestsPerMinute: number
    activeConnections: number
  }
  timestamp: string
}

/**
 * Production metrics collector
 */
export class MetricsCollector {
  private static readonly METRICS_PREFIX = 'metrics:'
  private static readonly WINDOW_SIZE = 60 * 1000 // 1 minute window
  
  /**
   * Record a metric
   */
  static async record(metric: Omit<Metric, 'timestamp'>): Promise<void> {
    const fullMetric: Metric = {
      ...metric,
      timestamp: Date.now()
    }
    
    // Store in time-series format using list since zadd is not available
    const key = `${this.METRICS_PREFIX}${metric.name}:${Math.floor(Date.now() / this.WINDOW_SIZE)}`
    
    // Store as JSON in a list
    await kv.lpush(key, JSON.stringify(fullMetric))
    
    // Set expiry on the key (7 days retention)
    await kv.expire(key, 7 * 24 * 60 * 60)
    
    // Update aggregates
    await this.updateAggregates(metric)
  }
  
  /**
   * Update metric aggregates
   */
  private static async updateAggregates(metric: Omit<Metric, 'timestamp'>): Promise<void> {
    const hour = Math.floor(Date.now() / (60 * 60 * 1000))
    const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000))
    
    // Hourly aggregates
    await kv.incr(`${this.METRICS_PREFIX}${metric.name}:hour:${hour}:count`)
    // Use get/set for sum since incrby is not available
    const hourSumKey = `${this.METRICS_PREFIX}${metric.name}:hour:${hour}:sum`
    const currentHourSum = await kv.get<number>(hourSumKey) || 0
    await kv.set(hourSumKey, currentHourSum + metric.value)
    
    // Daily aggregates
    await kv.incr(`${this.METRICS_PREFIX}${metric.name}:day:${day}:count`)
    const daySumKey = `${this.METRICS_PREFIX}${metric.name}:day:${day}:sum`
    const currentDaySum = await kv.get<number>(daySumKey) || 0
    await kv.set(daySumKey, currentDaySum + metric.value)
  }
  
  /**
   * Get metrics for a time range
   */
  static async getMetrics(
    name: string,
    startTime: number,
    endTime: number
  ): Promise<Metric[]> {
    const metrics: Metric[] = []
    
    // Calculate time windows
    const startWindow = Math.floor(startTime / this.WINDOW_SIZE)
    const endWindow = Math.floor(endTime / this.WINDOW_SIZE)
    
    for (let window = startWindow; window <= endWindow; window++) {
      const key = `${this.METRICS_PREFIX}${name}:${window}`
      // Use lrange instead of zrange since we're using lists
      const data = await kv.lrange(key, 0, -1)
      
      if (data && Array.isArray(data)) {
        metrics.push(...data.map(item => JSON.parse(item as string)))
      }
    }
    
    return metrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime)
  }
  
  /**
   * Calculate metric statistics
   */
  static async getStats(
    name: string,
    duration: number = 60 * 60 * 1000 // 1 hour
  ): Promise<{
    avg: number
    min: number
    max: number
    count: number
    p50: number
    p95: number
    p99: number
  }> {
    const endTime = Date.now()
    const startTime = endTime - duration
    const metrics = await this.getMetrics(name, startTime, endTime)
    
    if (metrics.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0, p50: 0, p95: 0, p99: 0 }
    }
    
    const values = metrics.map(m => m.value).sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)
    
    return {
      avg: sum / values.length,
      min: values[0] || 0,
      max: values[values.length - 1] || 0,
      count: values.length,
      p50: values[Math.floor(values.length * 0.5)] || 0,
      p95: values[Math.floor(values.length * 0.95)] || 0,
      p99: values[Math.floor(values.length * 0.99)] || 0
    }
  }
}

/**
 * Application health monitor
 */
export class HealthMonitor {
  /**
   * Perform comprehensive health check
   */
  static async check(): Promise<HealthStatus> {
    const startTime = Date.now()
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      externalAPIs: await this.checkExternalAPIs(),
      diskSpace: await this.checkDiskSpace(),
      memory: await this.checkMemory()
    }
    
    const metrics = {
      responseTime: Date.now() - startTime,
      errorRate: await this.getErrorRate(),
      requestsPerMinute: await this.getRequestRate(),
      activeConnections: await this.getActiveConnections()
    }
    
    const status = this.calculateStatus(checks, metrics)
    
    return {
      status,
      checks,
      metrics,
      timestamp: new Date().toISOString()
    }
  }
  
  private static async checkDatabase(): Promise<boolean> {
    try {
      // Implement actual database check
      return true
    } catch {
      return false
    }
  }
  
  private static async checkRedis(): Promise<boolean> {
    try {
      // Check if KV is working by trying to get a key
      await kv.get('health:check')
      return true
    } catch {
      return false
    }
  }
  
  private static async checkExternalAPIs(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openrouter.ai/api/v1/models', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch {
      return false
    }
  }
  
  private static async checkDiskSpace(): Promise<boolean> {
    // In serverless, we can't check disk space directly
    return true
  }
  
  private static async checkMemory(): Promise<boolean> {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100
      return heapUsedPercent < 90
    }
    return true
  }
  
  private static async getErrorRate(): Promise<number> {
    const stats = await MetricsCollector.getStats('error_count', 5 * 60 * 1000)
    const totalStats = await MetricsCollector.getStats('request_count', 5 * 60 * 1000)
    
    if (totalStats.count === 0) return 0
    return (stats.count / totalStats.count) * 100
  }
  
  private static async getRequestRate(): Promise<number> {
    const stats = await MetricsCollector.getStats('request_count', 60 * 1000)
    return stats.count
  }
  
  private static async getActiveConnections(): Promise<number> {
    // This would need to be tracked separately
    return 0
  }
  
  private static calculateStatus(
    checks: Record<string, boolean>,
    metrics: { errorRate: number; responseTime: number }
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const failedChecks = Object.values(checks).filter(v => !v).length
    
    if (failedChecks > 1 || metrics.errorRate > 10) {
      return 'unhealthy'
    }
    
    if (failedChecks > 0 || metrics.errorRate > 5 || metrics.responseTime > 1000) {
      return 'degraded'
    }
    
    return 'healthy'
  }
}

/**
 * Request tracking middleware
 */
export async function trackRequest(
  request: NextRequest,
  response: NextResponse
): Promise<void> {
  const startTime = Date.now()
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  
  // Track request
  await MetricsCollector.record({
    name: 'request_count',
    value: 1,
    unit: 'count',
    tags: {
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status.toString()
    }
  })
  
  // Track response time
  const responseTime = Date.now() - startTime
  await MetricsCollector.record({
    name: 'response_time',
    value: responseTime,
    unit: 'ms',
    tags: {
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status.toString()
    }
  })
  
  // Track errors
  if (response.status >= 400) {
    await MetricsCollector.record({
      name: 'error_count',
      value: 1,
      unit: 'count',
      tags: {
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status.toString(),
        error_type: response.status >= 500 ? 'server_error' : 'client_error'
      }
    })
  }
  
  // Log slow requests
  if (responseTime > 1000) {
    logger.warn('Slow request detected', {
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      responseTime,
      status: response.status
    })
  }
}

/**
 * Error tracking
 */
export class ErrorTracker {
  /**
   * Track an error with context
   */
  static async track(error: Error, context: {
    requestId?: string
    userId?: string
    path?: string
    method?: string
    [key: string]: any
  }): Promise<void> {
    const errorData = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      name: error.name,
      context
    }
    
    // Store error
    await kv.set(
      `errors:${errorData.id}`,
      errorData,
      { ex: 7 * 24 * 60 * 60 } // 7 days retention
    )
    
    // Update error metrics
    await MetricsCollector.record({
      name: 'application_error',
      value: 1,
      unit: 'count',
      tags: {
        error_name: error.name,
        path: context.path || 'unknown',
        method: context.method || 'unknown'
      }
    })
    
    // Log error
    logger.error('Application error', errorData)
    
    // Send alert for critical errors
    if (this.isCriticalError(error)) {
      await this.sendErrorAlert(errorData)
    }
  }
  
  private static isCriticalError(error: Error): boolean {
    const criticalPatterns = [
      /database.*connection/i,
      /authentication.*failed/i,
      /payment.*error/i,
      /security.*violation/i
    ]
    
    return criticalPatterns.some(pattern => pattern.test(error.message))
  }
  
  private static async sendErrorAlert(errorData: any): Promise<void> {
    // TODO: Implement error alerting (email, Slack, etc.)
    logger.error('CRITICAL ERROR ALERT', errorData)
  }
}

/**
 * Performance budget monitoring
 */
export class PerformanceBudget {
  private static readonly BUDGETS = {
    'api_response_time': { max: 300, unit: 'ms' },
    'page_load_time': { max: 2000, unit: 'ms' },
    'bundle_size': { max: 500, unit: 'kb' },
    'memory_usage': { max: 512, unit: 'mb' },
    'error_rate': { max: 1, unit: 'percent' }
  }
  
  /**
   * Check if a metric exceeds its budget
   */
  static async check(metricName: string, value: number): Promise<{
    exceeded: boolean
    budget: number
    actual: number
    percentage: number
  }> {
    const budget = this.BUDGETS[metricName as keyof typeof this.BUDGETS]
    
    if (!budget) {
      return { exceeded: false, budget: 0, actual: value, percentage: 0 }
    }
    
    const percentage = (value / budget.max) * 100
    const exceeded = value > budget.max
    
    if (exceeded) {
      logger.warn('Performance budget exceeded', {
        metric: metricName,
        budget: budget.max,
        actual: value,
        unit: budget.unit,
        percentage
      })
      
      await MetricsCollector.record({
        name: 'performance_budget_violation',
        value: 1,
        unit: 'count',
        tags: {
          metric: metricName,
          percentage: percentage.toFixed(2)
        }
      })
    }
    
    return {
      exceeded,
      budget: budget.max,
      actual: value,
      percentage
    }
  }
}

/**
 * Monitoring dashboard data provider
 */
export class MonitoringDashboard {
  /**
   * Get dashboard data
   */
  static async getData(): Promise<{
    health: HealthStatus
    metrics: {
      requests: any
      errors: any
      performance: any
    }
    alerts: any[]
  }> {
    const [health, requestStats, errorStats, performanceStats] = await Promise.all([
      HealthMonitor.check(),
      MetricsCollector.getStats('request_count'),
      MetricsCollector.getStats('error_count'),
      MetricsCollector.getStats('response_time')
    ])
    
    return {
      health,
      metrics: {
        requests: requestStats,
        errors: errorStats,
        performance: performanceStats
      },
      alerts: [] // TODO: Implement alert fetching
    }
  }
}