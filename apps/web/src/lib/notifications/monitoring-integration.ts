import { kv } from '@vercel/kv'
import type { Notification } from '@/components/notifications/NotificationCenter'

interface PolicyChangeEvent {
  companySlug: string
  companyName: string
  policyType: 'privacy' | 'terms' | 'cookies' | 'other'
  changeType: 'major' | 'moderate' | 'minor'
  summary: string
  riskLevel?: 'high' | 'medium' | 'low'
  detectedAt: string
  diffUrl?: string
}

interface RiskAlertEvent {
  companySlug: string
  companyName: string
  alertType: 'data-collection' | 'third-party-sharing' | 'retention-change' | 'rights-reduction'
  severity: 'critical' | 'warning'
  description: string
  affectedSections: string[]
  detectedAt: string
}

/**
 * Trigger a notification for a policy change event
 */
export async function notifyPolicyChange(event: PolicyChangeEvent): Promise<void> {
  try {
    // Get all users watching this company
    const watchingUsers = await kv.smembers(`company:${event.companySlug}:watchers`) as string[]
    
    if (!watchingUsers || watchingUsers.length === 0) {
      return
    }

    // Create notification
    const notification: Notification = {
      id: `policy-${event.companySlug}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'policy-change',
      severity: event.changeType === 'major' ? 'critical' : 
               event.changeType === 'moderate' ? 'warning' : 'info',
      title: `${event.companyName} ${event.policyType.charAt(0).toUpperCase() + event.policyType.slice(1)} Policy Updated`,
      message: event.summary || `The ${event.policyType} policy has been updated with ${event.changeType} changes.`,
      timestamp: new Date().toISOString(),
      read: false,
      action: {
        label: 'View Changes',
        href: event.diffUrl || `/${event.companySlug}`
      },
      metadata: {
        company: event.companyName,
        companySlug: event.companySlug,
        changeType: event.changeType,
        riskLevel: event.riskLevel,
        policyType: event.policyType
      }
    }

    // Send notification to all watching users
    const pipeline = kv.pipeline()
    
    for (const userId of watchingUsers) {
      // Store notification
      const notificationKey = `notifications:${userId}:${notification.id}`
      pipeline.set(notificationKey, notification, { ex: 30 * 24 * 60 * 60 }) // 30 days TTL
      
      // Add to user's notification list
      pipeline.lpush(`notifications:${userId}:list`, notification.id)
      
      // Update unread count
      pipeline.incr(`notifications:${userId}:unread`)
      
      // Queue for real-time delivery
      pipeline.lpush(`notifications:${userId}:queue`, JSON.stringify(notification))
    }
    
    // Store the change event for the stream endpoint
    pipeline.set(`changes:${event.companySlug}:latest`, {
      ...event,
      notificationId: notification.id
    }, { ex: 300 }) // 5 minutes TTL for stream pickup
    
    await pipeline.exec()
    
    console.log(`Policy change notification sent to ${watchingUsers.length} users for ${event.companyName}`)
  } catch (error) {
    console.error('Failed to send policy change notification:', error)
    throw error
  }
}

/**
 * Trigger a risk alert notification
 */
export async function notifyRiskAlert(event: RiskAlertEvent): Promise<void> {
  try {
    // Get all users watching this company with risk alerts enabled
    const watchingUsers = await kv.smembers(`company:${event.companySlug}:watchers`) as string[]
    
    if (!watchingUsers || watchingUsers.length === 0) {
      return
    }

    // Filter users who have risk alerts enabled
    const usersToNotify: string[] = []
    for (const userId of watchingUsers) {
      const subscription = await kv.get<{ types?: string[] }>(`notifications:subscription:${userId}:${event.companySlug}`)
      if (subscription && subscription.types?.includes('risk-alert')) {
        usersToNotify.push(userId)
      }
    }

    if (usersToNotify.length === 0) {
      return
    }

    // Create notification
    const notification: Notification = {
      id: `risk-${event.companySlug}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'risk-alert',
      severity: event.severity,
      title: `Privacy Risk Alert: ${event.companyName}`,
      message: event.description,
      timestamp: new Date().toISOString(),
      read: false,
      action: {
        label: 'Review Details',
        href: `/${event.companySlug}#risk-analysis`
      },
      metadata: {
        company: event.companyName,
        companySlug: event.companySlug,
        riskLevel: event.severity === 'critical' ? 'high' : 'medium'
      }
    }

    // Send notification to filtered users
    const pipeline = kv.pipeline()
    
    for (const userId of usersToNotify) {
      // Store notification
      const notificationKey = `notifications:${userId}:${notification.id}`
      pipeline.set(notificationKey, notification, { ex: 30 * 24 * 60 * 60 })
      
      // Add to user's notification list
      pipeline.lpush(`notifications:${userId}:list`, notification.id)
      
      // Update unread count
      pipeline.incr(`notifications:${userId}:unread`)
      
      // Queue for real-time delivery
      pipeline.lpush(`notifications:${userId}:queue`, JSON.stringify(notification))
    }
    
    await pipeline.exec()
    
    console.log(`Risk alert notification sent to ${usersToNotify.length} users for ${event.companyName}`)
  } catch (error) {
    console.error('Failed to send risk alert notification:', error)
    throw error
  }
}

