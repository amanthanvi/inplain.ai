/**
 * Performance monitoring and optimization utilities
 */

interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'count' | 'percent'
  timestamp: number
  tags?: Record<string, string>
}

interface PerformanceSnapshot {
  metrics: PerformanceMetric[]
  timestamp: number
  userAgent?: string
  url?: string
  sessionId?: string
}

/**
 * Core Web Vitals thresholds
 */
export const WEB_VITALS_THRESHOLDS = {
  // Largest Contentful Paint (LCP)
  LCP: {
    good: 2500,
    needsImprovement: 4000
  },
  // First Input Delay (FID)
  FID: {
    good: 100,
    needsImprovement: 300
  },
  // Cumulative Layout Shift (CLS)
  CLS: {
    good: 0.1,
    needsImprovement: 0.25
  },
  // Time to First Byte (TTFB)
  TTFB: {
    good: 800,
    needsImprovement: 1800
  },
  // First Contentful Paint (FCP)
  FCP: {
    good: 1800,
    needsImprovement: 3000
  }
}

/**
 * Performance monitor class
 */
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map()
  private observers: Map<string, PerformanceObserver> = new Map()
  private resourceTimingBuffer: PerformanceResourceTiming[] = []
  
  constructor(private sessionId: string) {
    if (typeof window !== 'undefined') {
      this.initializeObservers()
      this.startResourceMonitoring()
    }
  }

  /**
   * Initialize performance observers
   */
  private initializeObservers() {
    // Observe Core Web Vitals
    if ('PerformanceObserver' in window) {
      // LCP Observer
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          this.recordMetric({
            name: 'LCP',
            value: lastEntry.renderTime || lastEntry.loadTime,
            unit: 'ms',
            timestamp: Date.now()
          })
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.set('lcp', lcpObserver)
      } catch (e) {
        console.warn('LCP observer not supported')
      }

      // FID Observer
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            this.recordMetric({
              name: 'FID',
              value: entry.processingStart - entry.startTime,
              unit: 'ms',
              timestamp: Date.now()
            })
          })
        })
        fidObserver.observe({ entryTypes: ['first-input'] })
        this.observers.set('fid', fidObserver)
      } catch (e) {
        console.warn('FID observer not supported')
      }

      // CLS Observer
      try {
        let clsValue = 0
        let clsEntries: any[] = []
        
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsEntries.push(entry)
              clsValue += (entry as any).value
            }
          }
        })
        clsObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.set('cls', clsObserver)

        // Report CLS when page is hidden
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            this.recordMetric({
              name: 'CLS',
              value: clsValue,
              unit: 'count',
              timestamp: Date.now()
            })
          }
        })
      } catch (e) {
        console.warn('CLS observer not supported')
      }
    }
  }

  /**
   * Start monitoring resource loading
   */
  private startResourceMonitoring() {
    if ('performance' in window && 'getEntriesByType' in performance) {
      // Monitor initial resources
      this.resourceTimingBuffer = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      
      // Set up observer for new resources
      if ('PerformanceObserver' in window) {
        const resourceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries() as PerformanceResourceTiming[]
          this.resourceTimingBuffer.push(...entries)
          this.analyzeResourcePerformance(entries)
        })
        
        try {
          resourceObserver.observe({ entryTypes: ['resource'] })
          this.observers.set('resource', resourceObserver)
        } catch (e) {
          console.warn('Resource timing observer not supported')
        }
      }
    }
  }

  /**
   * Analyze resource loading performance
   */
  private analyzeResourcePerformance(entries: PerformanceResourceTiming[]) {
    entries.forEach(entry => {
      const duration = entry.responseEnd - entry.startTime
      
      // Track slow resources
      if (duration > 1000) {
        this.recordMetric({
          name: 'slow-resource',
          value: duration,
          unit: 'ms',
          timestamp: Date.now(),
          tags: {
            url: entry.name,
            type: entry.initiatorType,
            size: String(entry.transferSize || 0)
          }
        })
      }
    })
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric) {
    const key = metric.name
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    this.metrics.get(key)!.push(metric)
    
    // Send to analytics if critical metric
    if (['LCP', 'FID', 'CLS', 'TTFB', 'FCP'].includes(metric.name)) {
      this.sendToAnalytics(metric)
    }
  }

  /**
   * Send metric to analytics
   */
  private async sendToAnalytics(metric: PerformanceMetric) {
    try {
      // Send to external analytics if configured
      if (typeof window !== 'undefined' && 'navigator' in window && 'sendBeacon' in navigator) {
        navigator.sendBeacon('/api/analytics/performance', JSON.stringify({
          metric,
          sessionId: this.sessionId,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href
        }))
      }
    } catch (error) {
      console.error('Failed to send analytics:', error)
    }
  }

  /**
   * Get performance snapshot
   */
  getSnapshot(): PerformanceSnapshot {
    const allMetrics: PerformanceMetric[] = []
    
    this.metrics.forEach(metrics => {
      allMetrics.push(...metrics)
    })
    
    return {
      metrics: allMetrics,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      sessionId: this.sessionId
    }
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const snapshot = this.getSnapshot()
    const summary: Record<string, any> = {}
    
    // Calculate averages for each metric
    const metricGroups = new Map<string, number[]>()
    
    snapshot.metrics.forEach(metric => {
      if (!metricGroups.has(metric.name)) {
        metricGroups.set(metric.name, [])
      }
      metricGroups.get(metric.name)!.push(metric.value)
    })
    
    metricGroups.forEach((values, name) => {
      const sorted = values.sort((a, b) => a - b)
      summary[name] = {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p75: sorted[Math.floor(sorted.length * 0.75)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        min: sorted[0],
        max: sorted[sorted.length - 1],
        count: values.length
      }
    })
    
    return summary
  }

  /**
   * Clean up observers
   */
  disconnect() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()
  }
}

