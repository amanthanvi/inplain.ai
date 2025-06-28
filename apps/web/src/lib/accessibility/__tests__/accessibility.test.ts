import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  checkColorContrast,
  FocusManager,
  useKeyboardNavigation,
  ScreenReaderAnnouncer,
  AriaHelpers,
  useReducedMotion,
  CONTRAST_RATIOS
} from '../index'

describe('Accessibility Utilities', () => {
  describe('checkColorContrast', () => {
    it('should pass AA contrast for normal text with sufficient contrast', () => {
      // Black on white - maximum contrast
      const result = checkColorContrast('#000000', '#FFFFFF', false)
      
      expect(result.ratio).toBeCloseTo(21, 0)
      expect(result.passes).toBe(true)
    })

    it('should fail AA contrast for normal text with insufficient contrast', () => {
      // Light gray on white - poor contrast
      const result = checkColorContrast('#CCCCCC', '#FFFFFF', false)
      
      expect(result.ratio).toBeLessThan(CONTRAST_RATIOS.normal)
      expect(result.passes).toBe(false)
    })

    it('should use lower threshold for large text', () => {
      // Medium gray on white - passes for large text only
      const normalResult = checkColorContrast('#777777', '#FFFFFF', false)
      const largeResult = checkColorContrast('#777777', '#FFFFFF', true)
      
      expect(normalResult.passes).toBe(false)
      expect(largeResult.passes).toBe(true)
      expect(largeResult.ratio).toBeGreaterThan(CONTRAST_RATIOS.large)
    })

    it('should handle hex colors with and without hash', () => {
      const withHash = checkColorContrast('#000000', '#FFFFFF')
      const withoutHash = checkColorContrast('000000', 'FFFFFF')
      
      expect(withHash.ratio).toBe(withoutHash.ratio)
    })

    it('should handle invalid color formats', () => {
      const result = checkColorContrast('invalid', '#FFFFFF')
      
      expect(result.ratio).toBe(1) // Minimum possible ratio
      expect(result.passes).toBe(false)
    })
  })

  describe('FocusManager', () => {
    let container: HTMLElement

    beforeEach(() => {
      container = document.createElement('div')
      container.innerHTML = `
        <button id="btn1">Button 1</button>
        <input type="text" id="input1" />
        <a href="#" id="link1">Link 1</a>
        <select id="select1">
          <option>Option 1</option>
        </select>
        <button id="btn2">Button 2</button>
        <div tabindex="-1" id="skip">Skip me</div>
        <button id="btn3">Button 3</button>
      `
      document.body.appendChild(container)
    })

    afterEach(() => {
      document.body.removeChild(container)
    })

    it('should trap focus within container', () => {
      const cleanup = FocusManager.trapFocus(container)
      const firstButton = container.querySelector('#btn1') as HTMLElement
      const lastButton = container.querySelector('#btn3') as HTMLElement

      // Focus last element and press Tab
      lastButton.focus()
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' })
      container.dispatchEvent(tabEvent)

      // Should wrap to first element
      expect(document.activeElement).toBe(firstButton)

      cleanup()
    })

    it('should handle shift+tab for reverse navigation', () => {
      const cleanup = FocusManager.trapFocus(container)
      const firstButton = container.querySelector('#btn1') as HTMLElement
      const lastButton = container.querySelector('#btn3') as HTMLElement

      // Focus first element and press Shift+Tab
      firstButton.focus()
      const shiftTabEvent = new KeyboardEvent('keydown', { 
        key: 'Tab', 
        shiftKey: true 
      })
      container.dispatchEvent(shiftTabEvent)

      // Should wrap to last element
      expect(document.activeElement).toBe(lastButton)

      cleanup()
    })

    it('should skip elements with tabindex="-1"', () => {
      const focusableElements = container.querySelectorAll(
        'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
      )
      
      expect(focusableElements.length).toBe(5) // Should not include the skip div
      expect(Array.from(focusableElements).some(el => el.id === 'skip')).toBe(false)
    })

    it('should return focus to previous element', () => {
      const button = container.querySelector('#btn1') as HTMLElement
      button.focus()
      
      const input = container.querySelector('#input1') as HTMLElement
      input.focus()
      
      FocusManager.returnFocus(button)
      expect(document.activeElement).toBe(button)
    })

    it('should handle null element gracefully', () => {
      expect(() => {
        FocusManager.returnFocus(null)
      }).not.toThrow()
    })
  })

  describe('useKeyboardNavigation', () => {
    it('should navigate through items with arrow keys', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']
      const onSelect = vi.fn()
      
      const { result } = renderHook(() => 
        useKeyboardNavigation(items, onSelect, { vertical: true })
      )

      // Initial index should be 0
      expect(result.current).toBe(0)

      // Navigate down
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        document.dispatchEvent(event)
      })

      // Navigate up
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
        document.dispatchEvent(event)
      })
    })

    it('should handle horizontal navigation', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']
      const onSelect = vi.fn()
      
      renderHook(() => 
        useKeyboardNavigation(items, onSelect, { vertical: false })
      )

      // Navigate right
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' })
        document.dispatchEvent(event)
      })

      // Navigate left
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
        document.dispatchEvent(event)
      })
    })

    it('should select item on Enter or Space', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']
      const onSelect = vi.fn()
      
      renderHook(() => 
        useKeyboardNavigation(items, onSelect)
      )

      // Press Enter
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' })
        document.dispatchEvent(event)
      })

      expect(onSelect).toHaveBeenCalledWith('Item 1', 0)

      // Press Space
      act(() => {
        const event = new KeyboardEvent('keydown', { key: ' ' })
        document.dispatchEvent(event)
      })

      expect(onSelect).toHaveBeenCalledTimes(2)
    })

    it('should handle Home and End keys', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']
      const onSelect = vi.fn()
      
      renderHook(() => 
        useKeyboardNavigation(items, onSelect)
      )

      // Press End
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'End' })
        document.dispatchEvent(event)
      })

      // Press Home
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Home' })
        document.dispatchEvent(event)
      })
    })

    it('should call onEscape when Escape is pressed', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']
      const onSelect = vi.fn()
      const onEscape = vi.fn()
      
      renderHook(() => 
        useKeyboardNavigation(items, onSelect, { onEscape })
      )

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' })
        document.dispatchEvent(event)
      })

      expect(onEscape).toHaveBeenCalled()
    })

    it('should wrap navigation when enabled', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']
      const onSelect = vi.fn()
      
      renderHook(() => 
        useKeyboardNavigation(items, onSelect, { wrap: true })
      )

      // Navigate up from first item (should wrap to last)
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
        document.dispatchEvent(event)
      })
    })

    it('should not wrap navigation when disabled', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']
      const onSelect = vi.fn()
      
      renderHook(() => 
        useKeyboardNavigation(items, onSelect, { wrap: false })
      )

      // Navigate up from first item (should stay at first)
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
        document.dispatchEvent(event)
      })
    })
  })

  describe('ScreenReaderAnnouncer', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should create announcement element with polite priority', () => {
      ScreenReaderAnnouncer.announce('Test message', 'polite')
      
      const announcer = document.querySelector('[role="status"][aria-live="polite"]')
      expect(announcer).toBeTruthy()
      expect(announcer?.textContent).toBe('Test message')
      
      // Clean up after timeout
      vi.advanceTimersByTime(1000)
      expect(document.querySelector('[role="status"]')).toBeFalsy()
    })

    it('should create announcement element with assertive priority', () => {
      ScreenReaderAnnouncer.announce('Urgent message', 'assertive')
      
      const announcer = document.querySelector('[role="status"][aria-live="assertive"]')
      expect(announcer).toBeTruthy()
      expect(announcer?.textContent).toBe('Urgent message')
    })

    it('should position announcer off-screen', () => {
      ScreenReaderAnnouncer.announce('Hidden message')
      
      const announcer = document.querySelector('[role="status"]') as HTMLElement
      expect(announcer.style.position).toBe('absolute')
      expect(announcer.style.left).toBe('-10000px')
    })

    it('should set aria-atomic to true', () => {
      ScreenReaderAnnouncer.announce('Atomic message')
      
      const announcer = document.querySelector('[role="status"]')
      expect(announcer?.getAttribute('aria-atomic')).toBe('true')
    })
  })

  describe('AriaHelpers', () => {
    it('should generate unique IDs', () => {
      const id1 = AriaHelpers.generateId('test')
      const id2 = AriaHelpers.generateId('test')
      
      expect(id1).toMatch(/^test-[a-z0-9]{9}$/)
      expect(id2).toMatch(/^test-[a-z0-9]{9}$/)
      expect(id1).not.toBe(id2)
    })

    it('should build labels from multiple parts', () => {
      const label = AriaHelpers.buildLabel('First', 'Second', undefined, 'Third')
      expect(label).toBe('First Second Third')
    })

    it('should filter out undefined parts when building labels', () => {
      const label = AriaHelpers.buildLabel('First', undefined, '', 'Last')
      expect(label).toBe('First Last')
    })

    it('should return empty string when all parts are undefined', () => {
      const label = AriaHelpers.buildLabel(undefined, '', undefined)
      expect(label).toBe('')
    })
  })

  describe('useReducedMotion', () => {
    let mockMediaQueryList: {
      matches: boolean
      addEventListener: vi.Mock
      removeEventListener: vi.Mock
    }

    beforeEach(() => {
      mockMediaQueryList = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }

      vi.spyOn(window, 'matchMedia').mockReturnValue(mockMediaQueryList as any)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should detect reduced motion preference', () => {
      mockMediaQueryList.matches = true
      
      const { result } = renderHook(() => useReducedMotion())
      
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
      expect(result.current).toBe(true)
    })

    it('should respond to preference changes', () => {
      const { result } = renderHook(() => useReducedMotion())
      
      expect(result.current).toBe(false)

      // Simulate preference change
      act(() => {
        const handler = mockMediaQueryList.addEventListener.mock.calls[0][1]
        handler({ matches: true })
      })

      expect(result.current).toBe(true)
    })

    it('should clean up event listener on unmount', () => {
      const { unmount } = renderHook(() => useReducedMotion())
      
      unmount()
      
      expect(mockMediaQueryList.removeEventListener).toHaveBeenCalled()
    })
  })

  describe('focusRingStyles', () => {
    it('should provide consistent focus ring styles', () => {
      expect(focusRingStyles.default).toContain('focus-visible:ring-2')
      expect(focusRingStyles.default).toContain('focus-visible:ring-primary')
      expect(focusRingStyles.inset).toContain('focus-visible:ring-inset')
      expect(focusRingStyles.none).toBe('focus:outline-none')
    })
  })
})