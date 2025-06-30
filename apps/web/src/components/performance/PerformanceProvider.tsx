'use client'

import React, { createContext, useContext, useEffect, useRef } from 'react'
import { PerformanceMonitor, MemoryMonitor, PerformanceOptimizer, createPerformanceReport } from '@/lib/performance/index'
import { usePathname } from 'next/navigation'

interface PerformanceContextValue {
  monitor: PerformanceMonitor | null
  memoryMonitor: MemoryMonitor | null
  report: ReturnType<typeof createPerformanceReport> | null
}

const PerformanceContext = createContext<PerformanceContextValue>({
  monitor: null,
  memoryMonitor: null,
  report: null
})

export function usePerformance() {
  const context = useContext(PerformanceContext)
  if (!context) {
    throw new Error('usePerformance must be used within PerformanceProvider')
  }
  return context
}

interface PerformanceProviderProps {
  children: React.ReactNode
  sessionId?: string
  enableMonitoring?: boolean
}

export function PerformanceProvider({ 
  children, 
  sessionId = 'default',
  enableMonitoring = true 
}: PerformanceProviderProps) {
  const monitorRef = useRef<PerformanceMonitor | null>(null)
  const memoryMonitorRef = useRef<MemoryMonitor | null>(null)
  const pathname = usePathname()
  const [report, setReport] = React.useState<ReturnType<typeof createPerformanceReport> | null>(null)

  useEffect(() => {
    if (!enableMonitoring || typeof window === 'undefined') {
      return
    }

    // Initialize monitors
    monitorRef.current = new PerformanceMonitor(sessionId)
    memoryMonitorRef.current = new MemoryMonitor()

    // Start memory monitoring
    const memoryInterval = setInterval(() => {
      memoryMonitorRef.current?.measure()
    }, 10000) // Every 10 seconds

    // Lazy load images
    PerformanceOptimizer.lazyLoadImages()

    // Skip font preloading as we're using Google Fonts
    // which handles its own optimization

    // Monitor Core Web Vitals
    if ('web-vital' in window) {
      // This would integrate with web-vitals library
    }

    // Generate initial report after page load
    const reportTimeout = setTimeout(() => {
      if (monitorRef.current && memoryMonitorRef.current) {
        const newReport = createPerformanceReport(monitorRef.current, memoryMonitorRef.current)
        setReport(newReport)
      }
    }, 5000)

    // Cleanup
    return () => {
      clearInterval(memoryInterval)
      clearTimeout(reportTimeout)
      monitorRef.current?.disconnect()
    }
  }, [sessionId, enableMonitoring])

  // Track route changes
  useEffect(() => {
    if (!monitorRef.current) return

    // Record route change metric
    monitorRef.current.recordMetric({
      name: 'route-change',
      value: 1,
      unit: 'count',
      timestamp: Date.now(),
      tags: {
        from: window.location.pathname,
        to: pathname
      }
    })

    // Prefetch commonly accessed routes
    const commonRoutes = ['/dashboard', '/settings', '/watchlist']
    commonRoutes.forEach(route => {
      if (route !== pathname) {
        PerformanceOptimizer.prefetchRoute(route)
      }
    })

    // Generate new report after route change
    setTimeout(() => {
      if (monitorRef.current && memoryMonitorRef.current) {
        const newReport = createPerformanceReport(monitorRef.current, memoryMonitorRef.current)
        setReport(newReport)
      }
    }, 2000)
  }, [pathname])

  // Detect performance issues
  useEffect(() => {
    if (!report) return

    // Check for performance issues
    const issues = []

    if (report.coreWebVitals.LCP && report.coreWebVitals.LCP.avg > 2500) {
      issues.push('Slow page load detected')
    }

    if (report.memory && report.memory.trend > 50) {
      issues.push('High memory usage detected')
    }

    if (issues.length > 0) {
      console.warn('Performance issues detected:', issues)
      // Could send to monitoring service
    }
  }, [report])

  const value: PerformanceContextValue = {
    monitor: monitorRef.current,
    memoryMonitor: memoryMonitorRef.current,
    report
  }

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  )
}