/**
 * Performance optimization utilities
 */
export const PerformanceOptimizer = {
  /**
   * Lazy load images with Intersection Observer
   */
  lazyLoadImages(selector: string = 'img[data-src]') {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return
    }
    
    const images = document.querySelectorAll(selector)
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement
          img.src = img.dataset.src!
          img.removeAttribute('data-src')
          imageObserver.unobserve(img)
        }
      })
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    })
    
    images.forEach(img => imageObserver.observe(img))
  },

  /**
   * Preload critical resources
   */
  preloadResources(resources: Array<{ href: string; as: string; type?: string }>) {
    if (typeof document === 'undefined') return
    
    resources.forEach(resource => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = resource.href
      link.as = resource.as
      if (resource.type) {
        link.type = resource.type
      }
      document.head.appendChild(link)
    })
  },

  /**
   * Prefetch next page resources
   */
  prefetchRoute(route: string) {
    if (typeof window === 'undefined') return
    
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = route
    document.head.appendChild(link)
  },

  /**
   * Debounce function for performance
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout
    
    return function executedFunction(...args: Parameters<T>) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  },

  /**
   * Throttle function for performance
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean
    
    return function executedFunction(this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  },

  /**
   * Request idle callback with fallback
   */
  requestIdleCallback(
    callback: () => void,
    options?: { timeout?: number }
  ) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(callback, options)
    } else {
      setTimeout(callback, 1)
    }
  }
}

/**
 * Memory monitor
 */
export class MemoryMonitor {
  private measurements: Array<{ timestamp: number; usage: any }> = []
  
  /**
   * Measure memory usage
   */
  measure() {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return null
    }
    
    const perf = performance as any
    if (!perf.memory) {
      return null
    }
    
    const usage = {
      usedJSHeapSize: perf.memory.usedJSHeapSize,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit
    }
    
    this.measurements.push({
      timestamp: Date.now(),
      usage
    })
    
    // Keep only last 100 measurements
    if (this.measurements.length > 100) {
      this.measurements.shift()
    }
    
    return usage
  }
  
  /**
   * Detect memory leaks
   */
  detectLeaks(threshold: number = 50 * 1024 * 1024) { // 50MB threshold
    if (this.measurements.length < 10) {
      return false
    }
    
    const recent = this.measurements.slice(-10)
    if (recent.length === 0) {
      return false
    }
    
    const firstMeasurement = recent[0]
    const lastMeasurement = recent[recent.length - 1]
    
    if (!firstMeasurement || !lastMeasurement) {
      return false
    }
    
    const oldest = firstMeasurement.usage.usedJSHeapSize
    const newest = lastMeasurement.usage.usedJSHeapSize
    
    return (newest - oldest) > threshold
  }
  
  /**
   * Get memory statistics
   */
  getStats() {
    if (this.measurements.length === 0) {
      return null
    }
    
    const usages = this.measurements.map(m => m.usage.usedJSHeapSize)
    const sorted = [...usages].sort((a, b) => a - b)
    
    return {
      current: usages[usages.length - 1],
      average: usages.reduce((a, b) => a + b, 0) / usages.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      trend: usages.length > 1 ? 
        (usages[usages.length - 1] - usages[0]) / usages[0] * 100 : 0
    }
  }
}

