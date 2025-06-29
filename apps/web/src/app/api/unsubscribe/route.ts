import { NextRequest, NextResponse } from 'next/server'
import { EmailService } from '@/lib/email'
import { kv } from '@vercel/kv'

export const runtime = 'edge'

/**
 * Unsubscribe API
 * Handles one-click unsubscribe functionality
 */

// GET /api/unsubscribe?token=... - Process unsubscribe via URL
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Missing unsubscribe token' },
        { status: 400 }
      )
    }

    // Validate and process unsubscribe
    const success = await EmailService.handleUnsubscribe(token)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Invalid or expired unsubscribe token' },
        { status: 400 }
      )
    }

    // Get token data for confirmation
    const tokenData = await EmailService.validateUnsubscribeToken(token)
    
    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed from all email notifications',
      email: tokenData?.email
    })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to process unsubscribe request' },
      { status: 500 }
    )
  }
}

// POST /api/unsubscribe - Process unsubscribe via form submission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, email, reason, feedback } = body as {
      token?: string
      email?: string
      reason?: string
      feedback?: string
    }

    let success = false
    let userEmail = ''

    if (token) {
      // Unsubscribe via token
      success = await EmailService.handleUnsubscribe(token)
      const tokenData = await EmailService.validateUnsubscribeToken(token)
      userEmail = tokenData?.email || ''
    } else if (email) {
      // Unsubscribe via email address
      success = await unsubscribeByEmail(email)
      userEmail = email
    } else {
      return NextResponse.json(
        { error: 'Either token or email is required' },
        { status: 400 }
      )
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to unsubscribe - invalid token or email not found' },
        { status: 400 }
      )
    }

    // Log unsubscribe reason and feedback
    if (reason || feedback) {
      await logUnsubscribeReason(userEmail, reason, feedback)
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed from all email notifications',
      email: userEmail
    })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to process unsubscribe request' },
      { status: 500 }
    )
  }
}

// PUT /api/unsubscribe - Resubscribe user
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, userId } = body as {
      email?: string
      userId?: string
    }

    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Either email or userId is required' },
        { status: 400 }
      )
    }

    let targetUserId = userId
    
    if (!targetUserId && email) {
      // Find user by email
      const userKeys = await kv.keys('user:*')
      for (const key of userKeys) {
        const user = await kv.get(key) as any
        if (user && user.email === email) {
          targetUserId = key.split(':')[1]
          break
        }
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Re-enable email notifications
    const preferences = await EmailService.getEmailPreferences(targetUserId)
    preferences.unsubscribed = false
    await EmailService.updateEmailPreferences(targetUserId, preferences)

    // Log resubscribe action
    await kv.lpush(`user:activity:${targetUserId}`, {
      type: 'email_resubscribed',
      timestamp: new Date().toISOString(),
      method: email ? 'email' : 'userId'
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully resubscribed to email notifications'
    })
  } catch (error) {
    console.error('Resubscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to process resubscribe request' },
      { status: 500 }
    )
  }
}

/**
 * Unsubscribe user by email address
 */
async function unsubscribeByEmail(email: string): Promise<boolean> {
  try {
    // Find user by email
    const userKeys = await kv.keys('user:*')
    
    for (const key of userKeys) {
      const user = await kv.get(key) as any
      if (user && user.email === email) {
        const userId = key.split(':')[1]
        
        // Update preferences
        const preferences = await EmailService.getEmailPreferences(userId)
        preferences.unsubscribed = true
        await EmailService.updateEmailPreferences(userId, preferences)
        
        return true
      }
    }
    
    return false
  } catch (error) {
    console.error('Failed to unsubscribe by email:', error)
    return false
  }
}

/**
 * Log unsubscribe reason and feedback for analytics
 */
async function logUnsubscribeReason(
  email: string,
  reason?: string,
  feedback?: string
): Promise<void> {
  try {
    const unsubscribeData = {
      email,
      reason,
      feedback,
      timestamp: new Date().toISOString(),
      ip: '', // Could add IP tracking
      userAgent: '' // Could add user agent
    }

    // Store unsubscribe feedback
    await kv.lpush('unsubscribe:feedback', unsubscribeData)
    
    // Keep only last 1000 feedback entries
    await kv.ltrim('unsubscribe:feedback', 0, 999)
    
    // Update reason statistics
    if (reason) {
      const today = new Date().toISOString().split('T')[0]
      await kv.incr(`analytics:unsubscribe:reason:${reason}:${today}`)
    }
  } catch (error) {
    console.error('Failed to log unsubscribe reason:', error)
  }
}

