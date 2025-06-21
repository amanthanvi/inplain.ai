import { NextRequest, NextResponse } from 'next/server'
import { StorageClient } from '../lib/storage'
// Static companies data - in production this would come from database
const getCompanies = () => Promise.resolve([
  { slug: 'google', name: 'Google', url: 'https://policies.google.com/privacy', active: true, checkInterval: 86400 },
  { slug: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/privacy/policy', active: true, checkInterval: 86400 },
  { slug: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496', active: true, checkInterval: 86400 },
  { slug: 'microsoft', name: 'Microsoft', url: 'https://privacy.microsoft.com/en-us/privacystatement', active: true, checkInterval: 86400 },
  { slug: 'apple', name: 'Apple', url: 'https://www.apple.com/legal/privacy/', active: true, checkInterval: 86400 }
])

const storage = new StorageClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    // Get all companies and fetch their latest diffs
    const companies = await getCompanies()
    const recentDiffs = []
    
    for (const company of companies) {
      try {
        const diffs = await storage.getLatestDiffs(company.slug, 1)
        if (diffs.length > 0) {
          recentDiffs.push({
            diff: diffs[0],
            company
          })
        }
      } catch (error) {
        console.warn(`Failed to fetch diffs for ${company.slug}:`, error)
        // Continue with other companies
      }
    }
    
    // Sort by creation date and limit results
    const sortedDiffs = recentDiffs
      .filter((item): item is { diff: NonNullable<typeof item.diff>; company: typeof item.company } => 
        Boolean(item.diff && item.diff.createdAt)
      )
      .sort((a, b) => new Date(b.diff.createdAt).getTime() - new Date(a.diff.createdAt).getTime())
      .slice(0, limit)
    
    return NextResponse.json({
      diffs: sortedDiffs
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Recent diffs fetch error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}