export interface PerformanceMetrics {
  duration: number;
  memoryUsed?: number;
  cacheHit?: boolean;
  timestamp: number;
}

export class PerformanceMonitor {
  private static metrics: Map<string, PerformanceMetrics[]> = new Map();
  private static readonly MAX_METRICS = 1000;

  /**
   * Start a performance measurement
   */
  static startMeasure(label: string): () => void {
    const start = Date.now();
    const startMemory = typeof process !== 'undefined' ? process.memoryUsage().heapUsed : 0;

    return () => {
      const duration = Date.now() - start;
      const memoryUsed = typeof process !== 'undefined' 
        ? process.memoryUsage().heapUsed - startMemory 
        : 0;

      this.recordMetric(label, {
        duration,
        memoryUsed,
        timestamp: Date.now()
      });
    };
  }

  /**
   * Measure an async function
   */
  static async measure<T>(
    label: string,
    fn: () => Promise<T>,
    options?: { cacheHit?: boolean }
  ): Promise<T> {
    const end = this.startMeasure(label);
    
    try {
      const result = await fn();
      end();
      
      if (options?.cacheHit !== undefined) {
        const metrics = this.metrics.get(label);
        if (metrics && metrics.length > 0) {
          const lastMetric = metrics[metrics.length - 1];
          if (lastMetric) {
            lastMetric.cacheHit = options.cacheHit;
          }
        }
      }
      
      return result;
    } catch (error) {
      end();
      throw error;
    }
  }

  /**
   * Record a metric
   */
  static recordMetric(label: string, metric: PerformanceMetrics): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }

    const metrics = this.metrics.get(label)!;
    metrics.push(metric);

    // Keep only recent metrics
    if (metrics.length > this.MAX_METRICS) {
      metrics.shift();
    }

    // Log slow operations
    if (metric.duration > 1000) {
      console.warn(`Slow operation detected: ${label} took ${metric.duration}ms`);
    }
  }

  /**
   * Get performance stats for a label
   */
  static getStats(label: string): {
    count: number;
    avgDuration: number;
    p50: number;
    p95: number;
    p99: number;
    cacheHitRate: number;
  } | null {
    const metrics = this.metrics.get(label);
    if (!metrics || metrics.length === 0) return null;

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const cacheHits = metrics.filter(m => m.cacheHit === true).length;
    const cacheAttempts = metrics.filter(m => m.cacheHit !== undefined).length;

    return {
      count: metrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50: durations[Math.floor(durations.length * 0.5)] || 0,
      p95: durations[Math.floor(durations.length * 0.95)] || 0,
      p99: durations[Math.floor(durations.length * 0.99)] || 0,
      cacheHitRate: cacheAttempts > 0 ? (cacheHits / cacheAttempts) * 100 : 0
    };
  }

  /**
   * Get all performance stats
   */
  static getAllStats(): Record<string, ReturnType<typeof this.getStats>> {
    const stats: Record<string, any> = {};
    
    for (const [label] of this.metrics) {
      stats[label] = this.getStats(label);
    }
    
    return stats;
  }

  /**
   * Clear metrics
   */
  static clear(label?: string): void {
    if (label) {
      this.metrics.delete(label);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Web Vitals tracking
   */
  static trackWebVitals(metric: {
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
  }): void {
    // In production, send to analytics
    console.log('Web Vital:', metric);
    
    // Record locally
    this.recordMetric(`webvital:${metric.name}`, {
      duration: metric.value,
      timestamp: Date.now()
    });
  }

  /**
   * Generate performance report
   */
  static generateReport(): string {
    const stats = this.getAllStats();
    const report: string[] = ['Performance Report\n==================\n'];

    for (const [label, stat] of Object.entries(stats)) {
      if (!stat) continue;
      
      report.push(`${label}:`);
      report.push(`  Count: ${stat.count}`);
      report.push(`  Avg: ${stat.avgDuration.toFixed(2)}ms`);
      report.push(`  P50: ${stat.p50}ms`);
      report.push(`  P95: ${stat.p95}ms`);
      report.push(`  P99: ${stat.p99}ms`);
      if (stat.cacheHitRate > 0) {
        report.push(`  Cache Hit Rate: ${stat.cacheHitRate.toFixed(1)}%`);
      }
      report.push('');
    }

    return report.join('\n');
  }
}

// Middleware for automatic performance tracking
export function withPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  label: string
): T {
  return (async (...args: Parameters<T>) => {
    return PerformanceMonitor.measure(label, () => fn(...args));
  }) as T;
}

// React hook for component performance tracking
export function usePerformanceTracking(componentName: string) {
  if (typeof window === 'undefined') return;

  // Track mount time
  const mountTime = Date.now();
  
  // Track renders
  let renderCount = 0;
  
  return {
    trackRender: () => {
      renderCount++;
      PerformanceMonitor.recordMetric(`component:${componentName}:render`, {
        duration: 0,
        timestamp: Date.now()
      });
    },
    trackUnmount: () => {
      const lifetime = Date.now() - mountTime;
      PerformanceMonitor.recordMetric(`component:${componentName}:lifetime`, {
        duration: lifetime,
        timestamp: Date.now()
      });
    }
  };
}