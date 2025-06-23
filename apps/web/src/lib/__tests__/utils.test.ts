import { describe, it, expect } from 'vitest'
import { cn, formatDate, formatFileSize, getTimeDiff, truncateText, validateEmail } from '../utils'

describe('utils', () => {
  describe('cn (className utility)', () => {
    it('merges class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2')
    })

    it('handles conditional classes', () => {
      expect(cn('base', true && 'conditional', false && 'excluded')).toBe('base conditional')
    })

    it('handles undefined and null values', () => {
      expect(cn('base', undefined, null, 'valid')).toBe('base valid')
    })
  })

  describe('formatDate', () => {
    it('formats date strings correctly', () => {
      const date = '2024-01-15T10:30:00Z'
      const formatted = formatDate(date)
      expect(formatted).toMatch(/Jan 15, 2024/)
    })

    it('handles invalid dates', () => {
      expect(formatDate('invalid-date')).toBe('Invalid Date')
    })

    it('formats relative time', () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const relative = formatDate(oneHourAgo.toISOString(), 'relative')
      expect(relative).toMatch(/ago/)
    })
  })

  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1048576)).toBe('1 MB')
      expect(formatFileSize(1073741824)).toBe('1 GB')
    })

    it('handles zero and small values', () => {
      expect(formatFileSize(0)).toBe('0 Bytes')
      expect(formatFileSize(512)).toBe('512 Bytes')
    })
  })

  describe('getTimeDiff', () => {
    it('calculates time differences correctly', () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      
      const diff = getTimeDiff(oneHourAgo.toISOString())
      expect(diff.hours).toBe(1)
      expect(diff.minutes).toBe(0)
    })

    it('handles future dates', () => {
      const now = new Date()
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
      
      const diff = getTimeDiff(oneHourFromNow.toISOString())
      expect(diff.hours).toBe(-1)
    })
  })

  describe('truncateText', () => {
    it('truncates long text', () => {
      const longText = 'This is a very long text that should be truncated'
      expect(truncateText(longText, 20)).toBe('This is a very long ...')
    })

    it('does not truncate short text', () => {
      const shortText = 'Short text'
      expect(truncateText(shortText, 20)).toBe('Short text')
    })

    it('handles empty string', () => {
      expect(truncateText('', 10)).toBe('')
    })
  })

  describe('validateEmail', () => {
    it('validates correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true)
    })

    it('rejects invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
      expect(validateEmail('@domain.com')).toBe(false)
      expect(validateEmail('')).toBe(false)
    })
  })
})