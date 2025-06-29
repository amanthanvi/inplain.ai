import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import type { NotificationSubscription } from '@/lib/notifications/notification-service'

export const runtime = 'edge'

// GET /api/notifications/subscriptions - Get user subscriptions
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all company slugs the user is subscribed to
    const subscribedCompanies = await kv.smembers(`notifications:subscriptions:${userId}`) as string[]
    
    if (!subscribedCompanies || subscribedCompanies.length === 0) {
      return NextResponse.json({ subscriptions: [] })
    }

    // Get subscription details for each company
    const subscriptions: NotificationSubscription[] = []
    for (const companySlug of subscribedCompanies) {
      const subscription = await kv.get(`notifications:subscription:${userId}:${companySlug}`) as NotificationSubscription | null
      if (subscription) {
        subscriptions.push(subscription)
      }
    }

    return NextResponse.json({ subscriptions })
  } catch (error) {
    console.error('Failed to get subscriptions:', error)
    return NextResponse.json(
      { error: 'Failed to get subscriptions' },
      { status: 500 }
    )
  }
}

// POST /api/notifications/subscriptions - Subscribe to company notifications
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { companySlug, companyName, types, severity, channels } = body

    if (!companySlug) {
      return NextResponse.json(
        { error: 'Company slug is required' },
        { status: 400 }
      )
    }

    const subscription: NotificationSubscription = {
      companySlug,
      companyName: companyName || companySlug,
      types: types || ['policy-change', 'risk-alert'],
      severity: severity || ['critical', 'warning'],
      channels: channels || ['in-app']
    }

    // Save subscription
    const pipeline = kv.pipeline()
    pipeline.sadd(`notifications:subscriptions:${userId}`, companySlug)
    pipeline.set(`notifications:subscription:${userId}:${companySlug}`, subscription)
    
    // Add user to company watchers
    pipeline.sadd(`company:${companySlug}:watchers`, userId)
    
    await pipeline.exec()

    return NextResponse.json({ 
      success: true, 
      subscription 
    })
  } catch (error) {
    console.error('Failed to create subscription:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}

// DELETE /api/notifications/subscriptions - Unsubscribe from company notifications
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companySlug = searchParams.get('companySlug')

    if (!companySlug) {
      return NextResponse.json(
        { error: 'Company slug is required' },
        { status: 400 }
      )
    }

    // Remove subscription
    const pipeline = kv.pipeline()
    pipeline.srem(`notifications:subscriptions:${userId}`, companySlug)
    pipeline.del(`notifications:subscription:${userId}:${companySlug}`)
    
    // Remove user from company watchers
    pipeline.srem(`company:${companySlug}:watchers`, userId)
    
    await pipeline.exec()

    return NextResponse.json({ 
      success: true, 
      message: `Unsubscribed from ${companySlug} notifications` 
    })
  } catch (error) {
    console.error('Failed to unsubscribe:', error)
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    )
  }
}