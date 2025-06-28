import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook for lazy loading images
 */
export function useLazyLoadImages(
  containerRef?: React.RefObject<HTMLElement>,
  selector: string = 'img[data-src]'
) {
  useEffect(() => {
    const container = containerRef?.current || document
    
    if (!container || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return
    }

    const images = container.querySelectorAll(selector)
    
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement
          if (img.dataset.src) {
            img.src = img.dataset.src
            img.removeAttribute('data-src')
            imageObserver.unobserve(img)
            
            // Add loading class
            img.classList.add('opacity-0')
            img.addEventListener('load', () => {
              img.classList.remove('opacity-0')
              img.classList.add('opacity-100', 'transition-opacity', 'duration-300')
            })
          }
        }
      })
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    })

    images.forEach(img => imageObserver.observe(img))

    return () => {
      images.forEach(img => imageObserver.unobserve(img))
    }
  }, [containerRef, selector])
}

/**
 * Hook for debounced values
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook for throttled callbacks
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now())
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      const timeSinceLastRun = now - lastRun.current

      if (timeSinceLastRun >= delay) {
        lastRun.current = now
        return callback(...args)
      } else {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          lastRun.current = Date.now()
          callback(...args)
        }, delay - timeSinceLastRun)
      }
    },
    [callback, delay]
  ) as T
}

/**
 * Hook for viewport visibility
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isIntersecting, setIsIntersecting] = React.useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsIntersecting(entry.isIntersecting)
        }
      },
      options
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [ref, options?.root, options?.rootMargin, options?.threshold])

  return isIntersecting
}

/**
 * Hook for prefetching routes
 */
export function usePrefetch(routes: string[]) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Use requestIdleCallback to prefetch when browser is idle
    const prefetchRoutes = () => {
      routes.forEach(route => {
        // Prefetch route
        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.href = route
        document.head.appendChild(link)
      })
    }

    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(prefetchRoutes)
      return () => window.cancelIdleCallback(handle)
    } else {
      const timeout = setTimeout(prefetchRoutes, 1)
      return () => clearTimeout(timeout)
    }
  }, [routes])
}

/**
 * Hook for measuring component render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderCount = useRef(0)
  const renderStartTime = useRef<number>()

  useEffect(() => {
    renderStartTime.current = performance.now()
    return () => {
      if (renderStartTime.current) {
        const renderTime = performance.now() - renderStartTime.current
        if (renderTime > 16) { // Longer than one frame (60fps)
          console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`)
        }
      }
    }
  })

  useEffect(() => {
    renderCount.current++
    if (renderCount.current > 50) {
      console.warn(`Excessive re-renders detected in ${componentName}: ${renderCount.current} renders`)
    }
  })
}

/**
 * Hook for virtual scrolling
 */
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3
}: {
  items: T[]
  itemHeight: number
  containerHeight: number
  overscan?: number
}) {
  const [scrollTop, setScrollTop] = React.useState(0)

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )

  const visibleItems = items.slice(startIndex, endIndex + 1)
  const totalHeight = items.length * itemHeight
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex
  }
}

// Re-export React.useState to fix the reference error
import * as React from 'react'