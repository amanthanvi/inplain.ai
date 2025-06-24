'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, Shield, AlertTriangle, Info, CheckCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { HoverScale } from '@/components/ui/framer-animations'
import { cn } from '@/lib/utils'
import { formatDuration, getTimeDiff } from '@inplain.ai/shared/utils'

export interface Notification {
  id: string
  type: 'policy-change' | 'risk-alert' | 'analysis-complete' | 'system'
  severity: 'critical' | 'warning' | 'info' | 'success'
  title: string
  message: string
  timestamp: string
  read: boolean
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  metadata?: {
    company?: string
    changeType?: string
    riskLevel?: string
  }
}

interface NotificationCenterProps {
  notifications?: Notification[]
  onNotificationRead?: (id: string) => void
  onNotificationDismiss?: (id: string) => void
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  maxVisible?: number
}

export function NotificationCenter({
  notifications: externalNotifications,
  onNotificationRead,
  onNotificationDismiss,
  position = 'top-right',
  maxVisible = 5
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>(externalNotifications || [])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (externalNotifications) {
      setNotifications(externalNotifications)
    }
  }, [externalNotifications])

  useEffect(() => {
    const count = notifications.filter(n => !n.read).length
    setUnreadCount(count)
    
    // Play sound for new critical notifications
    if (count > unreadCount && notifications.some(n => n.severity === 'critical' && !n.read)) {
      playNotificationSound()
    }
  }, [notifications])

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e))
    }
  }

  const handleRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
    onNotificationRead?.(id)
  }

  const handleDismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    onNotificationDismiss?.(id)
  }

  const handleDismissAll = () => {
    const ids = notifications.map(n => n.id)
    setNotifications([])
    ids.forEach(id => onNotificationDismiss?.(id))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    notifications.forEach(n => {
      if (!n.read) onNotificationRead?.(n.id)
    })
  }

  const getIcon = (type: string, severity: string) => {
    if (type === 'policy-change') return Shield
    if (severity === 'critical') return AlertTriangle
    if (severity === 'success') return CheckCircle
    return Info
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 dark:text-red-400'
      case 'warning': return 'text-amber-600 dark:text-amber-400'
      case 'success': return 'text-green-600 dark:text-green-400'
      default: return 'text-blue-600 dark:text-blue-400'
    }
  }

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  }

  // Recent notifications to show as toasts
  const recentNotifications = notifications
    .filter(n => !n.read)
    .slice(0, maxVisible)

  return (
    <>
      {/* Hidden audio element for notification sounds */}
      <audio ref={audioRef} src="/notification.mp3" />

      {/* Notification Bell Button */}
      <HoverScale>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1"
              >
                <Badge className="h-5 w-5 p-0 flex items-center justify-center badge-gradient">
                  {unreadCount}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </HoverScale>

      {/* Notification Center Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Notification Panel */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-12 right-0 z-50 w-96 max-h-[600px] overflow-hidden"
            >
              <Card className="glass-card shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Notifications</h3>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={markAllAsRead}
                          className="text-xs"
                        >
                          Mark all read
                        </Button>
                      )}
                      {notifications.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDismissAll}
                          className="text-xs"
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-[500px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">No notifications yet</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        We'll notify you when something important happens
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map((notification, index) => {
                        const Icon = getIcon(notification.type, notification.severity)
                        
                        return (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                              "p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                              !notification.read && "bg-primary/5"
                            )}
                            onClick={() => handleRead(notification.id)}
                          >
                            <div className="flex gap-3">
                              <div className={cn(
                                "flex-shrink-0 mt-0.5",
                                getSeverityColor(notification.severity)
                              )}>
                                <Icon className="h-5 w-5" />
                              </div>
                              
                              <div className="flex-1 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-medium text-sm">
                                    {notification.title}
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 -mt-1 -mr-2"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDismiss(notification.id)
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                
                                <p className="text-sm text-muted-foreground">
                                  {notification.message}
                                </p>
                                
                                {notification.metadata && (
                                  <div className="flex gap-2 mt-2">
                                    {notification.metadata.company && (
                                      <Badge variant="secondary" className="text-xs">
                                        {notification.metadata.company}
                                      </Badge>
                                    )}
                                    {notification.metadata.changeType && (
                                      <Badge 
                                        variant={
                                          notification.metadata.changeType === 'major' ? 'destructive' :
                                          notification.metadata.changeType === 'moderate' ? 'warning' : 
                                          'secondary'
                                        } 
                                        className="text-xs"
                                      >
                                        {notification.metadata.changeType}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs text-muted-foreground">
                                    {formatDuration(getTimeDiff(notification.timestamp))} ago
                                  </span>
                                  
                                  {notification.action && (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="h-auto p-0 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (notification.action?.onClick) {
                                          notification.action.onClick()
                                        }
                                      }}
                                    >
                                      {notification.action.label}
                                      {notification.action.href && (
                                        <ExternalLink className="h-3 w-3 ml-1" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <div className={cn("fixed z-50", positionClasses[position])}>
        <AnimatePresence>
          {recentNotifications.map((notification, index) => {
            const Icon = getIcon(notification.type, notification.severity)
            
            return (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, y: 50, scale: 0.3 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="mb-3"
              >
                <Card className={cn(
                  "glass-card w-80 shadow-xl cursor-pointer",
                  "hover:shadow-2xl transition-shadow",
                  notification.severity === 'critical' && "ring-2 ring-red-500"
                )}>
                  <div 
                    className="p-4"
                    onClick={() => handleRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className={cn(
                        "flex-shrink-0",
                        getSeverityColor(notification.severity)
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm">
                            {notification.title}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 -mt-1 -mr-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDismiss(notification.id)
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        
                        {notification.action && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs mt-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (notification.action?.onClick) {
                                notification.action.onClick()
                              }
                            }}
                          >
                            {notification.action.label} →
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </>
  )
}