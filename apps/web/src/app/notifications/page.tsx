'use client'


// Force dynamic rendering to prevent static export
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Bell, Shield, AlertTriangle, TrendingUp, Mail, 
  Smartphone, Globe, Clock, Zap, Info, CheckCircle,
  Gauge, Volume2, VolumeX, Settings, Star, Building2,
  Loader2, RefreshCw, Trash2, Check, X
} from 'lucide-react'
import { AnimatedContainer } from '@/components/ui/animations'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { formatDuration, getTimeDiff } from '@inplain.ai/shared/utils'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import type { NotificationPreferences } from '@/lib/notifications/notification-service'

// Remove server-side metadata since this is now a client component

interface NotificationSetting {
  id: string
  title: string
  description: string
  icon: any
  enabled: boolean
  category: 'alerts' | 'email' | 'push' | 'advanced'
  premium?: boolean
}

// Simulated notification settings - in production this would come from the database
const defaultSettings: NotificationSetting[] = [
  // Alert Settings
  {
    id: 'critical-changes',
    title: 'Critical Privacy Changes',
    description: 'Get alerted for major privacy policy changes that significantly impact data collection or sharing',
    icon: AlertTriangle,
    enabled: true,
    category: 'alerts'
  },
  {
    id: 'data-collection',
    title: 'Data Collection Updates',
    description: 'Notifications when companies change what personal data they collect',
    icon: Shield,
    enabled: true,
    category: 'alerts'
  },
  {
    id: 'third-party-sharing',
    title: 'Third-Party Sharing Changes',
    description: 'Alerts when companies update their data sharing practices with partners',
    icon: Globe,
    enabled: false,
    category: 'alerts'
  },
  {
    id: 'risk-score',
    title: 'Risk Score Changes',
    description: 'Get notified when a company\'s privacy risk score changes significantly',
    icon: Gauge,
    enabled: true,
    category: 'alerts'
  },
  {
    id: 'compliance-updates',
    title: 'Compliance Updates',
    description: 'Notifications about GDPR, CCPA, and other regulatory compliance changes',
    icon: CheckCircle,
    enabled: false,
    category: 'alerts'
  },
  
  // Email Settings
  {
    id: 'daily-digest',
    title: 'Daily Digest',
    description: 'Receive a daily summary of all policy changes from your watchlist',
    icon: Mail,
    enabled: false,
    category: 'email'
  },
  {
    id: 'weekly-report',
    title: 'Weekly Report',
    description: 'Comprehensive weekly analysis of privacy trends and changes',
    icon: TrendingUp,
    enabled: true,
    category: 'email'
  },
  {
    id: 'monthly-insights',
    title: 'Monthly Insights',
    description: 'In-depth monthly report with AI-powered privacy insights',
    icon: Zap,
    enabled: false,
    category: 'email',
    premium: true
  },
  
  // Push Notifications
  {
    id: 'mobile-push',
    title: 'Mobile Push Notifications',
    description: 'Get instant alerts on your mobile device',
    icon: Smartphone,
    enabled: false,
    category: 'push'
  },
  {
    id: 'browser-push',
    title: 'Browser Notifications',
    description: 'Receive desktop notifications in your web browser',
    icon: Bell,
    enabled: true,
    category: 'push'
  },
  
  // Advanced Settings
  {
    id: 'quiet-hours',
    title: 'Quiet Hours',
    description: 'Pause notifications during specific hours (10 PM - 8 AM)',
    icon: Clock,
    enabled: false,
    category: 'advanced'
  },
  {
    id: 'sound-alerts',
    title: 'Sound Alerts',
    description: 'Play a sound for critical notifications',
    icon: Volume2,
    enabled: true,
    category: 'advanced'
  },
  {
    id: 'ai-summaries',
    title: 'AI-Generated Summaries',
    description: 'Include AI analysis in notification messages',
    icon: Zap,
    enabled: true,
    category: 'advanced',
    premium: true
  }
]

