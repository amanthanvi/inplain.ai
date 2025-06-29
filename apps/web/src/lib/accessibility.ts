/**
 * Accessibility utility functions for WCAG compliance
 */

// Color contrast calculation functions
export function getLuminance(rgb: { r: number; g: number; b: number }): number {
  const { r, g, b } = rgb
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

export function getContrastRatio(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number {
  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function parseColor(color: string): { r: number; g: number; b: number } | null {
  // Handle rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3])
    }
  }

  // Handle hex
  const hexMatch = color.match(/^#([0-9a-f]{6})$/i)
  if (hexMatch) {
    const hex = hexMatch[1]
    return {
      r: parseInt(hex.substr(0, 2), 16),
      g: parseInt(hex.substr(2, 2), 16),
      b: parseInt(hex.substr(4, 2), 16)
    }
  }

  return null
}

export function checkColorContrast(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): {
  ratio: number
  passes: {
    AA: boolean
    AAA: boolean
  }
} {
  const fg = parseColor(foreground)
  const bg = parseColor(background)

  if (!fg || !bg) {
    return {
      ratio: 0,
      passes: { AA: false, AAA: false }
    }
  }

  const ratio = getContrastRatio(fg, bg)
  
  // WCAG 2.1 requirements
  const AA_NORMAL = 4.5
  const AA_LARGE = 3
  const AAA_NORMAL = 7
  const AAA_LARGE = 4.5

  return {
    ratio,
    passes: {
      AA: ratio >= (isLargeText ? AA_LARGE : AA_NORMAL),
      AAA: ratio >= (isLargeText ? AAA_LARGE : AAA_NORMAL)
    }
  }
}

// Keyboard navigation helpers
export function trapFocus(container: HTMLElement) {
  const focusableElements = container.querySelectorAll(
    'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
  )
  
  const firstFocusable = focusableElements[0] as HTMLElement
  const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement

  function handleTabKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus()
        e.preventDefault()
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus()
        e.preventDefault()
      }
    }
  }

  container.addEventListener('keydown', handleTabKey)

  return () => {
    container.removeEventListener('keydown', handleTabKey)
  }
}

// Screen reader announcements
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = 'sr-only'
  announcement.textContent = message

  document.body.appendChild(announcement)

  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

// Focus management
export function restoreFocus(element: HTMLElement | null) {
  if (element && typeof element.focus === 'function') {
    element.focus()
  }
}

export function getFocusableElements(container: HTMLElement = document.body): HTMLElement[] {
  const elements = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )
  return Array.from(elements) as HTMLElement[]
}

// ARIA helpers
export function setAriaExpanded(element: HTMLElement, expanded: boolean) {
  element.setAttribute('aria-expanded', String(expanded))
}

export function setAriaPressed(element: HTMLElement, pressed: boolean) {
  element.setAttribute('aria-pressed', String(pressed))
}

export function setAriaSelected(element: HTMLElement, selected: boolean) {
  element.setAttribute('aria-selected', String(selected))
}

export function setAriaDisabled(element: HTMLElement, disabled: boolean) {
  element.setAttribute('aria-disabled', String(disabled))
  if (disabled) {
    element.setAttribute('tabindex', '-1')
  } else {
    element.removeAttribute('tabindex')
  }
}

// Semantic HTML helpers
export function isButton(element: Element): boolean {
  return element.tagName === 'BUTTON' || element.getAttribute('role') === 'button'
}

export function isLink(element: Element): boolean {
  return element.tagName === 'A' && element.hasAttribute('href')
}

export function isInteractive(element: Element): boolean {
  const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']
  const interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'switch', 'tab']
  
  return (
    interactiveTags.includes(element.tagName) ||
    interactiveRoles.includes(element.getAttribute('role') || '') ||
    element.hasAttribute('onclick') ||
    element.hasAttribute('tabindex')
  )
}

// Accessible loading states
export function setLoadingState(element: HTMLElement, loading: boolean) {
  element.setAttribute('aria-busy', String(loading))
  
  if (loading) {
    element.setAttribute('aria-label', 'Loading...')
  } else {
    element.removeAttribute('aria-label')
  }
}

// Accessible error messages
export function announceError(message: string) {
  announce(message, 'assertive')
}

export function associateError(input: HTMLElement, errorId: string) {
  const existingDescribedBy = input.getAttribute('aria-describedby')
  const newDescribedBy = existingDescribedBy 
    ? `${existingDescribedBy} ${errorId}`
    : errorId
    
  input.setAttribute('aria-describedby', newDescribedBy)
  input.setAttribute('aria-invalid', 'true')
}

export function clearError(input: HTMLElement, errorId: string) {
  const describedBy = input.getAttribute('aria-describedby')
  if (describedBy) {
    const newDescribedBy = describedBy
      .split(' ')
      .filter(id => id !== errorId)
      .join(' ')
      
    if (newDescribedBy) {
      input.setAttribute('aria-describedby', newDescribedBy)
    } else {
      input.removeAttribute('aria-describedby')
    }
  }
  
  input.setAttribute('aria-invalid', 'false')
}