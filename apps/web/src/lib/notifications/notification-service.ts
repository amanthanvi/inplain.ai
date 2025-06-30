import { EventEmitter } from 'events'
import type { Notification } from '@/components/notifications/NotificationCenter'
import { logger } from '@/lib/logger'

export interface NotificationServiceConfig {
  userId: string
  enableSound?: boolean
  enableDesktop?: boolean
  enableToast?: boolean
}

export interface NotificationPreferences {
  enableSound: boolean
  enableDesktop: boolean
  enableToast: boolean
  enableEmail: boolean
  quietHours: {
    enabled: boolean
    start: string // HH:MM format
    end: string // HH:MM format
  }
  subscriptions: NotificationSubscription[]
}

export interface NotificationSubscription {
  companySlug: string
  companyName: string
  types: NotificationType[]
  severity: NotificationSeverity[]
  channels: NotificationChannel[]
}

export type NotificationType = 'policy-change' | 'risk-alert' | 'analysis-complete' | 'system'
export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success'
export type NotificationChannel = 'email' | 'push' | 'in-app'

class NotificationService extends EventEmitter {
  private static instance: NotificationService
  private config: NotificationServiceConfig | null = null
  private eventSource: EventSource | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private subscriptions: Map<string, NotificationSubscription> = new Map()
  private notificationQueue: Notification[] = []
  private isOnline = typeof window !== 'undefined' ? navigator.onLine : true
  private preferences: NotificationPreferences | null = null

  private constructor() {
    super()
    this.setupNetworkListeners()
    this.setupVisibilityListeners()
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  async initialize(config: NotificationServiceConfig): Promise<void> {
    this.config = config
    
    // Load user preferences
    await this.loadPreferences()
    
    // Do NOT automatically request notification permission - this should only happen on user interaction
    // Check current permission status without requesting
    if (this.preferences?.enableDesktop && typeof window !== 'undefined' && 'Notification' in window) {
      const currentPermission = Notification.permission
      if (currentPermission === 'denied') {
        console.warn('Desktop notifications permission was previously denied')
        // Optionally disable desktop notifications in preferences
        if (this.preferences) {
          this.preferences.enableDesktop = false
        }
      }
    }
    
    // Connect to SSE endpoint
    await this.connect()
  }

  private async connect(): Promise<void> {
    if (!this.config?.userId) return
    
    try {
      // Close existing connection
      this.disconnect()
      
      // Create new EventSource connection with auth
      const url = new URL('/api/notifications/stream', window.location.origin)
      url.searchParams.set('userId', this.config.userId)
      
      this.eventSource = new EventSource(url.toString(), { 
        withCredentials: true 
      })
      
      this.eventSource.onopen = () => {
        console.log('Notification stream connected')
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000
        this.emit('connected')
        
        // Process queued notifications
        this.processQueue()
      }
      
      this.eventSource.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data) as Notification
          this.handleNotification(notification)
        } catch (error) {
          console.error('Failed to parse notification:', error)
        }
      }
      
      this.eventSource.onerror = (error) => {
        console.error('Notification stream error:', error)
        this.handleConnectionError()
      }
      
      // Listen for specific event types
      this.eventSource.addEventListener('policy-change', (event) => {
        const data = JSON.parse(event.data)
        this.handlePolicyChange(data)
      })
      
      this.eventSource.addEventListener('risk-alert', (event) => {
        const data = JSON.parse(event.data)
        this.handleRiskAlert(data)
      })
      