/**
 * Notify when an AI analysis is complete
 */
export async function notifyAnalysisComplete(
  userId: string,
  companySlug: string,
  companyName: string,
  analysisType: string
): Promise<void> {
  try {
    const notification: Notification = {
      id: `analysis-${companySlug}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'analysis-complete',
      severity: 'success',
      title: 'Analysis Complete',
      message: `Your ${analysisType} analysis for ${companyName} is ready`,
      timestamp: new Date().toISOString(),
      read: false,
      action: {
        label: 'View Analysis',
        href: `/${companySlug}/analytics`
      },
      metadata: {
        company: companyName,
        companySlug: companySlug
      }
    }

    // Store notification
    const pipeline = kv.pipeline()
    
    const notificationKey = `notifications:${userId}:${notification.id}`
    pipeline.set(notificationKey, notification, { ex: 30 * 24 * 60 * 60 })
    pipeline.lpush(`notifications:${userId}:list`, notification.id)
    pipeline.incr(`notifications:${userId}:unread`)
    pipeline.lpush(`notifications:${userId}:queue`, JSON.stringify(notification))
    
    await pipeline.exec()
    
    console.log(`Analysis complete notification sent to user ${userId} for ${companyName}`)
  } catch (error) {
    console.error('Failed to send analysis complete notification:', error)
    throw error
  }
}

/**
 * Send a system notification to a specific user
 */
export async function notifySystem(
  userId: string,
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'success' = 'info',
  action?: { label: string; href?: string }
): Promise<void> {
  try {
    const notification: Notification = {
      id: `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'system',
      severity,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      action
    }

    // Store notification
    const pipeline = kv.pipeline()
    
    const notificationKey = `notifications:${userId}:${notification.id}`
    pipeline.set(notificationKey, notification, { ex: 30 * 24 * 60 * 60 })
    pipeline.lpush(`notifications:${userId}:list`, notification.id)
    pipeline.incr(`notifications:${userId}:unread`)
    pipeline.lpush(`notifications:${userId}:queue`, JSON.stringify(notification))
    
    await pipeline.exec()
    
    console.log(`System notification sent to user ${userId}: ${title}`)
  } catch (error) {
    console.error('Failed to send system notification:', error)
    throw error
  }
}

/**
 * Broadcast a system notification to all users
 */
export async function broadcastSystemNotification(
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'success' = 'info',
  action?: { label: string; href?: string }
): Promise<void> {
  try {
    // Get all users (this would need to be implemented based on your user storage)
    // For now, we'll use a pattern to find all notification lists
    const keys = await kv.keys('notifications:*:list')
    const userIds = keys.map(key => key.split(':')[1]).filter(Boolean)
    
    const notification: Notification = {
      id: `broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'system',
      severity,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      action
    }

    // Send to all users
    const pipeline = kv.pipeline()
    
    for (const userId of userIds) {
      const notificationKey = `notifications:${userId}:${notification.id}`
      pipeline.set(notificationKey, notification, { ex: 30 * 24 * 60 * 60 })
      pipeline.lpush(`notifications:${userId}:list`, notification.id)
      pipeline.incr(`notifications:${userId}:unread`)
      pipeline.lpush(`notifications:${userId}:queue`, JSON.stringify(notification))
    }
    
    await pipeline.exec()
    
    console.log(`Broadcast notification sent to ${userIds.length} users: ${title}`)
  } catch (error) {
    console.error('Failed to send broadcast notification:', error)
    throw error
  }
}