import { EventEmitter } from 'events'
import type { Notification } from '@/components/realtime/NotificationCenter'

export interface NotificationServiceConfig {
  userId: string
  enableSound?: boolean
  enableDesktop?: boolean
  enableToast?: boolean
}

export interface NotificationSubscription {
  companySlug: string
  types: ('critical' | 'warning' | 'info')[]
  channels: ('email' | 'push' | 'in-app')[]
}

class NotificationService extends EventEmitter {
  private static instance: NotificationService
  private config: NotificationServiceConfig | null = null
  private eventSource: EventSource | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private subscriptions: Map<string, NotificationSubscription> = new Map()
  private notificationQueue: Notification[] = []
  private isOnline = true

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
    
    // Request notification permission if needed
    if (config.enableDesktop && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        console.warn('Desktop notifications permission denied')
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
      
      // Create new EventSource connection
      this.eventSource = new EventSource(
        `/api/notifications/stream?userId=${this.config.userId}`,
        { withCredentials: true }
      )
      
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
      
    } catch (error) {
      console.error('Failed to connect to notification stream:', error)
      this.handleConnectionError()
    }
  }

  private disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
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

  private handleNotification(notification: Notification): void {
    // Check if user is subscribed to this type of notification
    const subscription = this.subscriptions.get(notification.metadata?.company || '')
    if (subscription && !subscription.types.includes(notification.severity)) {
      return
    }
    
    // Emit notification event
    this.emit('notification', notification)
    
    // Show desktop notification if enabled
    if (this.config?.enableDesktop && notification.severity === 'critical') {
      this.showDesktopNotification(notification)
    }
    
    // Play sound if enabled
    if (this.config?.enableSound && notification.severity !== 'info') {
      this.playNotificationSound()
    }
  }

  private handlePolicyChange(data: any): void {
    const notification: Notification = {
      id: `policy-${Date.now()}`,
      type: 'policy-change',
      severity: data.changeType === 'major' ? 'critical' : 'warning',
      title: `${data.company} Privacy Policy Updated`,
      message: data.summary || 'Click to view the changes',
      timestamp: new Date().toISOString(),
      read: false,
      action: {
        label: 'View Changes',
        onClick: () => window.location.href = `/${data.companySlug}`
      },
      metadata: {
        company: data.company,
        changeType: data.changeType,
        riskLevel: data.riskLevel
      }
    }
    
    this.handleNotification(notification)
  }

  private handleRiskAlert(data: any): void {
    const notification: Notification = {
      id: `risk-${Date.now()}`,
      type: 'risk-alert',
      severity: 'critical',
      title: 'High Risk Privacy Change Detected',
      message: `${data.company} has made changes that may significantly impact your privacy`,
      timestamp: new Date().toISOString(),
      read: false,
      action: {
        label: 'Review Now',
        onClick: () => window.location.href = `/${data.companySlug}`
      },
      metadata: {
        company: data.company,
        riskLevel: 'high'
      }
    }
    
    this.handleNotification(notification)
  }

  private showDesktopNotification(notification: Notification): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
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
      if (notification.action?.onClick) {
        notification.action.onClick()
      }
      desktopNotif.close()
    }
  }

  private playNotificationSound(): void {
    const audio = new Audio('/notification.mp3')
    audio.volume = 0.5
    audio.play().catch(e => console.log('Failed to play notification sound:', e))
  }

  private setupNetworkListeners(): void {
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

  subscribe(companySlug: string, subscription: Partial<NotificationSubscription>): void {
    this.subscriptions.set(companySlug, {
      companySlug,
      types: subscription.types || ['critical', 'warning', 'info'],
      channels: subscription.channels || ['in-app']
    })
    
    // Persist to server
    this.saveSubscriptions()
  }

  unsubscribe(companySlug: string): void {
    this.subscriptions.delete(companySlug)
    this.saveSubscriptions()
  }

  async saveSubscriptions(): Promise<void> {
    if (!this.config?.userId) return
    
    try {
      await fetch('/api/notifications/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.config.userId,
          subscriptions: Array.from(this.subscriptions.values())
        })
      })
    } catch (error) {
      console.error('Failed to save notification subscriptions:', error)
    }
  }

  async loadSubscriptions(): Promise<void> {
    if (!this.config?.userId) return
    
    try {
      const response = await fetch(`/api/notifications/subscriptions?userId=${this.config.userId}`)
      if (response.ok) {
        const data = await response.json()
        this.subscriptions.clear()
        data.subscriptions.forEach((sub: NotificationSubscription) => {
          this.subscriptions.set(sub.companySlug, sub)
        })
      }
    } catch (error) {
      console.error('Failed to load notification subscriptions:', error)
    }
  }

  async testNotification(): Promise<void> {
    const testNotification: Notification = {
      id: `test-${Date.now()}`,
      type: 'system',
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
}

export const notificationService = NotificationService.getInstance()