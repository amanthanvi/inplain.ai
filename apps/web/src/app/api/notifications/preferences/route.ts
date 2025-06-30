import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { kv } from '@/app/api/lib/kv-wrapper'
import type { NotificationPreferences } from '@/lib/notifications/notification-service'

export const runtime = 'edge'

// Default preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
  enableSound: true,
  enableDesktop: true,
  enableToast: true,
  enableEmail: false,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00'
  },
  subscriptions: []
}

// GET /api/notifications/preferences - Get user notification preferences
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get preferences from KV store
    const preferences = await kv.get(`notifications:${userId}:preferences`) as NotificationPreferences | null

    if (!preferences) {
      // Return default preferences
      return NextResponse.json(DEFAULT_PREFERENCES)
    }

    return NextResponse.json(preferences)
  } catch (error) {
    console.error('Failed to get notification preferences:', error)
    return NextResponse.json(
      { error: 'Failed to get notification preferences' },
      { status: 500 }
    )
  }
}

// POST /api/notifications/preferences - Update user notification preferences
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { preferences } = body as { preferences: Partial<NotificationPreferences> }

    if (!preferences) {
      return NextResponse.json(
        { error: 'Invalid preferences data' },
        { status: 400 }
      )
    }

    // Get existing preferences
    const existingPreferences = await kv.get(`notifications:${userId}:preferences`) as NotificationPreferences | null
    
    // Merge with existing preferences
    const updatedPreferences: NotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      ...existingPreferences,
      ...preferences
    }

    // Validate preferences
    if (updatedPreferences.quietHours.enabled) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
      if (!timeRegex.test(updatedPreferences.quietHours.start) || 
          !timeRegex.test(updatedPreferences.quietHours.end)) {
        return NextResponse.json(
          { error: 'Invalid quiet hours format' },
          { status: 400 }
        )
      }
    }

    // Save preferences
    await kv.set(`notifications:${userId}:preferences`, updatedPreferences)

    // Update subscription indices for efficient querying
    if (preferences.subscriptions) {
      const pipeline = kv.pipeline()
      
      // Clear existing subscription indices
      pipeline.del(`notifications:subscriptions:${userId}`)
      
      // Add updated subscriptions
      for (const sub of preferences.subscriptions) {
        pipeline.sadd(`notifications:subscriptions:${userId}`, sub.companySlug)
        pipeline.set(`notifications:subscription:${userId}:${sub.companySlug}`, sub)
      }
      
      await pipeline.exec()
    }

    return NextResponse.json({ 
      success: true, 
      preferences: updatedPreferences 
    })
  } catch (error) {
    console.error('Failed to update notification preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    )
  }
}