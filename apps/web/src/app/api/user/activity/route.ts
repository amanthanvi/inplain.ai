import { NextRequest, NextResponse } from 'next/server'
import { getClerkAuth } from '@/lib/auth-clerk'
import { StorageClient } from '../../lib/storage'

const storage = new StorageClient()

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getClerkAuth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get user's watchlist first
    const watchlistResponse = await fetch(`${request.nextUrl.origin}/api/user/watchlist`, {
      headers: request.headers
    })
    
    if (!watchlistResponse.ok) {
      throw new Error('Failed to fetch watchlist')
    }
    
    const { watchlist } = await watchlistResponse.json()
    
    // Collect activity from all watched companies
    const activities: any[] = []
    
    for (const company of watchlist) {
      try {
        // Get recent diffs for this company
        const diffs = await storage.getLatestDiffs(company.slug, 5)
        
        for (const diff of diffs) {
          const changeCount = (diff.additions || 0) + (diff.deletions || 0)
          const changeType = changeCount > 100 ? 'major' : changeCount > 50 ? 'moderate' : 'minor'
          const impact = changeCount > 100 ? 'high' : changeCount > 50 ? 'medium' : 'low'
          
          activities.push({
            id: diff.id,
            date: new Date(diff.createdAt),
            type: changeType,
            title: `${company.name} updated privacy policy`,
            description: `${changeCount} changes detected (${diff.additions || 0} additions, ${diff.deletions || 0} deletions)`,
            impact,
            tags: [company.name, 'Policy Update'],
            companySlug: company.slug,
            diffId: diff.id,
            metadata: {
              additions: diff.additions,
              deletions: diff.deletions
            }
          })
        }
      } catch (error) {
        console.error(`Failed to fetch activity for ${company.slug}:`, error)
      }
    }
    
    // Sort by date (most recent first)
    activities.sort((a, b) => b.date.getTime() - a.date.getTime())
    
    // Limit to most recent 20 activities
    const recentActivities = activities.slice(0, 20)
    
    // If no real activities, provide some helpful onboarding content
    if (recentActivities.length === 0) {
      recentActivities.push({
        id: 'welcome',
        date: new Date(),
        type: 'info',
        title: 'Welcome to Inplain.AI!',
        description: 'Your watchlist is being monitored. You\'ll see updates here when policies change.',
        impact: 'low',
        tags: ['Getting Started'],
        isOnboarding: true
      })
    }
    
    return NextResponse.json({
      activities: recentActivities,
      total: recentActivities.length,
      watchlistCount: watchlist.length
    })
  } catch (error) {
    console.error('Activity fetch error:', error)
    
    // Return error instead of mock data
    return NextResponse.json(
      { 
        error: 'Failed to fetch activities',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}