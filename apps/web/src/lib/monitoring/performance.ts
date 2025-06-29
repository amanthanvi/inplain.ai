import * as Sentry from '@sentry/nextjs'
import { logger } from './index'

interface PerformanceMetric {
  name: string
  value: number
  unit: string
  tags?: Record<string, string>
}

interface PerformanceTransaction {
  name: string
  startTime: number
  endTime?: number
  spans: PerformanceSpan[]
  tags: Record<string, string>
  data: Record<string, any>
}

interface PerformanceSpan {
  name: string
  startTime: number
  endTime?: number
  data?: Record<string, any>
}

class PerformanceMonitor {
  private transactions: Map<string, PerformanceTransaction> = new Map()
  private metrics: PerformanceMetric[] = []

  /**
   * Start a performance transaction
   */
  startTransaction(
    name: string,
    tags: Record<string, string> = {}
  ): string {
    const transactionId = crypto.randomUUID()
    const transaction: PerformanceTransaction = {
      name,
      startTime: performance.now(),
      spans: [],
      tags,
      data: {},
    }

    this.transactions.set(transactionId, transaction)

    // Start Sentry transaction if available
    if (typeof window === 'undefined') {
      // Sentry transaction API not available in current version
      // Will be added when upgrading Sentry SDK
    }

    return transactionId
  }

  /**
   * End a performance transaction
   */
  endTransaction(transactionId: string): void {
    const transaction = this.transactions.get(transactionId)
    if (!transaction) return

    transaction.endTime = performance.now()
    const duration = transaction.endTime - transaction.startTime

    // End Sentry transaction
    // Not available in current SDK version

    // Log performance data
    logger.info('Performance transaction completed', {
      name: transaction.name,
      duration,
      spanCount: transaction.spans.length,
      tags: transaction.tags,
    })

    // Record metric
    this.recordMetric({
      name: `transaction.${transaction.name}`,
      value: duration,
      unit: 'ms',
      tags: transaction.tags,
    })

    // Clean up
    this.transactions.delete(transactionId)
  }

  /**
   * Start a span within a transaction
   */
  startSpan(
    transactionId: string,
    name: string,
    data?: Record<string, any>
  ): number {
    const transaction = this.transactions.get(transactionId)
    if (!transaction) return -1

    const span: PerformanceSpan = {
      name,
      startTime: performance.now(),
      data,
    }

    transaction.spans.push(span)
    return transaction.spans.length - 1
  }

  /**
   * End a span
   */
  endSpan(transactionId: string, spanIndex: number): void {
    const transaction = this.transactions.get(transactionId)
    if (!transaction || !transaction.spans[spanIndex]) return

    const span = transaction.spans[spanIndex]
    span.endTime = performance.now()

    const duration = span.endTime - span.startTime
    logger.debug('Span completed', {
      transaction: transaction.name,
      span: span.name,
      duration,
      data: span.data,
    })
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)

    // Send to monitoring service
    logger.info('Performance metric', metric)

    // Report to Sentry when metrics API is available
    // Not available in current SDK version

    // Clean up old metrics (keep last 1000)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  /**
   * Measure async function performance
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const transactionId = this.startTransaction(name, tags)
    
    try {
      const result = await fn()
      this.endTransaction(transactionId)
      return result
    } catch (error) {
      this.endTransaction(transactionId)
      throw error
    }
  }

  /**
   * Create a performance decorator
   */
  createDecorator(defaultTags?: Record<string, string>) {
    return (
      target: any,
      propertyName: string,
      descriptor: PropertyDescriptor
    ) => {
      const originalMethod = descriptor.value

      descriptor.value = async function (...args: any[]) {
        const tags = {
          ...defaultTags,
          class: target.constructor.name,
          method: propertyName,
        }

        return performanceMonitor.measure(
          `${target.constructor.name}.${propertyName}`,
          () => originalMethod.apply(this, args),
          tags
        )
      }

      return descriptor
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  /**
   * Get active transactions
   */
  getActiveTransactions(): string[] {
    return Array.from(this.transactions.keys())
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.transactions.clear()
    this.metrics = []
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Decorators
export const Measured = performanceMonitor.createDecorator()

// Web Vitals tracking (client-side only)
export function trackWebVitals() {
  if (typeof window === 'undefined') return

  // First Contentful Paint
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
        performanceMonitor.recordMetric({
          name: 'web_vitals.fcp',
          value: entry.startTime,
          unit: 'ms',
        })
      }
    }
  })

  observer.observe({ entryTypes: ['paint'] })

  // Largest Contentful Paint
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries()
    const lastEntry = entries[entries.length - 1]
    
    if (lastEntry) {
      performanceMonitor.recordMetric({
        name: 'web_vitals.lcp',
        value: lastEntry.startTime,
        unit: 'ms',
      })
    }
  })

  lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

  // First Input Delay
  const fidObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const firstInputEntry = entry as any // PerformanceEventTiming
      if (firstInputEntry.processingStart) {
        performanceMonitor.recordMetric({
          name: 'web_vitals.fid',
          value: firstInputEntry.processingStart - firstInputEntry.startTime,
          unit: 'ms',
        })
      }
    }
  })

  fidObserver.observe({ entryTypes: ['first-input'] })

  // Cumulative Layout Shift
  let clsValue = 0
  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const layoutShiftEntry = entry as any // LayoutShift
      if (!layoutShiftEntry.hadRecentInput) {
        clsValue += layoutShiftEntry.value
        performanceMonitor.recordMetric({
          name: 'web_vitals.cls',
          value: clsValue,
          unit: 'score',
        })
      }
    }
  })

  clsObserver.observe({ entryTypes: ['layout-shift'] })
}

// API route performance tracking
export function trackAPIPerformance(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const url = new URL(req.url)
    const transactionId = performanceMonitor.startTransaction(
      `api.${req.method}.${url.pathname}`,
      {
        method: req.method,
        path: url.pathname,
      }
    )

    try {
      const response = await handler(req)
      performanceMonitor.endTransaction(transactionId)
      
      // Add performance headers
      response.headers.set(
        'Server-Timing',
        `total;dur=${performance.now()}`
      )
      
      return response
    } catch (error) {
      performanceMonitor.endTransaction(transactionId)
      throw error
    }
  }
}

// Resource timing analysis
export function analyzeResourceTiming() {
  if (typeof window === 'undefined') return

  const resources = performance.getEntriesByType('resource')
  
  const analysis = {
    totalResources: resources.length,
    byType: {} as Record<string, number>,
    slowResources: [] as any[],
    totalTransferSize: 0,
  }

  resources.forEach((resource: any) => {
    // Count by type
    const type = resource.initiatorType || 'other'
    analysis.byType[type] = (analysis.byType[type] || 0) + 1

    // Track slow resources (> 500ms)
    if (resource.duration > 500) {
      analysis.slowResources.push({
        name: resource.name,
        duration: resource.duration,
        type: resource.initiatorType,
        transferSize: resource.transferSize,
      })
    }

    // Total transfer size
    if (resource.transferSize) {
      analysis.totalTransferSize += resource.transferSize
    }
  })

  // Sort slow resources by duration
  analysis.slowResources.sort((a, b) => b.duration - a.duration)

  logger.info('Resource timing analysis', analysis)
  return analysis
}