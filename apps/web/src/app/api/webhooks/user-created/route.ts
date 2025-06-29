import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { EmailService } from '@/lib/email'
import { kv } from '@vercel/kv'
import { queueWelcomeEmail } from '@/app/api/cron/notifications/route'

export const runtime = 'nodejs'

/**
 * Webhook handler for user creation events
 * Automatically queues welcome emails for new users
 */
export async function POST(request: NextRequest) {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
    
    if (!WEBHOOK_SECRET) {
      console.error('Missing CLERK_WEBHOOK_SECRET')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Get headers
    const headerPayload = await headers()
    const svix_id = headerPayload.get('svix-id')
    const svix_timestamp = headerPayload.get('svix-timestamp')
    const svix_signature = headerPayload.get('svix-signature')

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
    }

    // Get payload
    const payload = await request.json()
    const body = JSON.stringify(payload)

    // Verify webhook
    const webhook = new Webhook(WEBHOOK_SECRET)
    let event: any

    try {
      event = webhook.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      })
    } catch (err) {
      console.error('Webhook verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Handle user.created event
    if (event.type === 'user.created') {
      const user = event.data

      // Extract user information
      const userId = user.id
      const email = user.email_addresses?.[0]?.email_address
      const firstName = user.first_name
      const lastName = user.last_name
      const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || email?.split('@')[0] || 'User'

      if (!userId || !email) {
        console.error('Missing required user data:', { userId, email })
        return NextResponse.json({ error: 'Invalid user data' }, { status: 400 })
      }

      // Store user data in KV for easy access
      const userData = {
        id: userId,
        email,
        name,
        firstName,
        lastName,
        avatar: user.image_url,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        plan: 'free'
      }

      await kv.set(`user:${userId}`, userData, { ex: 86400 * 365 }) // Store for 1 year

      // Initialize default email preferences
      const defaultPreferences = {
        policyChanges: true,
        weeklyDigest: true,
        monthlyDigest: false,
        criticalAlerts: true,
        productUpdates: true,
        frequency: 'immediate' as const,
        unsubscribed: false
      }

      await EmailService.updateEmailPreferences(userId, defaultPreferences)

      // Initialize user settings
      const defaultSettings = {
        timezone: 'UTC',
        language: 'en',
        dateFormat: 'MM/dd/yyyy',
        theme: 'system'
      }

      await kv.set(`user:settings:${userId}`, defaultSettings)

      // Queue welcome email (with a small delay to ensure user setup is complete)
      await queueWelcomeEmail(userId)

      // Track user registration for analytics
      await trackUserRegistration(userId, email, user)

      console.log(`User created and welcome email queued for: ${email}`)

      return NextResponse.json({ 
        success: true, 
        message: 'User processed and welcome email queued' 
      })
    }

    // Handle user.updated event (in case email changes)
    if (event.type === 'user.updated') {
      const user = event.data
      const userId = user.id
      const email = user.email_addresses?.[0]?.email_address

      if (userId && email) {
        // Update stored user data
        const existingUser = await kv.get(`user:${userId}`) as any
        if (existingUser) {
          const updatedUser = {
            ...existingUser,
            email,
            name: user.first_name && user.last_name 
              ? `${user.first_name} ${user.last_name}` 
              : user.first_name || email.split('@')[0] || 'User',
            firstName: user.first_name,
            lastName: user.last_name,
            avatar: user.image_url,
            updatedAt: new Date().toISOString()
          }

          await kv.set(`user:${userId}`, updatedUser, { ex: 86400 * 365 })
        }
      }

      return NextResponse.json({ success: true, message: 'User updated' })
    }

    // Handle user.deleted event
    if (event.type === 'user.deleted') {
      const userId = event.data.id

      if (userId) {
        // Clean up user data
        await cleanupUserData(userId)
        console.log(`User data cleaned up for: ${userId}`)
      }

      return NextResponse.json({ success: true, message: 'User data cleaned up' })
    }

    console.log(`Unhandled webhook event type: ${event.type}`)
    return NextResponse.json({ success: true, message: 'Event received' })

  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Track user registration for analytics
 */
async function trackUserRegistration(userId: string, email: string, userData: any): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Increment daily registration count
    await kv.incr(`analytics:registrations:${today}`)
    
    // Store registration event
    const registrationEvent = {
      userId,
      email,
      timestamp: new Date().toISOString(),
      source: 'clerk_webhook',
      userAgent: '', // Not available in webhook
      utm: {}, // Could extract from user metadata if available
      plan: 'free'
    }

    await kv.lpush('analytics:registrations:events', registrationEvent)
    
    // Keep only last 10000 registration events
    await kv.ltrim('analytics:registrations:events', 0, 9999)

    // Track by referrer if available
    if (userData.public_metadata?.referrer) {
      await kv.incr(`analytics:registrations:referrer:${userData.public_metadata.referrer}:${today}`)
    }

  } catch (error) {
    console.error('Failed to track user registration:', error)
  }
}

/**
 * Clean up all user data when user is deleted
 */
async function cleanupUserData(userId: string): Promise<void> {
  try {
    // List of data patterns to clean up
    const cleanupPatterns = [
      `user:${userId}`,
      `user:settings:${userId}`,
      `email:preferences:${userId}`,
      `notifications:${userId}:*`,
      `preference:changes:${userId}`,
      `user:activity:${userId}`,
      `analytics:*:${userId}`,
      `email:digest:${userId}:*`,
      `welcome-email:sent:${userId}`
    ]

    // Clean up direct keys
    const pipeline = kv.pipeline()
    
    for (const pattern of cleanupPatterns) {
      if (pattern.includes('*')) {
        // Handle wildcard patterns
        const keys = await kv.keys(pattern)
        for (const key of keys) {
          pipeline.del(key)
        }
      } else {
        pipeline.del(pattern)
      }
    }

    // Remove from welcome email queue if present
    pipeline.lrem('welcome-email:queue', 0, userId)

    await pipeline.exec()

    // Log cleanup for audit
    await kv.lpush('user:cleanup:log', {
      userId,
      timestamp: new Date().toISOString(),
      action: 'user_deleted_cleanup'
    })

  } catch (error) {
    console.error('Failed to cleanup user data:', error)
  }
}

// Helper function to manually trigger welcome email (for testing)
export async function triggerWelcomeEmail(userId: string): Promise<boolean> {
  try {
    const user = await kv.get(`user:${userId}`) as any
    if (!user) {
      console.error(`User not found: ${userId}`)
      return false
    }

    return await EmailService.sendWelcomeEmail(user)
  } catch (error) {
    console.error('Failed to trigger welcome email:', error)
    return false
  }
}