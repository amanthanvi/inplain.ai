import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { notificationService, type NotificationSubscription } from '@/lib/realtime/notification-service'
import type { Notification } from '@/components/realtime/NotificationCenter'

interface UseNotificationsOptions {
  enableSound?: boolean
  enableDesktop?: boolean
  enableToast?: boolean
  maxNotifications?: number
}

interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  isConnected: boolean
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  dismiss: (id: string) => void
  dismissAll: () => void
  subscribe: (companySlug: string, options?: Partial<NotificationSubscription>) => void
  unsubscribe: (companySlug: string) => void
  testNotification: () => void
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const { user } = useUser()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const notificationsRef = useRef<Notification[]>([])
  const maxNotifications = options.maxNotifications || 50

  // Initialize notification service
  useEffect(() => {
    if (!user?.id) return

    const initializeService = async () => {
      await notificationService.initialize({
        userId: user.id,
        enableSound: options.enableSound ?? true,
        enableDesktop: options.enableDesktop ?? true,
        enableToast: options.enableToast ?? true
      })

      // Load saved subscriptions
      await notificationService.loadSubscriptions()
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

    // Load initial notifications from storage
    loadStoredNotifications()

    return () => {
      notificationService.off('notification', handleNotification)
      notificationService.off('connected', handleConnected)
      notificationService.off('disconnected', handleDisconnected)
    }
  }, [user?.id, options.enableSound, options.enableDesktop, options.enableToast, maxNotifications])

  // Load notifications from local storage
  const loadStoredNotifications = async () => {
    try {
      const stored = localStorage.getItem(`notifications-${user?.id}`)
      if (stored) {
        const parsed = JSON.parse(stored) as Notification[]
        setNotifications(parsed.slice(0, maxNotifications))
        notificationsRef.current = parsed.slice(0, maxNotifications)
      }
    } catch (error) {
      console.error('Failed to load stored notifications:', error)
    }
  }

  // Save notifications to local storage
  useEffect(() => {
    if (user?.id && notifications.length > 0) {
      try {
        localStorage.setItem(`notifications-${user.id}`, JSON.stringify(notifications))
      } catch (error) {
        console.error('Failed to save notifications:', error)
      }
    }
  }, [notifications, user?.id])

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length

  // Mark notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    )
  }, [])

  // Dismiss a notification
  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  // Dismiss all notifications
  const dismissAll = useCallback(() => {
    setNotifications([])
    if (user?.id) {
      localStorage.removeItem(`notifications-${user.id}`)
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

  // Test notification
  const testNotification = useCallback(() => {
    notificationService.testNotification()
  }, [])

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
    subscribe,
    unsubscribe,
    testNotification
  }
}