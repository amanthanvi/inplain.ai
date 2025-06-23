'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Activity, TrendingUp, Shield, Eye, AlertTriangle,
  Clock, Users, Globe, Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, getTimeDiff } from '@policydiff/shared/utils'
import { HoverScale, FloatingElement } from '@/components/ui/framer-animations'

interface ActivityItem {
  id: string
  type: 'policy-update' | 'user-analysis' | 'risk-alert' | 'new-monitoring' | 'system'
  timestamp: string
  title: string
  description: string
  icon?: any
  color?: string
  metadata?: {
    company?: string
    user?: {
      name: string
      avatar?: string
    }
    changeType?: string
    riskLevel?: string
    location?: string
  }
}

interface LiveActivityFeedProps {
  maxItems?: number
  showGlobalActivity?: boolean
  filterTypes?: ActivityItem['type'][]
}

export function LiveActivityFeed({
  maxItems = 10,
  showGlobalActivity = true,
  filterTypes
}: LiveActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [isLive, setIsLive] = useState(true)
  
  // Generate mock activity data
  const generateActivity = (): ActivityItem => {
    const types: ActivityItem['type'][] = ['policy-update', 'user-analysis', 'risk-alert', 'new-monitoring', 'system']
    const companies = ['Google', 'Meta', 'Amazon', 'Microsoft', 'Apple', 'Netflix', 'Spotify', 'Twitter']
    const locations = ['San Francisco, CA', 'New York, NY', 'London, UK', 'Tokyo, JP', 'Berlin, DE']
    const userNames = ['Alex Chen', 'Sarah Johnson', 'Mike Wilson', 'Emma Davis', 'John Smith']
    
    const type = types[Math.floor(Math.random() * types.length)]
    
    const activityTemplates = {
      'policy-update': {
        title: `${companies[Math.floor(Math.random() * companies.length)]} updated their privacy policy`,
        description: 'Changes detected in data collection practices',
        icon: Shield,
        color: 'text-blue-600'
      },
      'user-analysis': {
        title: 'New AI analysis requested',
        description: `Premium analysis for ${companies[Math.floor(Math.random() * companies.length)]}`,
        icon: Eye,
        color: 'text-purple-600'
      },
      'risk-alert': {
        title: 'High-risk changes detected',
        description: `Critical privacy changes in ${companies[Math.floor(Math.random() * companies.length)]} policy`,
        icon: AlertTriangle,
        color: 'text-red-600'
      },
      'new-monitoring': {
        title: 'New company added to monitoring',
        description: `Started tracking ${companies[Math.floor(Math.random() * companies.length)]}`,
        icon: TrendingUp,
        color: 'text-green-600'
      },
      'system': {
        title: 'System update',
        description: 'AI models upgraded for better analysis accuracy',
        icon: Zap,
        color: 'text-amber-600'
      }
    }
    
    const template = activityTemplates[type]
    
    return {
      id: `activity-${Date.now()}-${Math.random()}`,
      type,
      timestamp: new Date().toISOString(),
      title: template.title,
      description: template.description,
      icon: template.icon,
      color: template.color,
      metadata: {
        company: companies[Math.floor(Math.random() * companies.length)],
        user: showGlobalActivity ? {
          name: userNames[Math.floor(Math.random() * userNames.length)]
        } : undefined,
        changeType: type === 'policy-update' ? ['major', 'moderate', 'minor'][Math.floor(Math.random() * 3)] : undefined,
        riskLevel: type === 'risk-alert' ? 'high' : undefined,
        location: showGlobalActivity ? locations[Math.floor(Math.random() * locations.length)] : undefined
      }
    }
  }
  
  // Simulate real-time activity stream
  useEffect(() => {
    if (!isLive) return
    
    // Add initial activities
    const initialActivities = Array.from({ length: 5 }, generateActivity)
    setActivities(initialActivities)
    
    // Add new activity every 3-10 seconds
    const interval = setInterval(() => {
      const shouldAddActivity = Math.random() < 0.3 // 30% chance
      if (shouldAddActivity) {
        const newActivity = generateActivity()
        
        // Apply filters if specified
        if (filterTypes && !filterTypes.includes(newActivity.type)) {
          return
        }
        
        setActivities(prev => [newActivity, ...prev].slice(0, maxItems))
      }
    }, 3000)
    
    return () => clearInterval(interval)
  }, [isLive, maxItems, showGlobalActivity, filterTypes])
  
  const getActivityStats = () => {
    const last24h = activities.filter(a => {
      const hoursDiff = (Date.now() - new Date(a.timestamp).getTime()) / (1000 * 60 * 60)
      return hoursDiff <= 24
    })
    
    return {
      total: last24h.length,
      updates: last24h.filter(a => a.type === 'policy-update').length,
      alerts: last24h.filter(a => a.type === 'risk-alert').length,
      analyses: last24h.filter(a => a.type === 'user-analysis').length
    }
  }
  
  const stats = getActivityStats()
  
  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FloatingElement>
              <Activity className="h-5 w-5 text-primary" />
            </FloatingElement>
            <CardTitle>Live Activity Feed</CardTitle>
            {isLive && (
              <Badge variant="secondary" className="animate-pulse">
                <div className="h-2 w-2 rounded-full bg-green-500 mr-1.5" />
                Live
              </Badge>
            )}
          </div>
          
          {/* Activity stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{stats.total} today</span>
            </div>
            {showGlobalActivity && (
              <div className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <span>Global</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-px bg-border">
          <div className="bg-background p-3 text-center">
            <div className="text-2xl font-bold gradient-text">{stats.updates}</div>
            <div className="text-xs text-muted-foreground">Policy Updates</div>
          </div>
          <div className="bg-background p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.alerts}</div>
            <div className="text-xs text-muted-foreground">Risk Alerts</div>
          </div>
          <div className="bg-background p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.analyses}</div>
            <div className="text-xs text-muted-foreground">AI Analyses</div>
          </div>
        </div>
        
        {/* Activity stream */}
        <div className="max-h-[400px] overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {activities.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-8 text-center"
              >
                <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Activity will appear here as it happens
                </p>
              </motion.div>
            ) : (
              <div className="divide-y">
                {activities.map((activity, index) => {
                  const Icon = activity.icon || Activity
                  const isNew = index === 0 && activities.length > 1
                  
                  return (
                    <motion.div
                      key={activity.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ 
                        type: "spring",
                        stiffness: 500,
                        damping: 30
                      }}
                      className={cn(
                        "p-4 hover:bg-muted/50 transition-colors",
                        isNew && "bg-primary/5"
                      )}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className={cn("flex-shrink-0 mt-0.5", activity.color)}>
                          <HoverScale scale={1.1}>
                            <div className="h-8 w-8 rounded-lg bg-current/10 flex items-center justify-center">
                              <Icon className="h-4 w-4" />
                            </div>
                          </HoverScale>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {activity.title}
                              </p>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {activity.description}
                              </p>
                              
                              {/* Metadata */}
                              <div className="flex items-center gap-3 mt-2">
                                {activity.metadata?.user && showGlobalActivity && (
                                  <div className="flex items-center gap-1.5">
                                    <Avatar className="h-4 w-4">
                                      <AvatarImage src={activity.metadata.user.avatar} />
                                      <AvatarFallback className="text-[8px]">
                                        {activity.metadata.user.name.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-muted-foreground">
                                      {activity.metadata.user.name}
                                    </span>
                                  </div>
                                )}
                                
                                {activity.metadata?.location && (
                                  <span className="text-xs text-muted-foreground">
                                    {activity.metadata.location}
                                  </span>
                                )}
                                
                                {activity.metadata?.changeType && (
                                  <Badge 
                                    variant={
                                      activity.metadata.changeType === 'major' ? 'destructive' :
                                      activity.metadata.changeType === 'moderate' ? 'warning' : 
                                      'secondary'
                                    } 
                                    className="text-xs h-5"
                                  >
                                    {activity.metadata.changeType}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            {/* Timestamp */}
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDuration(getTimeDiff(activity.timestamp))} ago
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}