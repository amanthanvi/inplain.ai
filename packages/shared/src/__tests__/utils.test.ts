import { describe, expect, it, vi } from 'vitest'
import {
  slugify,
  formatTimestamp,
  parseTimestamp,
  getTimeDiff,
  formatDuration,
  hashContent,
  truncate,
  extractDomain,
  normalizeUrl,
  calculateChangeType
} from '../utils'

describe('Utils', () => {
  describe('slugify', () => {
    it('converts text to slug', () => {
      expect(slugify('Hello World!')).toBe('hello-world')
      expect(slugify('Google Privacy Policy')).toBe('google-privacy-policy')
      expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces')
      expect(slugify('Special@#$Characters')).toBe('specialcharacters')
    })
  })

  describe('formatTimestamp', () => {
    it('formats date to ISO string', () => {
      const date = new Date('2025-06-20T10:00:00Z')
      expect(formatTimestamp(date)).toBe('2025-06-20T10:00:00.000Z')
    })

    it('uses current date when not provided', () => {
      const now = new Date()
      const result = formatTimestamp()
      const parsed = new Date(result)
      expect(Math.abs(parsed.getTime() - now.getTime())).toBeLessThan(1000)
    })
  })

  describe('parseTimestamp', () => {
    it('parses ISO string to Date', () => {
      const timestamp = '2025-06-20T10:00:00.000Z'
      const date = parseTimestamp(timestamp)
      expect(date).toBeInstanceOf(Date)
      expect(date.toISOString()).toBe(timestamp)
    })
  })

  describe('getTimeDiff', () => {
    it('calculates time difference in milliseconds', () => {
      const from = '2025-06-20T10:00:00Z'
      const to = '2025-06-20T10:05:00Z'
      expect(getTimeDiff(from, to)).toBe(5 * 60 * 1000)
    })

    it('handles Date objects', () => {
      const from = new Date('2025-06-20T10:00:00Z')
      const to = new Date('2025-06-20T10:05:00Z')
      expect(getTimeDiff(from, to)).toBe(5 * 60 * 1000)
    })
  })

  describe('formatDuration', () => {
    it('formats milliseconds to human readable duration', () => {
      expect(formatDuration(500)).toBe('0s')
      expect(formatDuration(5000)).toBe('5s')
      expect(formatDuration(65000)).toBe('1m 5s')
      expect(formatDuration(3665000)).toBe('1h 1m')
      expect(formatDuration(90065000)).toBe('1d 1h')
    })
  })

  describe('hashContent', () => {
    it('generates consistent hash for content', async () => {
      const content = 'Hello World'
      const hash1 = await hashContent(content)
      const hash2 = await hashContent(content)
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64)
    })

    it('generates different hashes for different content', async () => {
      const hash1 = await hashContent('Hello World')
      const hash2 = await hashContent('Hello World!')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('truncate', () => {
    it('truncates long text', () => {
      const text = 'This is a very long text that needs to be truncated'
      expect(truncate(text, 20)).toBe('This is a very lo...')
      expect(truncate(text, 20, '…')).toBe('This is a very long…')
    })

    it('returns original text if shorter than limit', () => {
      const text = 'Short text'
      expect(truncate(text, 20)).toBe('Short text')
    })
  })

  describe('extractDomain', () => {
    it('extracts domain from URL', () => {
      expect(extractDomain('https://www.google.com/privacy')).toBe('google.com')
      expect(extractDomain('https://policies.google.com/privacy')).toBe('policies.google.com')
      expect(extractDomain('http://example.org:8080/path')).toBe('example.org')
    })

    it('returns empty string for invalid URL', () => {
      expect(extractDomain('not-a-url')).toBe('')
    })
  })

  describe('normalizeUrl', () => {
    it('normalizes URLs', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com')
      expect(normalizeUrl('https://example.com/path#anchor')).toBe('https://example.com/path')
      expect(normalizeUrl('https://example.com/path?query=value')).toBe('https://example.com/path')
    })

    it('returns original for invalid URL', () => {
      expect(normalizeUrl('not-a-url')).toBe('not-a-url')
    })
  })

  describe('calculateChangeType', () => {
    it('calculates change type based on ratio', () => {
      expect(calculateChangeType(2, 2, 100)).toBe('minor')
      expect(calculateChangeType(10, 10, 100)).toBe('moderate')
      expect(calculateChangeType(20, 20, 100)).toBe('major')
    })

    it('returns minor for zero total', () => {
      expect(calculateChangeType(10, 10, 0)).toBe('minor')
    })
  })
})