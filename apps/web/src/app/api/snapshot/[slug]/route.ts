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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const end = PerformanceMonitor.startMeasure('api:snapshot:get');
  
  try {
    const { slug } = await params
    
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
          id: 'mock-snapshot-1',
          capturedAt: new Date().toISOString(),
          url: `https://example.com/${slug}/privacy`,
          contentHash: 'mock-hash-12345'
        },
        content: {
          text: `This is a mock privacy policy snapshot for ${slug}. In production with proper storage configuration, this would contain the actual privacy policy content.\n\nStorage Configuration Required:\n- KV_REST_API_URL: Vercel KV store URL\n- KV_REST_API_TOKEN: Vercel KV authentication token\n\nThe snapshot API captures and stores privacy policy content for tracking changes over time.`,
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
        { error: 'No snapshots found for this policy' },
        { status: 404 }
      )
    }
    
    // Get the snapshot content
    const content = await storageClient.getSnapshotContent(snapshot.blobKey)
    
    if (!content) {
      return NextResponse.json(
        { error: 'Snapshot content not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      snapshot: {
        id: snapshot.id,
        capturedAt: snapshot.capturedAt,
        url: snapshot.url,
        contentHash: snapshot.contentHash
      },
      content: {
        text: content,
        wordCount: content.split(/\s+/).length,
        characterCount: content.length
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Snapshot fetch error:', error)
    
    // Provide more detailed error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isStorageError = errorMessage.includes('KV') || errorMessage.includes('storage')
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch snapshot',
        message: isStorageError 
          ? 'Storage service is not configured. Please set up KV_REST_API_URL and KV_REST_API_TOKEN environment variables.'
          : errorMessage,
        code: isStorageError ? 'STORAGE_NOT_CONFIGURED' : 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  } finally {
    end()
  }
}