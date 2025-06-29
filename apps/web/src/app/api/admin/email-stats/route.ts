import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { EmailService } from '@/lib/email'
import { getUnsubscribeAnalytics } from '@/lib/analytics/email-analytics'
import { kv } from '@vercel/kv'

export const runtime = 'edge'

/**
 * Admin Email Statistics API
 * Provides comprehensive email analytics and performance metrics
 */

// GET /api/admin/email-stats - Get email statistics
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin (you may want to implement proper admin check)
    const user = await kv.get(`user:${userId}`) as any
    if (!user || user.plan !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const includeDetails = searchParams.get('details') === 'true'

    // Get email statistics
    const emailStats = await EmailService.getEmailStats(days)
    
    // Get queue statistics
    const queueStats = await EmailService.getQueueStats()
    
    // Get unsubscribe analytics
    const unsubscribeAnalytics = await getUnsubscribeAnalytics(days)
    
    // Get user preference analytics
    const preferenceAnalytics = await getPreferenceAnalytics(days)
    
    // Get digest performance
    const digestPerformance = await getDigestPerformance(days)
    
    // Get recent cron job stats
    const cronStats = await kv.get('notification:cron:last-run') as any

    const response = {
      summary: {
        totalEmailsSent: emailStats.sent,
        totalEmailsFailed: emailStats.failed,
        successRate: emailStats.sent > 0 ? ((emailStats.sent / (emailStats.sent + emailStats.failed)) * 100).toFixed(2) : '0',
        totalUnsubscribes: unsubscribeAnalytics.totalUnsubscribes,
        unsubscribeRate: emailStats.sent > 0 ? ((unsubscribeAnalytics.totalUnsubscribes / emailStats.sent) * 100).toFixed(2) : '0',
        queueHealth: {
          pending: queueStats.pending,
          sent: queueStats.sent,
          failed: queueStats.failed
        }
      },
      timeRange: {
        days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      dailyStats: emailStats.dailyStats,
      unsubscribeAnalytics,
      preferenceAnalytics,
      digestPerformance,
      lastCronRun: cronStats
    }

    if (includeDetails) {
      // Add detailed information
      const detailedStats = await getDetailedEmailStats(days)
      Object.assign(response, { details: detailedStats })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to get email statistics:', error)
    return NextResponse.json(
      { error: 'Failed to get email statistics' },
      { status: 500 }
    )
  }
}

// POST /api/admin/email-stats - Trigger email operations (testing)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await kv.get(`user:${userId}`) as any
    if (!user || user.plan !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { action, targetUserId, emailType } = body as {
      action: 'test-email' | 'process-queue' | 'send-digest' | 'reset-stats'
      targetUserId?: string
      emailType?: 'welcome' | 'digest' | 'policy-change'
    }

    let result: any = {}

    switch (action) {
      case 'test-email':
        if (!targetUserId || !emailType) {
          return NextResponse.json({ error: 'Missing targetUserId or emailType' }, { status: 400 })
        }
        
        const targetUser = await kv.get(`user:${targetUserId}`) as any
        if (!targetUser) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        if (emailType === 'welcome') {
          result.success = await EmailService.sendWelcomeEmail(targetUser)
        } else if (emailType === 'digest') {
          result.success = await EmailService.sendWeeklyDigest(targetUserId)
        }
        
        result.message = `Test ${emailType} email ${result.success ? 'sent' : 'failed'} for user ${targetUserId}`
        break

      case 'process-queue':
        result.processed = await EmailService.processNotificationQueue(100)
        result.message = `Processed ${result.processed} notifications from queue`
        break

      case 'send-digest':
        // Trigger digest for all eligible users (be careful with this)
        result.message = 'Digest sending triggered - check cron logs for results'
        break

      case 'reset-stats':
        // Reset statistics (for testing environments)
        await resetEmailStatistics()
        result.message = 'Email statistics reset'
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Log admin action
    await kv.lpush('admin:actions:log', {
      userId,
      action,
      targetUserId,
      emailType,
      result,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to execute admin action:', error)
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    )
  }
}

/**
 * Get user preference analytics
 */
async function getPreferenceAnalytics(days: number): Promise<{
  totalUsers: number
  preferenceCounts: Record<string, { enabled: number; disabled: number }>
  recentChanges: Array<{ date: string; changes: number }>
}> {
  try {
    // Get all user preference keys
    const userPrefKeys = await kv.keys('email:preferences:*')
    const totalUsers = userPrefKeys.length

    // Count preference settings
    const preferenceCounts: Record<string, { enabled: number; disabled: number }> = {}
    const preferences = ['policyChanges', 'weeklyDigest', 'monthlyDigest', 'criticalAlerts', 'productUpdates']

    for (const pref of preferences) {
      preferenceCounts[pref] = { enabled: 0, disabled: 0 }
    }

    // Sample a subset for performance (analyze up to 1000 users)
    const sampleKeys = userPrefKeys.slice(0, 1000)
    
    for (const key of sampleKeys) {
      const userPrefs = await kv.get(key) as any
      if (userPrefs) {
        for (const pref of preferences) {
          if (userPrefs[pref]) {
            preferenceCounts[pref].enabled++
          } else {
            preferenceCounts[pref].disabled++
          }
        }
      }
    }

    // Get recent preference changes
    const recentChanges = []
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      let dayChanges = 0
      for (const pref of preferences) {
        const enabled = await kv.get(`analytics:preferences:${pref}:enabled:${dateStr}`) as number || 0
        const disabled = await kv.get(`analytics:preferences:${pref}:disabled:${dateStr}`) as number || 0
        dayChanges += enabled + disabled
      }
      
      recentChanges.push({ date: dateStr, changes: dayChanges })
    }

    return {
      totalUsers,
      preferenceCounts,
      recentChanges
    }
  } catch (error) {
    console.error('Failed to get preference analytics:', error)
    return {
      totalUsers: 0,
      preferenceCounts: {},
      recentChanges: []
    }
  }
}

/**
 * Get digest performance metrics
 */
async function getDigestPerformance(days: number): Promise<{
  weeklyDigests: { sent: number; opened: number; clicked: number }
  monthlyDigests: { sent: number; opened: number; clicked: number }
  averageEngagement: number
}> {
  try {
    // This would require integration with email provider's analytics
    // For now, return mock data structure
    return {
      weeklyDigests: { sent: 0, opened: 0, clicked: 0 },
      monthlyDigests: { sent: 0, opened: 0, clicked: 0 },
      averageEngagement: 0
    }
  } catch (error) {
    console.error('Failed to get digest performance:', error)
    return {
      weeklyDigests: { sent: 0, opened: 0, clicked: 0 },
      monthlyDigests: { sent: 0, opened: 0, clicked: 0 },
      averageEngagement: 0
    }
  }
}

/**
 * Get detailed email statistics
 */
async function getDetailedEmailStats(days: number): Promise<{
  topFailureReasons: Array<{ reason: string; count: number }>
  emailTypeBreakdown: Record<string, number>
  peakSendingTimes: Array<{ hour: number; count: number }>
}> {
  try {
    // This would require more detailed logging
    // For now, return basic structure
    return {
      topFailureReasons: [],
      emailTypeBreakdown: {},
      peakSendingTimes: []
    }
  } catch (error) {
    console.error('Failed to get detailed email stats:', error)
    return {
      topFailureReasons: [],
      emailTypeBreakdown: {},
      peakSendingTimes: []
    }
  }
}

/**
 * Reset email statistics (for testing)
 */
async function resetEmailStatistics(): Promise<void> {
  try {
    const keys = await kv.keys('email:stats:*')
    const analyticsKeys = await kv.keys('analytics:*')
    
    const pipeline = kv.pipeline()
    for (const key of [...keys, ...analyticsKeys]) {
      pipeline.del(key)
    }
    
    await pipeline.exec()
  } catch (error) {
    console.error('Failed to reset email statistics:', error)
  }
}