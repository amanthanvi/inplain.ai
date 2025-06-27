/**
 * Accessibility utilities for WCAG 2.1 AA compliance
 */

import { useEffect, useRef, useState } from 'react'

/**
 * WCAG 2.1 AA Color contrast ratios
 * - Normal text: 4.5:1
 * - Large text (18pt or 14pt bold): 3:1
 */
export const CONTRAST_RATIOS = {
  normal: 4.5,
  large: 3.0
} as const

/**
 * Check if a color combination meets WCAG AA contrast requirements
 */
export function checkColorContrast(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): { ratio: number; passes: boolean } {
  const ratio = getContrastRatio(foreground, background)
  const requiredRatio = isLargeText ? CONTRAST_RATIOS.large : CONTRAST_RATIOS.normal
  
  return {
    ratio,
    passes: ratio >= requiredRatio
  }
}

/**
 * Calculate contrast ratio between two colors
 */
function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  
  return (brightest + 0.05) / (darkest + 0.05)
}

/**
 * Get relative luminance of a color
 */
function getLuminance(color: string): number {
  const rgb = hexToRgb(color)
  if (!rgb) return 0
  
  const [r, g, b] = rgb.map(val => {
    val = val / 255
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })
  
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [
        parseInt(result[1]!, 16),
        parseInt(result[2]!, 16),
        parseInt(result[3]!, 16)
      ]
    : null
}

/**
 * Focus management utilities
 */
export const FocusManager = {
  /**
   * Trap focus within an element
   */
  trapFocus(element: HTMLElement) {
    const focusableElements = element.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
    )
    
    const firstFocusable = focusableElements[0] as HTMLElement
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement
    
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable?.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable?.focus()
          e.preventDefault()
        }
      }
    }
    
    element.addEventListener('keydown', handleKeyDown)
    
    return () => {
      element.removeEventListener('keydown', handleKeyDown)
    }
  },
  
  /**
   * Return focus to a previous element
   */
  returnFocus(element: HTMLElement | null) {
    if (element && element.focus) {
      element.focus()
    }
  }
}

/**
 * Keyboard navigation hook
 */
export function useKeyboardNavigation(
  items: any[],
  onSelect: (item: any, index: number) => void,
  options: {
    vertical?: boolean
    wrap?: boolean
    onEscape?: () => void
  } = {}
) {
  const { vertical = true, wrap = true, onEscape } = options
  const selectedIndex = useRef(0)
  
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft'
      const nextKey = vertical ? 'ArrowDown' : 'ArrowRight'
      
      switch (e.key) {
        case prevKey:
          e.preventDefault()
          selectedIndex.current = wrap
            ? (selectedIndex.current - 1 + items.length) % items.length
            : Math.max(0, selectedIndex.current - 1)
          break
          
        case nextKey:
          e.preventDefault()
          selectedIndex.current = wrap
            ? (selectedIndex.current + 1) % items.length
            : Math.min(items.length - 1, selectedIndex.current + 1)
          break
          
        case 'Enter':
        case ' ':
          e.preventDefault()
          onSelect(items[selectedIndex.current], selectedIndex.current)
          break
          
        case 'Escape':
          if (onEscape) {
            e.preventDefault()
            onEscape()
          }
          break
          
        case 'Home':
          e.preventDefault()
          selectedIndex.current = 0
          break
          
        case 'End':
          e.preventDefault()
          selectedIndex.current = items.length - 1
          break
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [items, onSelect, vertical, wrap, onEscape])
  
  return selectedIndex.current
}

/**
 * Screen reader announcements
 */
export const ScreenReaderAnnouncer = {
  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    const announcer = document.createElement('div')
    announcer.setAttribute('role', 'status')
    announcer.setAttribute('aria-live', priority)
    announcer.setAttribute('aria-atomic', 'true')
    announcer.style.position = 'absolute'
    announcer.style.left = '-10000px'
    announcer.style.width = '1px'
    announcer.style.height = '1px'
    announcer.style.overflow = 'hidden'
    
    document.body.appendChild(announcer)
    announcer.textContent = message
    
    setTimeout(() => {
      document.body.removeChild(announcer)
    }, 1000)
  }
}

/**
 * ARIA helpers
 */
export const AriaHelpers = {
  /**
   * Generate unique IDs for ARIA relationships
   */
  generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
  },
  
  /**
   * Build ARIA label from multiple sources
   */
  buildLabel(...parts: (string | undefined)[]): string {
    return parts.filter(Boolean).join(' ')
  }
}


/**
 * Focus visible styles
 */
export const focusRingStyles = {
  default: 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  inset: 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
  none: 'focus:outline-none'
}

/**
 * Reduced motion utilities
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])
  
  return prefersReducedMotion
}

