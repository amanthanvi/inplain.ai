import { describe, expect, it } from 'vitest'
import { DiffEngine } from '../lib/diff-engine'

describe('DiffEngine', () => {
  let engine: DiffEngine

  beforeEach(() => {
    engine = new DiffEngine()
  })

  describe('computeDiff', () => {
    it('identifies additions correctly', () => {
      const oldText = 'Hello world'
      const newText = 'Hello beautiful world'
      
      const result = engine.computeDiff(oldText, newText)
      
      expect(result.additions).toBeGreaterThan(0)
      expect(result.deletions).toBe(0)
      expect(result.changeCount).toBe(1)
      expect(result.changeType).toBe('major') // Adding 10 chars to 11 chars = 90% change
    })

    it('identifies deletions correctly', () => {
      const oldText = 'Hello beautiful world'
      const newText = 'Hello world'
      
      const result = engine.computeDiff(oldText, newText)
      
      expect(result.additions).toBe(0)
      expect(result.deletions).toBeGreaterThan(0)
      expect(result.changeCount).toBe(1)
      expect(result.changeType).toBe('major') // Removing 10 chars from 21 chars = 47% change
    })

    it('identifies mixed changes correctly', () => {
      const oldText = 'The quick brown fox'
      const newText = 'The fast red fox'
      
      const result = engine.computeDiff(oldText, newText)
      
      expect(result.additions).toBeGreaterThan(0)
      expect(result.deletions).toBeGreaterThan(0)
      expect(result.changeCount).toBe(2) // Two separate change operations
      expect(result.changeType).toBe('major') // ~84% change ratio
    })

    it('generates HTML diff with proper markup', () => {
      const oldText = 'Hello world'
      const newText = 'Hello beautiful world'
      
      const result = engine.computeDiff(oldText, newText)
      
      expect(result.htmlDiff).toContain('<ins class="diff-addition">')
      expect(result.htmlDiff).toContain('beautiful ')
    })

    it('escapes HTML characters in diff', () => {
      const oldText = 'Hello <world>'
      const newText = 'Hello <beautiful & world>'
      
      const result = engine.computeDiff(oldText, newText)
      
      expect(result.htmlDiff).toContain('&lt;')
      expect(result.htmlDiff).toContain('&gt;')
      expect(result.htmlDiff).toContain('&amp;')
    })

    it('calculates major changes correctly', () => {
      const oldText = 'This is the original text'
      const newText = 'Completely different content here now'
      
      const result = engine.computeDiff(oldText, newText)
      
      expect(result.changeType).toBe('major')
    })
  })

  describe('applyPatches', () => {
    it('applies patches successfully', () => {
      const oldText = 'Hello world'
      const newText = 'Hello beautiful world'
      
      const result = engine.computeDiff(oldText, newText)
      const patched = engine.applyPatches(oldText, result.patches)
      
      expect(patched).toBe(newText)
    })

    it('throws error on patch failure', () => {
      const patches = [{ start1: 0, start2: 0, length1: 5, length2: 5, diffs: [[0, 'Invalid']] }]
      
      expect(() => engine.applyPatches('Different text', patches)).toThrow()
    })
  })
})