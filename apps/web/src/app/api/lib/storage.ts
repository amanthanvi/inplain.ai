import { kv } from './kv-wrapper'
import type { SnapshotMeta, DiffMeta, Summary } from '@inplain.ai/shared'

export class StorageClient {
  async getSnapshot(slug: string, snapshotId: string): Promise<SnapshotMeta | null> {
    return kv.get<SnapshotMeta>(`snapshot:${slug}:${snapshotId}`)
  }

  async getLatestSnapshots(slug: string, limit = 2): Promise<SnapshotMeta[]> {
    const keys = await kv.zrange<string>(`snapshots:${slug}`, -limit, -1)
    if (!keys.length) return []
    
    const snapshots = await Promise.all(
      keys.map(key => kv.get<SnapshotMeta>(key))
    )
    
    return snapshots.filter(Boolean) as SnapshotMeta[]
  }

  async saveSnapshot(snapshot: SnapshotMeta): Promise<void> {
    const key = `snapshot:${snapshot.slug}:${snapshot.id}`
    await kv.set(key, snapshot)
    await kv.zadd(`snapshots:${snapshot.slug}`, {
      score: new Date(snapshot.capturedAt).getTime(),
      member: key
    })
  }

  async getSnapshotContent(blobKey: string): Promise<string | null> {
    try {
      // If it's a KV key (starts with 'content:'), fetch from KV
      if (blobKey.startsWith('content:')) {
        const content = await kv.get<string>(blobKey)
        return content
      }
      
      // Otherwise try to fetch from blob URL (legacy)
      const response = await fetch(blobKey)
      if (!response.ok) return null
      return response.text()
    } catch {
      return null
    }
  }

  async saveDiff(diff: DiffMeta): Promise<void> {
    const key = `diff:${diff.slug}:${diff.id}`
    await kv.set(key, diff)
    await kv.zadd(`diffs:${diff.slug}`, {
      score: new Date(diff.createdAt).getTime(),
      member: key
    })
  }

  async getDiff(slug: string, diffId: string): Promise<DiffMeta | null> {
    return kv.get<DiffMeta>(`diff:${slug}:${diffId}`)
  }

  async getLatestDiffs(slug: string, limit = 10): Promise<DiffMeta[]> {
    const keys = await kv.zrange<string>(`diffs:${slug}`, -limit, -1)
    if (!keys.length) return []
    
    const diffs = await Promise.all(
      keys.map(key => kv.get<DiffMeta>(key))
    )
    
    return diffs.filter(Boolean).reverse() as DiffMeta[]
  }

  async getSummary(summaryId: string): Promise<Summary | null> {
    return kv.get<Summary>(`summary:${summaryId}`)
  }

  async saveSummary(summary: Summary): Promise<void> {
    await kv.set(`summary:${summary.id}`, summary, {
      ex: 86400 * 30 // 30 days cache
    })
  }

  async getDiffContent(blobKey: string): Promise<any | null> {
    try {
      // If it's a KV key, fetch from KV
      if (blobKey.includes('diff-content:') || !blobKey.startsWith('http')) {
        const kvKey = blobKey.replace('diffs/', 'diff-content:')
        return await kv.get(kvKey)
      }
      
      // Otherwise try to fetch from blob URL (legacy)
      const response = await fetch(blobKey)
      if (!response.ok) return null
      const text = await response.text()
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  async saveDiffContent(blobKey: string, content: any): Promise<void> {
    // Store diff content in KV instead of blob
    const kvKey = blobKey.replace('diffs/', 'diff-content:')
    await kv.set(kvKey, content, { ex: 30 * 24 * 60 * 60 }) // 30 days TTL
  }

  async getCachedAnalysis(key: string): Promise<any | null> {
    return kv.get(key)
  }

  async setCachedAnalysis(key: string, analysis: any, ttl: number): Promise<void> {
    await kv.set(key, analysis, { ex: ttl })
  }
}

export const storageClient = new StorageClient()