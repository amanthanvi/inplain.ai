import { NextRequest, NextResponse } from 'next/server'
import { getClerkAuth } from '@/lib/auth-clerk'
import { z } from 'zod'

// Schema for watchlist items
const watchlistItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  url: z.string().url(),
  addedAt: z.string().datetime(),
  lastChecked: z.string().datetime().optional(),
  changeCount: z.number().default(0),
  riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  notifications: z.boolean().default(true)
})

// Mock storage - In production, this would use a database
const userWatchlists = new Map<string, any[]>()

// Default companies to suggest
const defaultCompanies = [
  {
    slug: 'google',
    name: 'Google',
    url: 'https://policies.google.com/privacy'
  },
  {
    slug: 'facebook',
    name: 'Facebook',
    url: 'https://www.facebook.com/privacy/policy'
  },
  {
    slug: 'amazon',
    name: 'Amazon',
    url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496'
  },
  {
    slug: 'microsoft',
    name: 'Microsoft',
    url: 'https://privacy.microsoft.com/en-us/privacystatement'
  },
  {
    slug: 'apple',
    name: 'Apple',
    url: 'https://www.apple.com/legal/privacy/'
  }
]

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getClerkAuth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get user's watchlist from storage
    let watchlist = userWatchlists.get(userId)
    
    // If user has no watchlist, create a default one
    if (!watchlist || watchlist.length === 0) {
      watchlist = defaultCompanies.slice(0, 3).map(company => ({
        ...company,
        addedAt: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
        changeCount: Math.floor(Math.random() * 5),
        riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        notifications: true
      }))
      userWatchlists.set(userId, watchlist)
    }
    
    return NextResponse.json({
      watchlist,
      total: watchlist.length,
      limit: 10 // Free tier limit
    })
  } catch (error) {
    console.error('Watchlist fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch watchlist' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getClerkAuth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { slug } = body
    
    if (!slug) {
      return NextResponse.json(
        { error: 'Company slug is required' },
        { status: 400 }
      )
    }
    
    // Get user's current watchlist
    const watchlist = userWatchlists.get(userId) || []
    
    // Check if already in watchlist
    if (watchlist.some(item => item.slug === slug)) {
      return NextResponse.json(
        { error: 'Company already in watchlist' },
        { status: 409 }
      )
    }
    
    // Check watchlist limit
    if (watchlist.length >= 10) {
      return NextResponse.json(
        { error: 'Watchlist limit reached. Upgrade to Pro for unlimited tracking.' },
        { status: 403 }
      )
    }
    
    // Find company details
    const company = defaultCompanies.find(c => c.slug === slug) || {
      slug,
      name: slug.charAt(0).toUpperCase() + slug.slice(1),
      url: `https://${slug}.com/privacy`
    }
    
    // Add to watchlist
    const newItem = {
      ...company,
      addedAt: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
      changeCount: 0,
      riskLevel: 'medium',
      notifications: true
    }
    
    watchlist.push(newItem)
    userWatchlists.set(userId, watchlist)
    
    return NextResponse.json({
      item: newItem,
      watchlist,
      total: watchlist.length
    })
  } catch (error) {
    console.error('Watchlist add error:', error)
    return NextResponse.json(
      { error: 'Failed to add to watchlist' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await getClerkAuth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    
    if (!slug) {
      return NextResponse.json(
        { error: 'Company slug is required' },
        { status: 400 }
      )
    }
    
    // Get user's current watchlist
    const watchlist = userWatchlists.get(userId) || []
    
    // Remove from watchlist
    const updatedWatchlist = watchlist.filter(item => item.slug !== slug)
    userWatchlists.set(userId, updatedWatchlist)
    
    return NextResponse.json({
      removed: slug,
      watchlist: updatedWatchlist,
      total: updatedWatchlist.length
    })
  } catch (error) {
    console.error('Watchlist remove error:', error)
    return NextResponse.json(
      { error: 'Failed to remove from watchlist' },
      { status: 500 }
    )
  }
}