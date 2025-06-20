import { describe, expect, it } from 'vitest'
import { 
  SnapshotMetaSchema, 
  DiffMetaSchema, 
  SummarySchema, 
  CompanySchema,
  CrawlJobSchema 
} from '../schemas'

describe('Schemas', () => {
  describe('SnapshotMetaSchema', () => {
    it('validates correct snapshot meta', () => {
      const valid = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'google-privacy',
        url: 'https://policies.google.com/privacy',
        capturedAt: '2025-06-20T10:00:00Z',
        blobKey: 'snapshots/google-privacy/2025-06-20T10:00:00Z.html',
        contentHash: 'a'.repeat(64),
        contentLength: 12345,
        contentType: 'html',
        headers: { 'content-type': 'text/html' },
        status: 'processed'
      }
      
      expect(() => SnapshotMetaSchema.parse(valid)).not.toThrow()
    })

    it('rejects invalid content hash', () => {
      const invalid = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'google-privacy',
        url: 'https://policies.google.com/privacy',
        capturedAt: '2025-06-20T10:00:00Z',
        blobKey: 'snapshots/google-privacy/2025-06-20T10:00:00Z.html',
        contentHash: 'invalid-hash',
        contentLength: 12345,
        contentType: 'html',
        headers: {},
        status: 'processed'
      }
      
      expect(() => SnapshotMetaSchema.parse(invalid)).toThrow()
    })
  })

  describe('DiffMetaSchema', () => {
    it('validates correct diff meta', () => {
      const valid = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        slug: 'google-privacy',
        fromSnapshotId: '123e4567-e89b-12d3-a456-426614174000',
        toSnapshotId: '123e4567-e89b-12d3-a456-426614174002',
        createdAt: '2025-06-20T11:00:00Z',
        changeCount: 15,
        changeType: 'moderate',
        additions: 10,
        deletions: 5,
        diffBlobKey: 'diffs/google-privacy/2025-06-20T11:00:00Z.json'
      }
      
      expect(() => DiffMetaSchema.parse(valid)).not.toThrow()
    })
  })

  describe('SummarySchema', () => {
    it('validates correct summary', () => {
      const valid = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        diffId: '123e4567-e89b-12d3-a456-426614174001',
        createdAt: '2025-06-20T11:01:00Z',
        model: 'claude-4-opus',
        prompt: 'Summarize privacy policy changes',
        summary: 'Google updated data retention policies',
        highlights: ['Data retention reduced to 18 months'],
        riskLevel: 'medium',
        categories: ['data_retention', 'user_rights'],
        tokensUsed: 1500,
        cached: false
      }
      
      expect(() => SummarySchema.parse(valid)).not.toThrow()
    })

    it('rejects invalid risk level', () => {
      const invalid = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        diffId: '123e4567-e89b-12d3-a456-426614174001',
        createdAt: '2025-06-20T11:01:00Z',
        model: 'claude-4-opus',
        prompt: 'Summarize privacy policy changes',
        summary: 'Google updated data retention policies',
        highlights: ['Data retention reduced to 18 months'],
        riskLevel: 'extreme',
        categories: ['data_retention'],
        tokensUsed: 1500
      }
      
      expect(() => SummarySchema.parse(invalid)).toThrow()
    })
  })

  describe('CompanySchema', () => {
    it('validates correct company', () => {
      const valid = {
        slug: 'google',
        name: 'Google',
        url: 'https://policies.google.com/privacy',
        category: 'tech',
        checkInterval: 86400,
        active: true
      }
      
      expect(() => CompanySchema.parse(valid)).not.toThrow()
    })

    it('applies default values', () => {
      const minimal = {
        slug: 'google',
        name: 'Google',
        url: 'https://policies.google.com/privacy'
      }
      
      const parsed = CompanySchema.parse(minimal)
      expect(parsed.checkInterval).toBe(86400)
      expect(parsed.active).toBe(true)
    })
  })

  describe('CrawlJobSchema', () => {
    it('validates correct crawl job', () => {
      const valid = {
        id: '123e4567-e89b-12d3-a456-426614174004',
        slug: 'google-privacy',
        url: 'https://policies.google.com/privacy',
        status: 'completed',
        createdAt: '2025-06-20T10:00:00Z',
        startedAt: '2025-06-20T10:00:01Z',
        completedAt: '2025-06-20T10:00:05Z',
        retries: 0
      }
      
      expect(() => CrawlJobSchema.parse(valid)).not.toThrow()
    })
  })
})