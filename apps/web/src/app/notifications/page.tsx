import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { 
  Bell, Shield, AlertTriangle, TrendingUp, Mail, 
  Smartphone, Globe, Clock, Zap, Info, CheckCircle,
  Gauge, Volume2, VolumeX, Settings, Star, Building2
} from 'lucide-react'
import { AnimatedContainer } from '@/components/ui/animations'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

export const metadata = {
  title: 'Notification Preferences - Inplain.AI',
  description: 'Manage your privacy policy change notifications and alerts',
}

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

export default async function NotificationsPage() {
  const { userId } = await auth()
  
  if (!userId) {
    redirect('/login')
  }

  // In production, these would be fetched from the database
  const settings = defaultSettings
  const watchedCompaniesCount = WATCHED_COMPANIES.filter(() => Math.random() > 0.3).length

  const alertSettings = settings.filter(s => s.category === 'alerts')
  const emailSettings = settings.filter(s => s.category === 'email')
  const pushSettings = settings.filter(s => s.category === 'push')
  const advancedSettings = settings.filter(s => s.category === 'advanced')

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
                <Button variant="outline">
                  <VolumeX className="mr-2 h-4 w-4" />
                  Pause All Notifications
                </Button>
                <Button variant="outline">
                  <Bell className="mr-2 h-4 w-4" />
                  Enable Critical Only
                </Button>
                <Button variant="outline">
                  <Settings className="mr-2 h-4 w-4" />
                  Reset to Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>

        {/* Alert Settings */}
        <AnimatedContainer animation="slideUp" delay={0.2}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alert Types
              </CardTitle>
              <CardDescription>
                Choose which types of privacy changes trigger notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {alertSettings.map((setting) => {
                const Icon = setting.icon
                return (
                  <div key={setting.id} className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="space-y-1">
                        <Label htmlFor={setting.id} className="flex items-center gap-2">
                          {setting.title}
                          {setting.premium && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="mr-1 h-3 w-3" />
                              Premium
                            </Badge>
                          )}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={setting.id}
                      defaultChecked={setting.enabled}
                      disabled={setting.premium}
                    />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </AnimatedContainer>

        {/* Email Preferences */}
        <AnimatedContainer animation="slideUp" delay={0.3}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Notifications
              </CardTitle>
              <CardDescription>
                Configure email alerts and digests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {emailSettings.map((setting) => {
                const Icon = setting.icon
                return (
                  <div key={setting.id} className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="space-y-1">
                        <Label htmlFor={setting.id} className="flex items-center gap-2">
                          {setting.title}
                          {setting.premium && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="mr-1 h-3 w-3" />
                              Premium
                            </Badge>
                          )}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={setting.id}
                      defaultChecked={setting.enabled}
                      disabled={setting.premium}
                    />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </AnimatedContainer>

        {/* Push Notifications */}
        <AnimatedContainer animation="slideUp" delay={0.4}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Push Notifications
              </CardTitle>
              <CardDescription>
                Real-time alerts on your devices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {pushSettings.map((setting) => {
                const Icon = setting.icon
                return (
                  <div key={setting.id} className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="space-y-1">
                        <Label htmlFor={setting.id}>{setting.title}</Label>
                        <p className="text-sm text-muted-foreground">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={setting.id}
                      defaultChecked={setting.enabled}
                    />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </AnimatedContainer>

        {/* Advanced Settings */}
        <AnimatedContainer animation="slideUp" delay={0.5}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Advanced Settings
              </CardTitle>
              <CardDescription>
                Fine-tune your notification experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {advancedSettings.map((setting) => {
                const Icon = setting.icon
                return (
                  <div key={setting.id} className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="space-y-1">
                        <Label htmlFor={setting.id} className="flex items-center gap-2">
                          {setting.title}
                          {setting.premium && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="mr-1 h-3 w-3" />
                              Premium
                            </Badge>
                          )}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={setting.id}
                      defaultChecked={setting.enabled}
                      disabled={setting.premium}
                    />
                  </div>
                )
              })}
            </CardContent>
          </Card>
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
        <AnimatedContainer animation="fade" delay={0.7}>
          <div className="flex justify-end gap-3">
            <Button variant="outline">Cancel</Button>
            <Button>Save Preferences</Button>
          </div>
        </AnimatedContainer>

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