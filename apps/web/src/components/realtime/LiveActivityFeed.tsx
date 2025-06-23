'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Activity, TrendingUp, Shield, Eye, AlertTriangle,
  Clock, Users, Globe, Zap, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, getTimeDiff } from '@policydiff/shared/utils'
import { HoverScale, FloatingElement } from '@/components/ui/framer-animations'
import { Button } from '@/components/ui/button'

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
    riskScore?: number
    location?: string
    slug?: string
    diffId?: string
    aiSummary?: string
    highlights?: string[]
    categories?: string[]
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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Fetch real activity data from API
  const fetchActivities = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Build query params
      const params = new URLSearchParams({
        limit: maxItems.toString(),
        includeAI: 'true',
        includeRisk: 'true',
        includeUsers: showGlobalActivity ? 'true' : 'false'
      })
      
      const response = await fetch(`/api/activity?${params}`)
      if (!response.ok) throw new Error('Failed to fetch activities')
      
      const data = await response.json()
      
      // Map icon types
      const iconMap: Record<string, any> = {
        'policy-update': Shield,
        'risk-alert': AlertTriangle,
        'user-analysis': Users,
        'new-monitoring': Eye,
        'system': Zap
      }
      
      // Transform activities with proper icons and enhanced metadata
      const transformedActivities: ActivityItem[] = data.activities.map((activity: any) => ({
        ...activity,
        icon: iconMap[activity.type] || Activity,
        // Enhance metadata with risk-based styling
        color: activity.color || (
          activity.metadata?.riskLevel === 'critical' ? 'text-red-600' :
          activity.metadata?.riskLevel === 'high' ? 'text-orange-600' :
          activity.metadata?.riskLevel === 'medium' ? 'text-yellow-600' :
          activity.type === 'risk-alert' ? 'text-red-600' :
          activity.type === 'user-analysis' ? 'text-purple-600' :
          activity.type === 'new-monitoring' ? 'text-green-600' :
          'text-blue-600'
        )
      }))
      
      // Apply filters if specified
      const filteredActivities = filterTypes 
        ? transformedActivities.filter(a => filterTypes.includes(a.type))
        : transformedActivities
      
      setActivities(filteredActivities)
    } catch (err) {
      console.error('Error fetching activities:', err)
      setError(err instanceof Error ? err.message : 'Failed to load activities')
    } finally {
      setIsLoading(false)
    }
  }, [maxItems, filterTypes, showGlobalActivity])
  
  // Fetch initial data and set up polling
  useEffect(() => {
    if (!isLive) return
    
    // Initial fetch
    fetchActivities()
    
    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      fetchActivities()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [isLive, fetchActivities])
  
  const handleRefresh = () => {
    fetchActivities()
  }
  
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
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8 px-2"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          
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
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-8 text-center"
              >
                <RefreshCw className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3 animate-spin" />
                <p className="text-muted-foreground">Loading activities...</p>
              </motion.div>
            ) : error ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-8 text-center"
              >
                <AlertTriangle className="h-12 w-12 text-red-500/30 mx-auto mb-3" />
                <p className="text-muted-foreground">{error}</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleRefresh}
                  className="mt-2"
                >
                  Try again
                </Button>
              </motion.div>
            ) : activities.length === 0 ? (
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
                              
                              {/* AI Summary if available */}
                              {activity.metadata?.aiSummary && (
                                <div className="mt-2 p-2 bg-muted/50 rounded-md">
                                  <p className="text-xs text-muted-foreground">
                                    <span className="font-medium">AI Analysis:</span> {activity.metadata.aiSummary}
                                  </p>
                                </div>
                              )}
                              
                              {/* Key highlights */}
                              {activity.metadata?.highlights && activity.metadata.highlights.length > 0 && (
                                <ul className="mt-2 space-y-0.5">
                                  {activity.metadata.highlights.slice(0, 2).map((highlight, idx) => (
                                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                                      <span className="text-primary mt-0.5">•</span>
                                      <span>{highlight}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              
                              {/* View Details Link */}
                              {activity.metadata?.slug && (
                                <a 
                                  href={`/${activity.metadata.slug}`}
                                  className="text-xs text-primary hover:underline mt-1 inline-block"
                                >
                                  View details →
                                </a>
                              )}
                              
                              {/* Metadata */}
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
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
                                
                                {activity.metadata?.riskScore !== undefined && (
                                  <Badge 
                                    variant={
                                      activity.metadata.riskScore >= 75 ? 'destructive' :
                                      activity.metadata.riskScore >= 50 ? 'warning' : 
                                      'secondary'
                                    } 
                                    className="text-xs h-5"
                                  >
                                    Risk: {activity.metadata.riskScore}/100
                                  </Badge>
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
                                
                                {activity.metadata?.categories && activity.metadata.categories.length > 0 && (
                                  <div className="flex gap-1">
                                    {activity.metadata.categories.slice(0, 2).map((category, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs h-5">
                                        {category.replace(/_/g, ' ')}
                                      </Badge>
                                    ))}
                                  </div>
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