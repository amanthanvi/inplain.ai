import { NextRequest, NextResponse } from 'next/server'
import { StorageClient } from '../../lib/storage'
import { getClerkAuth } from '@/lib/auth-clerk'
import { isDemoMode } from '@/lib/env'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

// Initialize storage client
const storage = new StorageClient()

// Get company by slug from shared data
const getCompanyBySlug = (slug: string) => {
  return WATCHED_COMPANIES.find(c => c.slug === slug) || null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  let slug: string = 'unknown'
  
  try {
    const resolvedParams = await params
    slug = resolvedParams.slug
    
    // Log request for debugging
    console.log('Snapshot API called', { slug })
    
    // Check authentication (skip in demo mode)
    if (!isDemoMode()) {
      const auth = await getClerkAuth()
      if (!auth?.userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }
    
    // Validate company exists
    const company = getCompanyBySlug(slug)
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }
    
    try {
      // Get the latest snapshot for this company
      const snapshots = await storage.getLatestSnapshots(slug, 1)
      const latestSnapshot = snapshots[0]
      
      if (!latestSnapshot) {
        // Return a meaningful response even if no snapshot exists yet
        return NextResponse.json({
          snapshot: null,
          content: null,
          message: 'No policy snapshots available yet. Check back later.'
        }, {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
          }
        })
      }
      
      // Get the content from blob storage if available
      let content = null
      if (latestSnapshot.blobKey) {
        try {
          const blob = await storage.getSnapshotContent(latestSnapshot.blobKey)
          if (blob) {
            content = blob
          }
        } catch (contentError) {
          console.warn('Failed to fetch blob content', { 
            error: contentError instanceof Error ? contentError.message : 'Unknown error',
            blobKey: latestSnapshot.blobKey 
          })
        }
      }
      
      // Return snapshot data with content in the expected format
      return NextResponse.json({
        snapshot: {
          id: latestSnapshot.id,
          capturedAt: latestSnapshot.capturedAt,
          url: latestSnapshot.url,
          contentHash: latestSnapshot.contentHash
        },
        content: content ? {
          text: content,
          wordCount: content.split(/\s+/).length,
          characterCount: content.length
        } : {
          text: 'Policy content is being processed. Please check back in a few moments.',
          wordCount: 0,
          characterCount: 0
        }
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
      })
      
    } catch (storageError) {
      // If storage fails, return mock data in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('Storage error in development, returning mock data', { 
          error: storageError instanceof Error ? storageError.message : 'Unknown error' 
        })
        
        const mockText = `This is mock privacy policy content for ${company.name}. In production, this would contain the actual privacy policy text scraped from ${company.url}.`
        return NextResponse.json({
          snapshot: {
            id: `mock-${slug}-${Date.now()}`,
            capturedAt: new Date().toISOString(),
            url: company.url,
            contentHash: 'mock-hash-' + slug
          },
          content: {
            text: mockText,
            wordCount: mockText.split(/\s+/).length,
            characterCount: mockText.length
          }
        }, {
          headers: {
            'Cache-Control': 'no-store'
          }
        })
      }
      
      throw storageError
    }
    
  } catch (error) {
    console.error('Snapshot API error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      slug
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch snapshot',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}