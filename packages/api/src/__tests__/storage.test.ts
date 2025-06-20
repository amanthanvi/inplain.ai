import { describe, expect, it, vi, beforeEach } from 'vitest'
import { StorageClient } from '../lib/storage'
import type { SnapshotMeta, DiffMeta, Summary } from '@policydiff/shared'

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    zadd: vi.fn(),
    zrange: vi.fn()
  }
}))

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
  put: vi.fn(),
  list: vi.fn()
}))

describe('StorageClient', () => {
  let storage: StorageClient

  beforeEach(() => {
    storage = new StorageClient()
    vi.clearAllMocks()
  })

  describe('getSnapshot', () => {
    it('retrieves snapshot by slug and id', async () => {
      const mockSnapshot: SnapshotMeta = {
        id: '123',
        slug: 'google',
        url: 'https://google.com/privacy',
        capturedAt: '2025-06-20T10:00:00Z',
        blobKey: 'snapshots/google/123.html',
        contentHash: 'a'.repeat(64),
        contentLength: 1000,
        contentType: 'html',
        headers: {},
        status: 'processed'
      }

      const { kv } = await import('@vercel/kv')
      vi.mocked(kv.get).mockResolvedValue(mockSnapshot)

      const result = await storage.getSnapshot('google', '123')
      
      expect(kv.get).toHaveBeenCalledWith('snapshot:google:123')
      expect(result).toEqual(mockSnapshot)
    })
  })

  describe('getLatestSnapshots', () => {
    it('retrieves latest snapshots for a slug', async () => {
      const mockSnapshots: SnapshotMeta[] = [
        {
          id: '123',
          slug: 'google',
          url: 'https://google.com/privacy',
          capturedAt: '2025-06-20T10:00:00Z',
          blobKey: 'snapshots/google/123.html',
          contentHash: 'a'.repeat(64),
          contentLength: 1000,
          contentType: 'html',
          headers: {},
          status: 'processed'
        },
        {
          id: '124',
          slug: 'google',
          url: 'https://google.com/privacy',
          capturedAt: '2025-06-20T11:00:00Z',
          blobKey: 'snapshots/google/124.html',
          contentHash: 'b'.repeat(64),
          contentLength: 1100,
          contentType: 'html',
          headers: {},
          status: 'processed'
        }
      ]

      const { kv } = await import('@vercel/kv')
      vi.mocked(kv.zrange).mockResolvedValue(['snapshot:google:123', 'snapshot:google:124'])
      vi.mocked(kv.get).mockImplementation((key) => {
        if (key === 'snapshot:google:123') return Promise.resolve(mockSnapshots[0])
        if (key === 'snapshot:google:124') return Promise.resolve(mockSnapshots[1])
        return Promise.resolve(null)
      })

      const result = await storage.getLatestSnapshots('google', 2)
      
      expect(kv.zrange).toHaveBeenCalledWith('snapshots:google', -2, -1)
      expect(result).toHaveLength(2)
      expect(result).toEqual(mockSnapshots)
    })
  })

  describe('saveSnapshot', () => {
    it('saves snapshot to KV store', async () => {
      const snapshot: SnapshotMeta = {
        id: '123',
        slug: 'google',
        url: 'https://google.com/privacy',
        capturedAt: '2025-06-20T10:00:00Z',
        blobKey: 'snapshots/google/123.html',
        contentHash: 'a'.repeat(64),
        contentLength: 1000,
        contentType: 'html',
        headers: {},
        status: 'processed'
      }

      const { kv } = await import('@vercel/kv')
      
      await storage.saveSnapshot(snapshot)
      
      expect(kv.set).toHaveBeenCalledWith('snapshot:google:123', snapshot)
      expect(kv.zadd).toHaveBeenCalledWith('snapshots:google', {
        score: new Date(snapshot.capturedAt).getTime(),
        member: 'snapshot:google:123'
      })
    })
  })
})