      this.eventSource.addEventListener('analysis-complete', (event) => {
        const data = JSON.parse(event.data)
        this.handleAnalysisComplete(data)
      })
      
    } catch (error) {
      console.error('Failed to connect to notification stream:', error)
      this.handleConnectionError()
    }
  }

  private disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
      this.emit('disconnected')
    }
  }

  private handleConnectionError(): void {
    this.emit('disconnected')
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000)
      
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
      
      setTimeout(() => {
        if (this.isOnline) {
          this.connect()
        }
      }, delay)
    } else {
      console.error('Max reconnection attempts reached')
      this.emit('connection-failed')
    }
  }

  private isInQuietHours(): boolean {
    if (!this.preferences?.quietHours.enabled) return false
    
    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()
    
    const startParts = this.preferences.quietHours.start.split(':').map(Number)
    const endParts = this.preferences.quietHours.end.split(':').map(Number)
    
    const startTime = (startParts[0] || 0) * 60 + (startParts[1] || 0)
    const endTime = (endParts[0] || 0) * 60 + (endParts[1] || 0)
    
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime
    }
  }

  private shouldNotify(notification: Notification): boolean {
    // Check if user is subscribed to this company
    const companySlug = notification.metadata?.companySlug
    if (companySlug) {
      const subscription = this.subscriptions.get(companySlug)
      if (!subscription) return false
      
      // Check type filter
      if (!subscription.types.includes(notification.type)) return false
      
      // Check severity filter
      if (!subscription.severity.includes(notification.severity)) return false
    }
    
    // Check quiet hours
    if (this.isInQuietHours() && notification.severity !== 'critical') {
      return false
    }
    
    return true
  }

  private handleNotification(notification: Notification): void {
    // Check if should notify
    if (!this.shouldNotify(notification)) {
      return
    }
    
    // Emit notification event
    this.emit('notification', notification)
    
    // Store notification
    this.storeNotification(notification)
    
    // Show desktop notification if enabled
    if (this.preferences?.enableDesktop && 
        (notification.severity === 'critical' || notification.severity === 'warning')) {
      this.showDesktopNotification(notification)
    }
    
    // Play sound if enabled
    if (this.preferences?.enableSound && notification.severity !== 'info') {
      this.playNotificationSound(notification.severity)
    }
  }

  private handlePolicyChange(data: any): void {
    const notification: Notification = {
      id: `policy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'policy-change',
      severity: data.changeType === 'major' ? 'critical' : 
               data.changeType === 'moderate' ? 'warning' : 'info',
      title: `${data.company} Privacy Policy Updated`,
      message: data.summary || 'Click to view the changes',
      timestamp: new Date().toISOString(),
      read: false,
      action: {
        label: 'View Changes',
        href: `/${data.companySlug}`
      },
      metadata: {
        company: data.company,
        companySlug: data.companySlug,
        changeType: data.changeType,
        riskLevel: data.riskLevel,
        policyType: data.policyType || 'Privacy Policy'
      }
    }
    
    this.handleNotification(notification)
  }

  private handleRiskAlert(data: any): void {
    const notification: Notification = {
      id: `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'risk-alert',
      severity: 'critical',
      title: 'High Risk Privacy Change Detected',
      message: `${data.company} has made changes that may significantly impact your privacy`,
      timestamp: new Date().toISOString(),
      read: false,
      action: {
        label: 'Review Now',
        href: `/${data.companySlug}`
      },
      metadata: {
        company: data.company,
        companySlug: data.companySlug,
        riskLevel: 'high',
        changeType: 'major'
      }
    }
    
    this.handleNotification(notification)
  }

  private handleAnalysisComplete(data: any): void {
    const notification: Notification = {
      id: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'analysis-complete',
      severity: 'success',
      title: 'Analysis Complete',
      message: `${data.company} policy analysis has been completed`,
      timestamp: new Date().toISOString(),
      read: false,
      action: {
        label: 'View Results',
        href: `/${data.companySlug}/analytics`
      },
      metadata: {
        company: data.company,
        companySlug: data.companySlug
      }
    }
    
    this.handleNotification(notification)
  }

  private async storeNotification(notification: Notification): Promise<void> {
    if (!this.config?.userId) return
    
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.config.userId,
          notification
        })
      })
    } catch (error) {
      console.error('Failed to store notification:', error)
    }
  }

  private showDesktopNotification(notification: Notification): void {
    if (typeof window === 'undefined' || 
        !('Notification' in window) || 
        Notification.permission !== 'granted' ||
        this.isInQuietHours()) {
      return
    }
    
    const desktopNotif = new Notification(notification.title, {
      body: notification.message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: notification.id,
      requireInteraction: notification.severity === 'critical',
      silent: false,
      data: notification
    })
    
    desktopNotif.onclick = () => {
      window.focus()
      if (notification.action?.href) {
        window.location.href = notification.action.href
      }
      desktopNotif.close()
    }
  }

  // Request desktop notification permission - should only be called on user interaction
  async requestDesktopPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Desktop notifications not supported')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      console.warn('Desktop notifications were previously denied')
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    }
  }

  private playNotificationSound(severity: NotificationSeverity): void {
    if (typeof window === 'undefined' || 
        typeof Audio === 'undefined' ||
        this.isInQuietHours()) return
    
    const soundFile = severity === 'critical' ? '/notification-critical.mp3' : '/notification.mp3'
    const audio = new Audio(soundFile)
    audio.volume = severity === 'critical' ? 0.8 : 0.5
    audio.play().catch(e => console.log('Failed to play notification sound:', e))
  }

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return
    
    window.addEventListener('online', () => {
      this.isOnline = true
      console.log('Network connection restored')
      if (this.config) {
        this.connect()
      }
    })
    
    window.addEventListener('offline', () => {
      this.isOnline = false
      console.log('Network connection lost')
      this.disconnect()
    })
  }

  private setupVisibilityListeners(): void {
    if (typeof document === 'undefined') return
    
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Reduce connection frequency when tab is hidden
        console.log('Tab hidden, reducing notification frequency')
      } else {
        // Resume normal operation when tab is visible
        console.log('Tab visible, resuming normal operation')
        if (this.config && !this.eventSource) {
          this.connect()
        }
      }
    })
  }

  private processQueue(): void {
    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift()
      if (notification) {
        this.handleNotification(notification)
      }
    }
  }

  // Public methods

  async loadPreferences(): Promise<void> {
    if (!this.config?.userId) return
    
    try {
      const response = await fetch(`/api/notifications/preferences?userId=${this.config.userId}`)
      if (response.ok) {
        this.preferences = await response.json()
        
        // Load subscriptions
        this.subscriptions.clear()
        this.preferences?.subscriptions.forEach(sub => {
          this.subscriptions.set(sub.companySlug, sub)
        })
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error)
    }
  }

  async savePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    if (!this.config?.userId) return
    
    this.preferences = { ...this.preferences!, ...preferences }
    
    try {
      await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.config.userId,
          preferences: this.preferences
        })
      })
    } catch (error) {
      console.error('Failed to save notification preferences:', error)
    }
  }

  subscribe(companySlug: string, subscription: Partial<NotificationSubscription>): void {
    const fullSubscription: NotificationSubscription = {
      companySlug,
      companyName: subscription.companyName || companySlug,
      types: subscription.types || ['policy-change', 'risk-alert'],
      severity: subscription.severity || ['critical', 'warning'],
      channels: subscription.channels || ['in-app']
    }
    
    this.subscriptions.set(companySlug, fullSubscription)
    
    // Update preferences
    if (this.preferences) {
      this.preferences.subscriptions = Array.from(this.subscriptions.values())
      this.savePreferences(this.preferences)
    }
  }

  unsubscribe(companySlug: string): void {
    this.subscriptions.delete(companySlug)
    
    // Update preferences
    if (this.preferences) {
      this.preferences.subscriptions = Array.from(this.subscriptions.values())
      this.savePreferences(this.preferences)
    }
  }

  isSubscribed(companySlug: string): boolean {
    return this.subscriptions.has(companySlug)
  }

  getSubscription(companySlug: string): NotificationSubscription | undefined {
    return this.subscriptions.get(companySlug)
  }

  async testNotification(type: NotificationType = 'system'): Promise<void> {
    const testNotification: Notification = {
      id: `test-${Date.now()}`,
      type,
      severity: 'info',
      title: 'Test Notification',
      message: 'This is a test notification to verify your settings are working correctly',
      timestamp: new Date().toISOString(),
      read: false
    }
    
    this.handleNotification(testNotification)
  }

  destroy(): void {
    this.disconnect()
    this.removeAllListeners()
    this.subscriptions.clear()
    this.notificationQueue = []
  }

  // Add method for policy change notifications (used by policy monitor)
  async notifyPolicyChange(change: {
    companySlug: string
    changeType: string
    timestamp: string
    severity: string
  }): Promise<void> {
    // This would be implemented to send notifications through appropriate channels
    // For now, just log the change
    logger.info('Policy change notification', change)
    
    // TODO: Implement actual notification logic
    // - Check user subscriptions
    // - Send notifications through enabled channels
    // - Update notification history
  }
}

export const notificationService = NotificationService.getInstance()