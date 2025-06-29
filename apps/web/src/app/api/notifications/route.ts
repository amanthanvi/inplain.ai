import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'
import type { Notification } from '@/components/notifications/NotificationCenter'

export const runtime = 'edge'

// Maximum notifications to store per user
const MAX_NOTIFICATIONS_PER_USER = 100

// GET /api/notifications - Get user notifications
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const unreadOnly = searchParams.get('unread') === 'true'

    // Get all notifications for the user
    const notificationIds = await kv.lrange(`notifications:${userId}:list`, 0, -1) as string[]
    
    if (!notificationIds || notificationIds.length === 0) {
      return NextResponse.json({ notifications: [], total: 0 })
    }

    // Get notification details
    const notifications: Notification[] = []
    for (const id of notificationIds) {
      const notification = await kv.get(`notifications:${userId}:${id}`) as Notification | null
      if (notification) {
        if (!unreadOnly || !notification.read) {
          notifications.push(notification)
        }
      }
    }

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // Apply pagination
    const paginatedNotifications = notifications.slice(offset, offset + limit)

    return NextResponse.json({
      notifications: paginatedNotifications,
      total: notifications.length,
      unreadCount: notifications.filter(n => !n.read).length
    })
  } catch (error) {
    console.error('Failed to get notifications:', error)
    return NextResponse.json(
      { error: 'Failed to get notifications' },
      { status: 500 }
    )
  }
}

// POST /api/notifications - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notification } = body as { notification: Notification }

    if (!notification) {
      return NextResponse.json(
        { error: 'Invalid notification data' },
        { status: 400 }
      )
    }

    // Store notification
    const notificationKey = `notifications:${userId}:${notification.id}`
    await kv.set(notificationKey, notification, { ex: 30 * 24 * 60 * 60 }) // 30 days TTL

    // Add to user's notification list
    const listKey = `notifications:${userId}:list`
    await kv.lpush(listKey, notification.id)

    // Trim list to max size
    await kv.ltrim(listKey, 0, MAX_NOTIFICATIONS_PER_USER - 1)

    // Update unread count
    const unreadKey = `notifications:${userId}:unread`
    if (!notification.read) {
      await kv.incr(unreadKey)
    }

    // Queue for real-time delivery
    await kv.lpush(`notifications:${userId}:queue`, JSON.stringify(notification))

    return NextResponse.json({ success: true, notification })
  } catch (error) {
    console.error('Failed to create notification:', error)
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}

// PATCH /api/notifications - Update notifications (mark as read, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, notificationIds } = body as {
      action: 'markAsRead' | 'markAsUnread' | 'delete'
      notificationIds: string[]
    }

    if (!action || !notificationIds || notificationIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    let updatedCount = 0
    const unreadKey = `notifications:${userId}:unread`

    for (const id of notificationIds) {
      const notificationKey = `notifications:${userId}:${id}`
      const notification = await kv.get(notificationKey) as Notification | null

      if (!notification) continue

      switch (action) {
        case 'markAsRead':
          if (!notification.read) {
            notification.read = true
            await kv.set(notificationKey, notification, { ex: 30 * 24 * 60 * 60 })
            await kv.decr(unreadKey)
            updatedCount++
          }
          break

        case 'markAsUnread':
          if (notification.read) {
            notification.read = false
            await kv.set(notificationKey, notification, { ex: 30 * 24 * 60 * 60 })
            await kv.incr(unreadKey)
            updatedCount++
          }
          break

        case 'delete':
          await kv.del(notificationKey)
          await kv.lrem(`notifications:${userId}:list`, 0, id)
          if (!notification.read) {
            await kv.decr(unreadKey)
          }
          updatedCount++
          break
      }
    }

    return NextResponse.json({ 
      success: true, 
      updatedCount,
      action 
    })
  } catch (error) {
    console.error('Failed to update notifications:', error)
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}

// DELETE /api/notifications - Delete all notifications
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all notification IDs
    const notificationIds = await kv.lrange(`notifications:${userId}:list`, 0, -1) as string[]

    // Delete all notifications
    const pipeline = kv.pipeline()
    for (const id of notificationIds) {
      pipeline.del(`notifications:${userId}:${id}`)
    }
    
    // Clear the list and unread count
    pipeline.del(`notifications:${userId}:list`)
    pipeline.del(`notifications:${userId}:unread`)
    pipeline.del(`notifications:${userId}:queue`)

    await pipeline.exec()

    return NextResponse.json({ 
      success: true, 
      deletedCount: notificationIds.length 
    })
  } catch (error) {
    console.error('Failed to delete notifications:', error)
    return NextResponse.json(
      { error: 'Failed to delete notifications' },
      { status: 500 }
    )
  }
}