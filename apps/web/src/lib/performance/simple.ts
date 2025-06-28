/**
 * Simple performance monitoring utilities
 */

export const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  TTFB: { good: 800, needsImprovement: 1800 },
  FCP: { good: 1800, needsImprovement: 3000 }
}

export class SimplePerformanceMonitor {
  private metrics: Map<string, any[]> = new Map()
  
  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push({ value, timestamp: Date.now() })
  }
  
  getSummary() {
    const summary: Record<string, any> = {}
    
    this.metrics.forEach((values, name) => {
      const nums = values.map(v => v.value)
      summary[name] = {
        avg: nums.reduce((a, b) => a + b, 0) / nums.length,
        count: nums.length
      }
    })
    
    return summary
  }
}

export function measureWebVitals() {
  if (typeof window === 'undefined') return
  
  // Measure FCP
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            console.log('FCP:', entry.startTime)
          }
        }
      })
      observer.observe({ entryTypes: ['paint'] })
    } catch (e) {
      console.log('FCP observer not supported')
    }
  }
}