/**
 * Bundle size analyzer
 */
export async function analyzeBundleSize() {
  if (typeof window === 'undefined') {
    return null
  }
  
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  const scripts = resources.filter(r => r.name.endsWith('.js'))
  const styles = resources.filter(r => r.name.endsWith('.css'))
  
  const analysis = {
    totalSize: 0,
    scripts: {
      count: scripts.length,
      size: 0,
      files: [] as Array<{ name: string; size: number; duration: number }>
    },
    styles: {
      count: styles.length,
      size: 0,
      files: [] as Array<{ name: string; size: number; duration: number }>
    },
    images: {
      count: 0,
      size: 0
    },
    other: {
      count: 0,
      size: 0
    }
  }
  
  // Analyze scripts
  scripts.forEach(script => {
    const size = script.transferSize || 0
    analysis.scripts.size += size
    analysis.scripts.files.push({
      name: script.name.split('/').pop() || script.name,
      size,
      duration: script.responseEnd - script.startTime
    })
  })
  
  // Analyze styles
  styles.forEach(style => {
    const size = style.transferSize || 0
    analysis.styles.size += size
    analysis.styles.files.push({
      name: style.name.split('/').pop() || style.name,
      size,
      duration: style.responseEnd - style.startTime
    })
  })
  
  // Sort by size
  analysis.scripts.files.sort((a, b) => b.size - a.size)
  analysis.styles.files.sort((a, b) => b.size - a.size)
  
  analysis.totalSize = analysis.scripts.size + analysis.styles.size
  
  return analysis
}

/**
 * Create performance report
 */
export function createPerformanceReport(monitor: PerformanceMonitor, memoryMonitor: MemoryMonitor) {
  const performanceSummary = monitor.getSummary()
  const memoryStats = memoryMonitor.getStats()
  const snapshot = monitor.getSnapshot()
  
  const report = {
    timestamp: new Date().toISOString(),
    url: snapshot.url,
    userAgent: snapshot.userAgent,
    
    coreWebVitals: {
      LCP: performanceSummary.LCP || null,
      FID: performanceSummary.FID || null,
      CLS: performanceSummary.CLS || null,
      TTFB: performanceSummary.TTFB || null,
      FCP: performanceSummary.FCP || null
    },
    
    memory: memoryStats,
    
    performance: {
      domContentLoaded: 0,
      loadComplete: 0,
      firstPaint: 0,
      firstContentfulPaint: 0
    },
    
    resources: {
      count: 0,
      totalSize: 0,
      totalDuration: 0
    },
    
    recommendations: [] as string[]
  }
  
  // Add timing data
  if (typeof window !== 'undefined' && 'performance' in window && performance.timing) {
    const timing = performance.timing
    report.performance.domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart
    report.performance.loadComplete = timing.loadEventEnd - timing.navigationStart
  }
  
  // Generate recommendations
  if (report.coreWebVitals.LCP && report.coreWebVitals.LCP.avg > WEB_VITALS_THRESHOLDS.LCP.needsImprovement) {
    report.recommendations.push('Optimize Largest Contentful Paint by preloading critical resources')
  }
  
  if (report.coreWebVitals.FID && report.coreWebVitals.FID.avg > WEB_VITALS_THRESHOLDS.FID.needsImprovement) {
    report.recommendations.push('Reduce First Input Delay by minimizing JavaScript execution time')
  }
  
  if (report.coreWebVitals.CLS && report.coreWebVitals.CLS.avg > WEB_VITALS_THRESHOLDS.CLS.needsImprovement) {
    report.recommendations.push('Improve Cumulative Layout Shift by reserving space for dynamic content')
  }
  
  if (memoryStats && memoryStats.trend > 20) {
    report.recommendations.push('Potential memory leak detected - investigate component lifecycle')
  }
  
  return report
}