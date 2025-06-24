import { NextRequest, NextResponse } from 'next/server'
import { StorageClient } from '../../lib/storage'
import { getClerkAuth } from '@/lib/auth-clerk'
import { isDemoMode } from '@/lib/env'
import { Company } from '@inplain.ai/shared'

// Initialize storage client
const storage = new StorageClient()

// Static company data - in production this would come from database
const getCompanyBySlug = (slug: string): Company | null => {
  const companies: Company[] = [
    { slug: 'google', name: 'Google', url: 'https://policies.google.com/privacy', active: true, checkInterval: 86400 },
    { slug: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/privacy/policy', active: true, checkInterval: 86400 },
    { slug: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496', active: true, checkInterval: 86400 },
    { slug: 'microsoft', name: 'Microsoft', url: 'https://privacy.microsoft.com/en-us/privacystatement', active: true, checkInterval: 86400 },
    { slug: 'apple', name: 'Apple', url: 'https://www.apple.com/legal/privacy/', active: true, checkInterval: 86400 }
  ]
  
  return companies.find(c => c.slug === slug) || null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    
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
      const latestSnapshot = await storage.getLatestSnapshot(slug)
      
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
          const blob = await storage.getBlob(latestSnapshot.blobKey)
          if (blob) {
            content = {
              text: blob,
              wordCount: blob.split(/\s+/).length,
              characterCount: blob.length
            }
          }
        } catch (contentError) {
          console.warn('Failed to fetch blob content', { 
            error: contentError instanceof Error ? contentError.message : 'Unknown error',
            blobKey: latestSnapshot.blobKey 
          })
        }
      }
      
      // Return snapshot data with content
      return NextResponse.json({
        snapshot: {
          id: latestSnapshot.id,
          capturedAt: latestSnapshot.capturedAt,
          url: latestSnapshot.url,
          contentHash: latestSnapshot.contentHash
        },
        content: content || {
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
        
        return NextResponse.json({
          snapshot: {
            id: `mock-${slug}-${Date.now()}`,
            capturedAt: new Date().toISOString(),
            url: company.url,
            contentHash: 'mock-hash-' + slug
          },
          content: {
            text: `This is mock privacy policy content for ${company.name}. In production, this would contain the actual privacy policy text scraped from ${company.url}.`,
            wordCount: 15,
            characterCount: 120
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