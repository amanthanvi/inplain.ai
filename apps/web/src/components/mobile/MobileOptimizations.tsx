'use client'

import { useEffect } from 'react'
import { useBreakpoint } from '@/hooks/useMediaQuery'

export function MobileOptimizations() {
  const { isMobile } = useBreakpoint()

  useEffect(() => {
    if (!isMobile) return

    // Ensure proper viewport settings for mobile
    // IMPORTANT: Allow zooming for accessibility (WCAG compliance)
    const metaViewport = document.querySelector('meta[name="viewport"]')
    if (metaViewport) {
      metaViewport.setAttribute('content', 
        'width=device-width, initial-scale=1, minimum-scale=1'
      )
    }

    // Add touch-specific optimizations
    document.documentElement.classList.add('touch-device')

    // Prevent overscroll bounce on iOS
    document.body.style.overscrollBehavior = 'none'

    // Optimize for 60fps scrolling
    document.documentElement.style.scrollBehavior = 'smooth'

    return () => {
      // Cleanup
      document.documentElement.classList.remove('touch-device')
      document.body.style.overscrollBehavior = ''
      if (metaViewport) {
        metaViewport.setAttribute('content', 'width=device-width, initial-scale=1')
      }
    }
  }, [isMobile])

  useEffect(() => {
    if (!isMobile) return

    // Prefetch critical resources for mobile
    const links = [
      { rel: 'prefetch', href: '/api/companies' },
      { rel: 'prefetch', href: '/api/health' }, // Use health endpoint instead of non-existent notifications/count
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    ]

    links.forEach(({ rel, href }) => {
      const link = document.createElement('link')
      link.rel = rel
      link.href = href
      document.head.appendChild(link)
    })

    // Add mobile-specific CSS
    const style = document.createElement('style')
    style.textContent = `
      /* Optimize tap targets */
      .touch-device button,
      .touch-device a,
      .touch-device [role="button"] {
        min-height: 44px;
        min-width: 44px;
      }

      /* Reduce hover effects on touch but maintain visual feedback */
      .touch-device *:hover {
        transition-duration: 0ms;
      }
      
      /* Ensure focus states are visible for keyboard navigation */
      .touch-device *:focus-visible {
        outline: 2px solid var(--primary, #3B82F6);
        outline-offset: 2px;
      }

      /* Optimize scrolling */
      .touch-device * {
        -webkit-overflow-scrolling: touch;
      }

      /* Reduce motion for battery saving */
      @media (prefers-reduced-motion: reduce) {
        .touch-device * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      /* Hide scrollbars on mobile */
      .touch-device ::-webkit-scrollbar {
        display: none;
      }

      /* Optimize font rendering */
      .touch-device {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }

      /* Prevent text selection on UI elements */
      .touch-device button,
      .touch-device nav,
      .touch-device [role="button"] {
        -webkit-user-select: none;
        user-select: none;
      }

      /* Optimize images */
      .touch-device img {
        -webkit-touch-callout: none;
      }

      /* Fix position fixed issues on iOS */
      .touch-device .fixed {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
      }
    `
    document.head.appendChild(style)

    return () => {
      // Cleanup
      style.remove()
    }
  }, [isMobile])

  // Monitor performance on mobile
  useEffect(() => {
    if (!isMobile || !('PerformanceObserver' in window)) return

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.entryType === 'largest-contentful-paint') {
          console.log('LCP:', entry.startTime)
          // Send to analytics if needed
        }
      })
    })

    observer.observe({ entryTypes: ['largest-contentful-paint'] })

    return () => observer.disconnect()
  }, [isMobile])

  return null
}