export default function NotificationsPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Use the notifications hook
  const {
    notifications,
    unreadCount,
    isConnected,
    isLoading,
    preferences,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
    updatePreferences,
    testNotification,
    refresh,
    requestDesktopPermission
  } = useNotifications()
  
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences | null>(null)
  
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/login')
    }
  }, [isLoaded, user, router])
  
  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences)
    }
  }, [preferences])
  
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  if (!user) {
    return null
  }
  
  const handlePreferenceChange = async (key: keyof NotificationPreferences, value: any) => {
    if (!localPreferences) return
    
    // If enabling desktop notifications, request permission first
    if (key === 'enableDesktop' && value === true) {
      const granted = await requestDesktopPermission()
      if (!granted) {
        toast({
          title: "Permission Denied",
          description: "Desktop notifications require browser permission. Please check your browser settings.",
          variant: "destructive",
        })
        return // Don't update the preference if permission was denied
      }
    }
    
    setLocalPreferences(prev => {
      if (!prev) return prev
      return { ...prev, [key]: value }
    })
    setHasChanges(true)
  }
  
  const handleSavePreferences = async () => {
    if (!localPreferences || !hasChanges) return
    
    setIsUpdating(true)
    try {
      await updatePreferences(localPreferences)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to update preferences:', error)
    } finally {
      setIsUpdating(false)
    }
  }
  
  const handleResetPreferences = () => {
    if (preferences) {
      setLocalPreferences(preferences)
      setHasChanges(false)
    }
  }

  const watchedCompaniesCount = localPreferences?.subscriptions.length || 0

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/5 to-background">
        <div className="container py-8">
          <AnimatedContainer animation="slideUp">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Notification Preferences</h1>
                <p className="text-muted-foreground mt-2">
                  Control how you receive updates about privacy policy changes
                </p>
              </div>
              <Badge variant="secondary" className="self-start">
                <Bell className="mr-1 h-4 w-4" />
                Monitoring {watchedCompaniesCount} companies
              </Badge>
            </div>
          </AnimatedContainer>
        </div>
      </div>

      <div className="container py-8 space-y-8">
        {/* Quick Actions */}
        <AnimatedContainer animation="fade" delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Manage your notification preferences with one click
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button 
                  variant="outline"
                  onClick={() => handlePreferenceChange('enableSound', !localPreferences?.enableSound)}
                >
                  {localPreferences?.enableSound ? (
                    <><VolumeX className="mr-2 h-4 w-4" /> Mute Sounds</>
                  ) : (
                    <><Volume2 className="mr-2 h-4 w-4" /> Enable Sounds</>
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={testNotification}
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Test Notification
                </Button>
                <Button 
                  variant="outline"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Mark All Read ({unreadCount})
                </Button>
                <Button 
                  variant="outline"
                  onClick={dismissAll}
                  disabled={notifications.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>

        {/* Notification Settings Tabs */}
        <AnimatedContainer animation="slideUp" delay={0.2}>
          <Tabs defaultValue="preferences" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="history">Notification History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="preferences" className="space-y-6">
              {/* Basic Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>
                    Control how you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Volume2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="space-y-1">
                        <Label htmlFor="sound">Sound Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Play a sound when new notifications arrive
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="sound"
                      checked={localPreferences?.enableSound ?? true}
                      onCheckedChange={(checked) => handlePreferenceChange('enableSound', checked)}
                    />
                  </div>
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="space-y-1">
                        <Label htmlFor="desktop">Desktop Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Show system notifications for important updates
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="desktop"
                      checked={localPreferences?.enableDesktop ?? true}
                      onCheckedChange={(checked) => handlePreferenceChange('enableDesktop', checked)}
                    />
                  </div>
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="space-y-1">
                        <Label htmlFor="toast">Toast Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Show in-app notification toasts
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="toast"
                      checked={localPreferences?.enableToast ?? true}
                      onCheckedChange={(checked) => handlePreferenceChange('enableToast', checked)}
                    />
                  </div>
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="space-y-1">
                        <Label htmlFor="email">Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive email alerts for critical changes
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="email"
                      checked={localPreferences?.enableEmail ?? false}
                      onCheckedChange={(checked) => handlePreferenceChange('enableEmail', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
              
              {/* Quiet Hours */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Quiet Hours
                  </CardTitle>
                  <CardDescription>
                    Pause non-critical notifications during specific hours
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
                    <Switch
                      id="quiet-hours"
                      checked={localPreferences?.quietHours.enabled ?? false}
                      onCheckedChange={(checked) => 
                        handlePreferenceChange('quietHours', {
                          ...localPreferences?.quietHours,
                          enabled: checked
                        })
                      }
                    />
                  </div>
                  
                  {localPreferences?.quietHours.enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="quiet-start">Start Time</Label>
                        <input
                          id="quiet-start"
                          type="time"
                          value={localPreferences?.quietHours.start || '22:00'}
                          onChange={(e) => 
                            handlePreferenceChange('quietHours', {
                              ...localPreferences?.quietHours,
                              start: e.target.value
                            })
                          }
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="quiet-end">End Time</Label>
                        <input
                          id="quiet-end"
                          type="time"
                          value={localPreferences?.quietHours.end || '07:00'}
                          onChange={(e) => 
                            handlePreferenceChange('quietHours', {
                              ...localPreferences?.quietHours,
                              end: e.target.value
                            })
                          }
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Recent Notifications</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refresh}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    View your notification history
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {notifications.length === 0 ? (
                    <div className="text-center py-8">
                      <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">No notifications yet</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={cn(
                              "p-4 rounded-lg border",
                              !notification.read && "bg-primary/5 border-primary/20"
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium">{notification.title}</h4>
                                  <Badge variant={notification.severity === 'critical' ? 'destructive' : 'secondary'}>
                                    {notification.severity}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  {formatDuration(getTimeDiff(notification.timestamp))} ago
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {!notification.read && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => markAsRead(notification.id)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => dismiss(notification.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </AnimatedContainer>


        {/* Company-Specific Settings */}
        <AnimatedContainer animation="slideUp" delay={0.6}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company-Specific Settings
              </CardTitle>
              <CardDescription>
                Customize notifications for individual companies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You can customize notification settings for each company in your watchlist.
                </p>
                <Button variant="outline" asChild>
                  <a href="/watchlist">
                    Manage Company Settings
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>

        {/* Save Button */}
        {hasChanges && (
          <AnimatedContainer animation="fade">
            <div className="flex justify-end gap-3 sticky bottom-4 bg-background/95 backdrop-blur p-4 rounded-lg border">
              <Button 
                variant="outline"
                onClick={handleResetPreferences}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSavePreferences}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  'Save Preferences'
                )}
              </Button>
            </div>
          </AnimatedContainer>
        )}

        {/* Info Box */}
        <AnimatedContainer animation="slideUp" delay={0.8}>
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4" />
                About Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                • Critical notifications are always enabled for major privacy policy changes that may impact your data.
              </p>
              <p>
                • Email digests are sent at 9 AM in your local timezone.
              </p>
              <p>
                • Push notifications require browser permissions. You'll be prompted when enabling them.
              </p>
              <p>
                • Premium features provide enhanced AI analysis and more detailed notifications.
              </p>
            </CardContent>
          </Card>
        </AnimatedContainer>
      </div>
    </div>
  )
}