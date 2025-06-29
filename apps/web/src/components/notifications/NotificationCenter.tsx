'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bell, X, Shield, AlertTriangle, Info, CheckCircle, 
  ExternalLink, Filter, Check, Settings, Volume2, VolumeX,
  Inbox, Clock, Building2, Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import { NotificationBell } from './NotificationBell'
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
    companySlug?: string
    changeType?: string
    riskLevel?: string
    policyType?: string
  }
}

interface NotificationCenterProps {
  notifications?: Notification[]
  onNotificationRead?: (id: string) => void
  onNotificationDismiss?: (id: string) => void
  onMarkAllRead?: () => void
  onClearAll?: () => void
  isConnected?: boolean
  enableSound?: boolean
  onSoundToggle?: (enabled: boolean) => void
}

export function NotificationCenter({
  notifications: externalNotifications = [],
  onNotificationRead,
  onNotificationDismiss,
  onMarkAllRead,
  onClearAll,
  isConnected = false,
  enableSound = true,
  onSoundToggle
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTab, setSelectedTab] = useState<'all' | 'unread'>('all')
  const [selectedTypes, setSelectedTypes] = useState<Set<Notification['type']>>(
    new Set(['policy-change', 'risk-alert', 'analysis-complete', 'system'])
  )
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Get unique companies from notifications
  const companies = useMemo(() => {
    const companySet = new Set<string>()
    externalNotifications.forEach(n => {
      if (n.metadata?.company) {
        companySet.add(n.metadata.company)
      }
    })
    return Array.from(companySet).sort()
  }, [externalNotifications])

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return externalNotifications.filter(notification => {
      // Tab filter
      if (selectedTab === 'unread' && notification.read) return false

      // Type filter
      if (!selectedTypes.has(notification.type)) return false

      // Company filter
      if (selectedCompanies.size > 0 && notification.metadata?.company) {
        if (!selectedCompanies.has(notification.metadata.company)) return false
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          notification.title.toLowerCase().includes(query) ||
          notification.message.toLowerCase().includes(query) ||
          notification.metadata?.company?.toLowerCase().includes(query)
        )
      }

      return true
    })
  }, [externalNotifications, selectedTab, selectedTypes, selectedCompanies, searchQuery])

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: Record<string, Notification[]> = {}
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()

    filteredNotifications.forEach(notification => {
      const date = new Date(notification.timestamp).toDateString()
      let groupKey = date

      if (date === today) groupKey = 'Today'
      else if (date === yesterday) groupKey = 'Yesterday'

      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(notification)
    })

    return groups
  }, [filteredNotifications])

  const unreadCount = externalNotifications.filter(n => !n.read).length

  // Play notification sound for new critical notifications
  useEffect(() => {
    if (enableSound && audioRef.current) {
      const hasCriticalUnread = externalNotifications.some(
        n => n.severity === 'critical' && !n.read
      )
      if (hasCriticalUnread) {
        audioRef.current.play().catch(e => console.log('Audio play failed:', e))
      }
    }
  }, [externalNotifications, enableSound])

  const handleTypeToggle = (type: Notification['type']) => {
    const newTypes = new Set(selectedTypes)
    if (newTypes.has(type)) {
      newTypes.delete(type)
    } else {
      newTypes.add(type)
    }
    setSelectedTypes(newTypes)
  }

  const handleCompanyToggle = (company: string) => {
    const newCompanies = new Set(selectedCompanies)
    if (newCompanies.has(company)) {
      newCompanies.delete(company)
    } else {
      newCompanies.add(company)
    }
    setSelectedCompanies(newCompanies)
  }

  const getIcon = (type: Notification['type'], severity: Notification['severity']) => {
    if (type === 'policy-change') return Shield
    if (severity === 'critical') return AlertTriangle
    if (severity === 'success') return CheckCircle
    return Info
  }

  const getSeverityColor = (severity: Notification['severity']) => {
    switch (severity) {
      case 'critical': return 'text-red-600 dark:text-red-400'
      case 'warning': return 'text-amber-600 dark:text-amber-400'
      case 'success': return 'text-green-600 dark:text-green-400'
      default: return 'text-blue-600 dark:text-blue-400'
    }
  }

  const getTypeLabel = (type: Notification['type']) => {
    switch (type) {
      case 'policy-change': return 'Policy Changes'
      case 'risk-alert': return 'Risk Alerts'
      case 'analysis-complete': return 'Analysis Complete'
      case 'system': return 'System'
      default: return type
    }
  }

  return (
    <>
      {/* Hidden audio element for notification sounds */}
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      {/* Notification Bell Button */}
      <NotificationBell
        unreadCount={unreadCount}
        onClick={() => setIsOpen(!isOpen)}
        isConnected={isConnected}
      />

      {/* Notification Center Panel */}
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
              className="absolute top-14 right-4 z-50 w-[28rem] max-h-[80vh] overflow-hidden"
            >
              <Card className="shadow-2xl border-muted">
                {/* Header */}
                <div className="p-4 border-b bg-background/95 backdrop-blur">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">Notifications</h3>
                      {unreadCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {unreadCount} new
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Sound toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onSoundToggle?.(!enableSound)}
                      >
                        {enableSound ? (
                          <Volume2 className="h-4 w-4" />
                        ) : (
                          <VolumeX className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Filter menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Filter className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {(['policy-change', 'risk-alert', 'analysis-complete', 'system'] as const).map(type => (
                            <DropdownMenuCheckboxItem
                              key={type}
                              checked={selectedTypes.has(type)}
                              onCheckedChange={() => handleTypeToggle(type)}
                            >
                              {getTypeLabel(type)}
                            </DropdownMenuCheckboxItem>
                          ))}
                          {companies.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>Filter by Company</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {companies.slice(0, 5).map(company => (
                                <DropdownMenuCheckboxItem
                                  key={company}
                                  checked={selectedCompanies.has(company)}
                                  onCheckedChange={() => handleCompanyToggle(company)}
                                >
                                  {company}
                                </DropdownMenuCheckboxItem>
                              ))}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Actions menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {unreadCount > 0 && (
                            <DropdownMenuItem onClick={onMarkAllRead}>
                              <Check className="h-4 w-4 mr-2" />
                              Mark all as read
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={onClearAll}>
                            <X className="h-4 w-4 mr-2" />
                            Clear all
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => window.location.href = '/settings#notifications'}>
                            <Settings className="h-4 w-4 mr-2" />
                            Notification settings
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search notifications..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>

                {/* Tabs */}
                <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'all' | 'unread')}>
                  <TabsList className="grid w-full grid-cols-2 p-0 h-10 bg-muted/50">
                    <TabsTrigger value="all" className="rounded-none">All</TabsTrigger>
                    <TabsTrigger value="unread" className="rounded-none">
                      Unread {unreadCount > 0 && `(${unreadCount})`}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value={selectedTab} className="mt-0">
                    <ScrollArea className="h-[calc(80vh-12rem)]">
                      {Object.keys(groupedNotifications).length === 0 ? (
                        <div className="p-8 text-center">
                          <Inbox className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-muted-foreground">
                            {selectedTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                          </p>
                          <p className="text-sm text-muted-foreground/70 mt-1">
                            We'll notify you when something important happens
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {Object.entries(groupedNotifications).map(([date, notifications]) => (
                            <div key={date}>
                              <div className="px-4 py-2 bg-muted/50 sticky top-0 z-10">
                                <p className="text-xs font-medium text-muted-foreground">{date}</p>
                              </div>
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
                                    onClick={() => onNotificationRead?.(notification.id)}
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
                                              onNotificationDismiss?.(notification.id)
                                            }}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        
                                        <p className="text-sm text-muted-foreground">
                                          {notification.message}
                                        </p>
                                        
                                        {notification.metadata && (
                                          <div className="flex items-center gap-2 mt-2">
                                            {notification.metadata.company && (
                                              <Badge variant="outline" className="text-xs">
                                                <Building2 className="h-3 w-3 mr-1" />
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
                                            {notification.metadata.policyType && (
                                              <Badge variant="secondary" className="text-xs">
                                                {notification.metadata.policyType}
                                              </Badge>
                                            )}
                                          </div>
                                        )}
                                        
                                        <div className="flex items-center justify-between mt-2">
                                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
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
                                                } else if (notification.action?.href) {
                                                  window.location.href = notification.action.href
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
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}