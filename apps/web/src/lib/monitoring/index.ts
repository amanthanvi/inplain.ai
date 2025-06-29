/**
 * Monitoring and observability utilities
 */

import { headers } from 'next/headers'

// Types
export interface MetricData {
  name: string
  value: number
  unit?: string
  tags?: Record<string, string>
  timestamp?: number
}

export interface LogContext {
  userId?: string
  requestId?: string
  sessionId?: string
  [key: string]: any
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

// Request ID generation and tracking
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export async function getRequestId(): Promise<string> {
  const headersList = await headers()
  const requestId = headersList.get('x-request-id') || generateRequestId()
  return requestId
}

// Structured logging
class Logger {
  private context: LogContext = {}

  setContext(context: LogContext) {
    this.context = { ...this.context, ...context }
  }

  private formatLog(level: LogLevel, message: string, data?: any) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...(data && { data }),
      environment: process.env.NODE_ENV,
      service: 'inplain-web'
    }
  }

  debug(message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify(this.formatLog('debug', message, data)))
    }
  }

  info(message: string, data?: any) {
    console.info(JSON.stringify(this.formatLog('info', message, data)))
  }

  warn(message: string, data?: any) {
    console.warn(JSON.stringify(this.formatLog('warn', message, data)))
  }

  error(message: string, error?: Error | any, data?: any) {
    const errorData = {
      ...data,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    }
    console.error(JSON.stringify(this.formatLog('error', message, errorData)))
  }

  fatal(message: string, error?: Error | any, data?: any) {
    const errorData = {
      ...data,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    }
    console.error(JSON.stringify(this.formatLog('fatal', message, errorData)))
  }
}

// Create logger instance
export const logger = new Logger()

// Metrics collection
class MetricsCollector {
  private metrics: MetricData[] = []
  private flushInterval: NodeJS.Timeout | null = null

  constructor() {
    if (typeof window === 'undefined') {
      // Server-side: flush metrics periodically
      this.flushInterval = setInterval(() => this.flush(), 30000) // 30 seconds
    }
  }

  record(metric: MetricData) {
    this.metrics.push({
      ...metric,
      timestamp: metric.timestamp || Date.now()
    })

    // Auto-flush if too many metrics
    if (this.metrics.length > 100) {
      this.flush()
    }
  }

  increment(name: string, value: number = 1, tags?: Record<string, string>) {
    this.record({
      name,
      value,
      unit: 'count',
      tags
    })
  }

  gauge(name: string, value: number, unit?: string, tags?: Record<string, string>) {
    this.record({
      name,
      value,
      unit,
      tags
    })
  }

  timing(name: string, duration: number, tags?: Record<string, string>) {
    this.record({
      name,
      value: duration,
      unit: 'ms',
      tags
    })
  }

  async flush() {
    if (this.metrics.length === 0) return

    const metricsToFlush = [...this.metrics]
    this.metrics = []

    try {
      // In production, send to metrics service
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metrics: metricsToFlush })
        })
      } else {
        // Development: log metrics
        logger.debug('Metrics flush', { metrics: metricsToFlush })
      }
    } catch (error) {
      logger.error('Failed to flush metrics', error)
    }
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flush()
  }
}

// Create metrics instance
export const metrics = new MetricsCollector()

// Performance monitoring
export function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>,
  tags?: Record<string, string>
): T | Promise<T> {
  const start = performance.now()
  
  try {
    const result = fn()
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start
        metrics.timing(name, duration, tags)
      })
    }
    
    const duration = performance.now() - start
    metrics.timing(name, duration, tags)
    return result
  } catch (error) {
    const duration = performance.now() - start
    metrics.timing(name, duration, { ...tags, error: 'true' })
    throw error
  }
}

// Error tracking
export function captureException(error: Error | any, context?: any) {
  logger.error('Exception captured', error, context)
  
  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    // This would integrate with Sentry or similar
    metrics.increment('errors', 1, {
      type: error?.name || 'unknown',
      message: error?.message?.substring(0, 100) || 'no message'
    })
  }
}

// User tracking
export function identifyUser(userId: string, traits?: Record<string, any>) {
  logger.setContext({ userId })
  
  if (typeof window !== 'undefined') {
    // Client-side user identification
    metrics.increment('user.identified', 1, { userId })
  }
}

// Feature tracking
export function trackFeature(feature: string, properties?: Record<string, any>) {
  logger.info('Feature used', { feature, ...properties })
  metrics.increment('feature.usage', 1, { feature })
}

// Page view tracking
export function trackPageView(path: string, properties?: Record<string, any>) {
  logger.info('Page view', { path, ...properties })
  metrics.increment('page.views', 1, { path })
}

// API tracking
export function trackAPICall(
  endpoint: string,
  method: string,
  statusCode: number,
  duration: number
) {
  metrics.timing('api.duration', duration, {
    endpoint,
    method,
    status: statusCode.toString(),
    success: (statusCode >= 200 && statusCode < 300).toString()
  })
  
  metrics.increment('api.calls', 1, {
    endpoint,
    method,
    status: statusCode.toString()
  })
}

// Browser-specific monitoring
if (typeof window !== 'undefined') {
  // Track client-side errors
  window.addEventListener('error', (event) => {
    captureException(event.error || event.message, {
      source: 'window.error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  })

  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    captureException(event.reason, {
      source: 'unhandledrejection',
      promise: event.promise
    })
  })

  // Track performance metrics
  if ('PerformanceObserver' in window) {
    try {
      // Core Web Vitals
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            metrics.timing('webvitals.lcp', entry.startTime)
          } else if (entry.entryType === 'first-input' && 'processingStart' in entry) {
            const fid = entry.processingStart - entry.startTime
            metrics.timing('webvitals.fid', fid)
          } else if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
            metrics.gauge('webvitals.cls', (entry as any).value)
          }
        }
      })

      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
    } catch (error) {
      console.warn('Failed to setup PerformanceObserver:', error)
    }
  }
}