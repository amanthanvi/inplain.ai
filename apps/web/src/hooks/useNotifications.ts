import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { notificationService, type NotificationSubscription, type NotificationPreferences } from '@/lib/notifications/notification-service'
import type { Notification } from '@/components/notifications/NotificationCenter'

interface UseNotificationsOptions {
  enableSound?: boolean
  enableDesktop?: boolean
  enableToast?: boolean
  maxNotifications?: number
  autoFetch?: boolean
}

interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  isConnected: boolean
  isLoading: boolean
  preferences: NotificationPreferences | null
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  dismiss: (id: string) => Promise<void>
  dismissAll: () => Promise<void>
  subscribe: (companySlug: string, options?: Partial<NotificationSubscription>) => void
  unsubscribe: (companySlug: string) => void
  isSubscribed: (companySlug: string) => boolean
  getSubscription: (companySlug: string) => NotificationSubscription | undefined
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>
  testNotification: () => void
  refresh: () => Promise<void>
  requestDesktopPermission: () => Promise<boolean>
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const { user } = useUser()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const notificationsRef = useRef<Notification[]>([])
  const maxNotifications = options.maxNotifications || 50
  const autoFetch = options.autoFetch !== false

  // Initialize notification service
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    const initializeService = async () => {
      setIsLoading(true)
      
      try {
        // Initialize service
        await notificationService.initialize({
          userId: user.id,
          enableSound: options.enableSound ?? true,
          enableDesktop: options.enableDesktop ?? true,
          enableToast: options.enableToast ?? true
        })

        // Load initial notifications if auto-fetch is enabled
        if (autoFetch) {
          await loadNotifications()
        }
        
        // Get preferences
        const prefs = await notificationService.loadPreferences()
        setPreferences(notificationService['preferences'])
      } catch (error) {
        console.error('Failed to initialize notifications:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeService()

    // Set up event listeners
    const handleNotification = (notification: Notification) => {
      setNotifications(prev => {
        const updated = [notification, ...prev].slice(0, maxNotifications)
        notificationsRef.current = updated
        return updated
      })
    }

    const handleConnected = () => setIsConnected(true)
    const handleDisconnected = () => setIsConnected(false)

    notificationService.on('notification', handleNotification)
    notificationService.on('connected', handleConnected)
    notificationService.on('disconnected', handleDisconnected)

    return () => {
      notificationService.off('notification', handleNotification)
      notificationService.off('connected', handleConnected)
      notificationService.off('disconnected', handleDisconnected)
    }
  }, [user?.id, options.enableSound, options.enableDesktop, options.enableToast, maxNotifications, autoFetch])

  // Load notifications from API
  const loadNotifications = async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/notifications?limit=${maxNotifications}`)
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications)
        notificationsRef.current = data.notifications
      }
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    // Update local state immediately
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )

    // Update on server
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markAsRead',
          notificationIds: [id]
        })
      })
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
      // Revert on error
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: false } : n)
      )
    }
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    
    // Update local state immediately
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    )

    // Update on server
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markAsRead',
          notificationIds: unreadIds
        })
      })
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
      // Revert on error
      await loadNotifications()
    }
  }, [notifications])

  // Dismiss a notification
  const dismiss = useCallback(async (id: string) => {
    // Update local state immediately
    setNotifications(prev => prev.filter(n => n.id !== id))

    // Update on server
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          notificationIds: [id]
        })
      })
    } catch (error) {
      console.error('Failed to dismiss notification:', error)
      // Reload on error
      await loadNotifications()
    }
  }, [])

  // Dismiss all notifications
  const dismissAll = useCallback(async () => {
    // Update local state immediately
    setNotifications([])

    // Update on server
    try {
      await fetch('/api/notifications', {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('Failed to dismiss all notifications:', error)
      // Reload on error
      await loadNotifications()
    }
  }, [user?.id])

  // Subscribe to company notifications
  const subscribe = useCallback((companySlug: string, options?: Partial<NotificationSubscription>) => {
    notificationService.subscribe(companySlug, options || {})
  }, [])

  // Unsubscribe from company notifications
  const unsubscribe = useCallback((companySlug: string) => {
    notificationService.unsubscribe(companySlug)
  }, [])

  // Check if subscribed to company
  const isSubscribed = useCallback((companySlug: string) => {
    return notificationService.isSubscribed(companySlug)
  }, [])

  // Get subscription details
  const getSubscription = useCallback((companySlug: string) => {
    return notificationService.getSubscription(companySlug)
  }, [])

  // Update preferences
  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    try {
      await notificationService.savePreferences(newPreferences)
      setPreferences(notificationService['preferences'])
    } catch (error) {
      console.error('Failed to update preferences:', error)
      throw error
    }
  }, [])

  // Test notification
  const testNotification = useCallback(() => {
    notificationService.testNotification()
  }, [])

  // Refresh notifications
  const refresh = useCallback(async () => {
    await loadNotifications()
  }, [])

  // Request desktop notification permission
  const requestDesktopPermission = useCallback(async () => {
    return await notificationService.requestDesktopPermission()
  }, [])

  return {
    notifications,
    unreadCount,
    isConnected,
    isLoading,
    preferences,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
    subscribe,
    unsubscribe,
    isSubscribed,
    getSubscription,
    updatePreferences,
    testNotification,
    refresh,
    requestDesktopPermission
  }
}