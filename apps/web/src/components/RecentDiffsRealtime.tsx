'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getRecentDiffs } from '@/lib/api'
import { formatDuration, getTimeDiff } from '@inplain.ai/shared/utils'
import { 
  FadeIn, SlideIn, ScaleIn, HoverScale, 
  FloatingElement, PulseAnimation 
} from '@/components/ui/framer-animations'
import { Bell, TrendingUp, AlertCircle, Activity, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RecentDiffsRealtimeProps {
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number
  showNotifications?: boolean
}

interface DiffItem {
  company: {
    slug: string
    name: string
    logo?: string
  }
  diff: {
    id: string
    changeType: 'major' | 'moderate' | 'minor'
    additions: number
    deletions: number
    createdAt: string
    summary?: string
    riskLevel?: 'high' | 'medium' | 'low'
  }
}

export function RecentDiffsRealtime({ 
  limit = 5, 
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
  showNotifications = true 
}: RecentDiffsRealtimeProps) {
  const [diffs, setDiffs] = useState<DiffItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newDiffs, setNewDiffs] = useState<string[]>([])
  const [liveIndicator, setLiveIndicator] = useState(false)
  const previousDiffsRef = useRef<string[]>([])
  const notificationTimeoutRef = useRef<NodeJS.Timeout>()

  const fetchRecentDiffs = async () => {
    try {
      setLiveIndicator(true)
      const results = await getRecentDiffs(limit)
      
      // Check for new diffs
      const currentDiffIds = results.map((d: DiffItem) => d.diff.id)
      const newDiffIds = currentDiffIds.filter(
        (id: string) => !previousDiffsRef.current.includes(id)
      )
      
      if (newDiffIds.length > 0 && previousDiffsRef.current.length > 0) {
        setNewDiffs(newDiffIds)
        
        // Clear notification after 5 seconds
        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current)
        }
        notificationTimeoutRef.current = setTimeout(() => {
          setNewDiffs([])
        }, 5000)
      }
      
      previousDiffsRef.current = currentDiffIds
      setDiffs(results)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch recent diffs:', error)
    } finally {
      setTimeout(() => setLiveIndicator(false), 1000)
    }
  }

  useEffect(() => {
    fetchRecentDiffs()
    
    if (autoRefresh) {
      const interval = setInterval(fetchRecentDiffs, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [limit, autoRefresh, refreshInterval])

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'major':
        return <AlertCircle className="h-4 w-4" />
      case 'moderate':
        return <TrendingUp className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getRiskColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'high':
        return 'text-red-600 dark:text-red-400'
      case 'medium':
        return 'text-amber-600 dark:text-amber-400'
      case 'low':
        return 'text-green-600 dark:text-green-400'
      default:
        return 'text-muted-foreground'
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="h-6 bg-gradient-to-r from-muted to-muted/50 rounded w-1/3 mb-2 animate-shimmer" />
                <div className="h-4 bg-gradient-to-r from-muted to-muted/50 rounded w-1/2 animate-shimmer" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-gradient-to-r from-muted to-muted/50 rounded animate-shimmer" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    )
  }

  if (diffs.length === 0) {
    return (
      <FadeIn>
        <Card className="glass-card">
          <CardContent className="text-center py-12">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <Activity className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No recent policy changes detected</p>
            <p className="text-sm text-muted-foreground/70 mt-2">
              We're monitoring policies 24/7 and will notify you of any changes
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    )
  }

  return (
    <div className="space-y-4">
      {/* Live indicator and notifications */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {liveIndicator && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2"
              >
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">Live</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <AnimatePresence>
          {showNotifications && newDiffs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-2"
            >
              <PulseAnimation>
                <Badge className="badge-gradient">
                  <Bell className="h-3 w-3 mr-1" />
                  {newDiffs.length} new change{newDiffs.length > 1 ? 's' : ''}
                </Badge>
              </PulseAnimation>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Diff cards */}
      <AnimatePresence mode="popLayout">
        {diffs.map((item, index) => {
          const isNew = newDiffs.includes(item.diff.id)
          
          return (
            <motion.div
              key={item.diff.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                delay: index * 0.05,
                layout: { type: "spring", stiffness: 300, damping: 30 }
              }}
            >
              <HoverScale>
                <Link href={`/${item.company.slug}`}>
                  <Card className={cn(
                    "glass-card cursor-pointer transition-all duration-300",
                    "hover:shadow-xl hover:border-primary/50",
                    isNew && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-xl">
                              {item.company.name}
                            </CardTitle>
                            {isNew && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 500 }}
                              >
                                <Badge variant="default" className="badge-gradient">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  New
                                </Badge>
                              </motion.div>
                            )}
                          </div>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <span>{formatDuration(getTimeDiff(item.diff.createdAt))} ago</span>
                            {item.diff.riskLevel && (
                              <>
                                <span>•</span>
                                <span className={getRiskColor(item.diff.riskLevel)}>
                                  {item.diff.riskLevel} risk
                                </span>
                              </>
                            )}
                          </CardDescription>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {item.diff.changeType && (
                            <Badge 
                              variant={
                                item.diff.changeType === 'major' ? 'destructive' :
                                item.diff.changeType === 'moderate' ? 'warning' : 'secondary'
                              }
                              className="flex items-center gap-1"
                            >
                              {getChangeIcon(item.diff.changeType)}
                              {item.diff.changeType}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="space-y-3">
                        {/* Change metrics */}
                        <div className="flex gap-4 text-sm">
                          <motion.span 
                            className="flex items-center gap-1 text-green-600 dark:text-green-400"
                            whileHover={{ scale: 1.05 }}
                          >
                            <span className="font-medium">+{item.diff.additions || 0}</span>
                            <span className="text-muted-foreground">additions</span>
                          </motion.span>
                          <motion.span 
                            className="flex items-center gap-1 text-red-600 dark:text-red-400"
                            whileHover={{ scale: 1.05 }}
                          >
                            <span className="font-medium">-{item.diff.deletions || 0}</span>
                            <span className="text-muted-foreground">deletions</span>
                          </motion.span>
                        </div>
                        
                        {/* Summary preview */}
                        {item.diff.summary && (
                          <motion.p 
                            className="text-sm text-muted-foreground line-clamp-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                          >
                            {item.diff.summary}
                          </motion.p>
                        )}
                        
                        {/* Visual change indicator */}
                        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-red-500"
                            initial={{ width: 0 }}
                            animate={{ 
                              width: `${((item.diff.additions || 0) / ((item.diff.additions || 0) + (item.diff.deletions || 0))) * 100}%` 
                            }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </HoverScale>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}