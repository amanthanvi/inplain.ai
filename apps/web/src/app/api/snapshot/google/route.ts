import { NextRequest, NextResponse } from 'next/server'
import { OptimizedStorageClient } from '../../lib/storage-optimized'
import { PerformanceMonitor } from '@/lib/performance'
import { getEnvVar } from '@/lib/env'
import { getClerkAuth } from '@/lib/auth-clerk'
import { isDevAuthEnabled } from '@/lib/dev-auth'

// Initialize storage with error handling
let storage: OptimizedStorageClient | null = null

function getStorage(): OptimizedStorageClient | null {
  if (storage) return storage
  
  // Check if KV is configured
  const kvUrl = getEnvVar('KV_REST_API_URL')
  const kvToken = getEnvVar('KV_REST_API_TOKEN')
  
  if (!kvUrl || !kvToken) {
    console.warn('KV storage not configured - snapshot API will return mock data')
    return null
  }
  
  try {
    storage = new OptimizedStorageClient()
    return storage
  } catch (error) {
    console.error('Failed to initialize storage client:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  const end = PerformanceMonitor.startMeasure('api:snapshot:google:get');
  
  try {
    const slug = 'google' // Hardcoded for this specific route
    
    // Check authentication in production (skip in dev with auth bypass)
    if (process.env.NODE_ENV === 'production' && !isDevAuthEnabled()) {
      const { userId } = await getClerkAuth()
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }
    
    // Get storage client
    const storageClient = getStorage()
    
    // If storage is not configured, return mock data
    if (!storageClient) {
      const mockSnapshot = {
        snapshot: {
          id: 'mock-snapshot-google-1',
          capturedAt: new Date().toISOString(),
          url: 'https://policies.google.com/privacy',
          contentHash: 'mock-hash-google-12345'
        },
        content: {
          text: `This is a mock privacy policy snapshot for Google. In production with proper storage configuration, this would contain the actual privacy policy content.\n\nStorage Configuration Required:\n- KV_REST_API_URL: Vercel KV store URL\n- KV_REST_API_TOKEN: Vercel KV authentication token\n\nThe snapshot API captures and stores privacy policy content for tracking changes over time.`,
          wordCount: 42,
          characterCount: 328
        },
        _mock: true
      }
      
      return NextResponse.json(mockSnapshot, {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
          'X-Mock-Data': 'true'
        }
      })
    }
    
    // Get the latest snapshot
    const snapshots = await PerformanceMonitor.measure(
      'storage:getLatestSnapshots',
      () => storageClient.getLatestSnapshots(slug, 1)
    )
    
    if (snapshots.length === 0) {
      return NextResponse.json(
        { error: 'No snapshots found for this policy' },
        { status: 404 }
      )
    }

    const snapshot = snapshots[0]
    if (!snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      )
    }
    
    // Get the content from blob storage
    const content = await PerformanceMonitor.measure(
      'storage:getSnapshotContent', 
      () => storageClient.getSnapshotContent(snapshot.blobKey)
    )
    
    if (!content) {
      return NextResponse.json(
        { error: 'Snapshot content not found' },
        { status: 404 }
      )
    }

    // Extract basic statistics
    const wordCount = content.split(/\s+/).length
    const characterCount = content.length

    const response = {
      snapshot: {
        id: snapshot.id,
        capturedAt: snapshot.capturedAt,
        url: snapshot.url,
        contentHash: snapshot.contentHash
      },
      content: {
        text: content,
        wordCount,
        characterCount
      }
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Snapshot API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch snapshot', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  } finally {
    end()
  }
}