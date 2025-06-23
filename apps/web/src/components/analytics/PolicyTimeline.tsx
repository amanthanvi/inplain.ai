'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Calendar, Clock, AlertTriangle, TrendingUp, Eye,
  ChevronDown, ChevronRight, Filter, Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SlideIn, FadeIn, HoverScale } from '@/components/ui/framer-animations'
import { formatDuration, getTimeDiff } from '@policydiff/shared/utils'

interface TimelineEvent {
  id: string
  date: string
  company: string
  type: 'policy-update' | 'risk-change' | 'new-monitoring' | 'alert'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  changes?: {
    added: string[]
    removed: string[]
    modified: string[]
  }
  riskImpact?: {
    before: number
    after: number
  }
  tags: string[]
}

const mockEvents: TimelineEvent[] = [
  {
    id: '1',
    date: '2024-01-15T10:30:00Z',
    company: 'Meta',
    type: 'policy-update',
    title: 'Major Privacy Policy Update',
    description: 'Updated data collection practices for Instagram and Facebook',
    severity: 'high',
    changes: {
      added: ['Biometric data collection', 'Cross-platform tracking'],
      removed: ['User data download limits'],
      modified: ['Data retention periods', 'Third-party sharing clauses']
    },
    riskImpact: { before: 4.2, after: 3.8 },
    tags: ['GDPR', 'Data Collection', 'Cross-platform']
  },
  {
    id: '2',
    date: '2024-01-12T14:20:00Z',
    company: 'Google',
    type: 'risk-change',
    title: 'Risk Score Update',
    description: 'Improved transparency in data usage policies',
    severity: 'medium',
    riskImpact: { before: 6.5, after: 6.8 },
    tags: ['Transparency', 'Data Usage']
  },
  {
    id: '3',
    date: '2024-01-10T09:15:00Z',
    company: 'TikTok',
    type: 'alert',
    title: 'Critical Privacy Alert',
    description: 'New data sharing agreements with undisclosed third parties',
    severity: 'critical',
    changes: {
      added: ['Third-party data sharing', 'International data transfers'],
      removed: [],
      modified: ['Privacy controls']
    },
    riskImpact: { before: 3.1, after: 2.8 },
    tags: ['Third-party', 'International', 'Critical']
  },
  {
    id: '4',
    date: '2024-01-08T16:45:00Z',
    company: 'Apple',
    type: 'policy-update',
    title: 'App Tracking Transparency Update',
    description: 'Enhanced user controls for app tracking permissions',
    severity: 'low',
    changes: {
      added: ['Granular tracking controls', 'Privacy nutrition labels'],
      removed: [],
      modified: ['App permissions system']
    },
    riskImpact: { before: 9.2, after: 9.4 },
    tags: ['App Tracking', 'Transparency', 'User Controls']
  }
]

const eventTypeConfig = {
  'policy-update': {
    icon: Calendar,
    color: 'text-blue-600',
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800'
  },
  'risk-change': {
    icon: TrendingUp,
    color: 'text-purple-600', 
    bg: 'bg-purple-100 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800'
  },
  'alert': {
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-100 dark:bg-red-900/20', 
    border: 'border-red-200 dark:border-red-800'
  },
  'new-monitoring': {
    icon: Eye,
    color: 'text-green-600',
    bg: 'bg-green-100 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800'
  }
}

const severityConfig = {
  low: { label: 'Low', color: 'bg-green-500' },
  medium: { label: 'Medium', color: 'bg-amber-500' },
  high: { label: 'High', color: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'bg-red-500' }
}

export function PolicyTimeline() {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('all')
  const [events] = useState(mockEvents)
  
  const toggleEvent = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }
  
  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter(event => event.type === filter)
  
  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Policy Timeline
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-shrink-0">
              <Filter className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Filter</span>
            </Button>
            <Button variant="outline" size="sm" className="flex-shrink-0">
              <Search className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Search</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'All Events' },
            { key: 'policy-update', label: 'Policy Updates' },
            { key: 'alert', label: 'Alerts' },
            { key: 'risk-change', label: 'Risk Changes' }
          ].map(filterOption => (
            <Button
              key={filterOption.key}
              variant={filter === filterOption.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(filterOption.key)}
              className="whitespace-nowrap text-xs md:text-sm flex-shrink-0"
            >
              {filterOption.label}
            </Button>
          ))}
        </div>
        
        {/* Timeline */}
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 md:left-6 top-0 bottom-0 w-px bg-border" />
          
          <div className="space-y-4 md:space-y-6">
            <AnimatePresence>
              {filteredEvents.map((event, index) => {
                const config = eventTypeConfig[event.type]
                const Icon = config.icon
                const isExpanded = expandedEvents.has(event.id)
                
                return (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative pl-12 md:pl-16"
                  >
                    {/* Timeline marker */}
                    <div className={cn(
                      "absolute left-0 top-3 h-8 w-8 md:h-12 md:w-12 rounded-full border-2 md:border-4 border-background flex items-center justify-center",
                      config.bg,
                      config.border
                    )}>
                      <Icon className={cn("h-3 w-3 md:h-5 md:w-5", config.color)} />
                    </div>
                    
                    {/* Event card */}
                    <HoverScale>
                      <Card className={cn(
                        "transition-all duration-200 cursor-pointer",
                        isExpanded ? "shadow-lg" : "hover:shadow-md"
                      )}>
                        <CardContent 
                          className="p-3 md:p-4"
                          onClick={() => toggleEvent(event.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 mb-2">
                                <h4 className="font-medium text-sm md:text-base truncate">{event.title}</h4>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs">
                                    {event.company}
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    <div className={cn(
                                      "h-2 w-2 rounded-full",
                                      severityConfig[event.severity].color
                                    )} />
                                    <span className="text-xs text-muted-foreground">
                                      {severityConfig[event.severity].label}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <p className="text-sm text-muted-foreground mb-3">
                                {event.description}
                              </p>
                              
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex gap-2 flex-wrap">
                                  {event.tags.slice(0, 3).map(tag => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                  {event.tags.length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{event.tags.length - 3}
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="flex items-center justify-between md:gap-4">
                                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4">
                                    {event.riskImpact && (
                                      <div className="text-xs text-muted-foreground">
                                        Risk: {event.riskImpact.before.toFixed(1)} → {event.riskImpact.after.toFixed(1)}
                                        <span className={cn(
                                          "ml-1",
                                          event.riskImpact.after > event.riskImpact.before 
                                            ? "text-green-600" 
                                            : "text-red-600"
                                        )}>
                                          ({event.riskImpact.after > event.riskImpact.before ? '+' : ''}{(event.riskImpact.after - event.riskImpact.before).toFixed(1)})
                                        </span>
                                      </div>
                                    )}
                                    
                                    <div className="text-xs text-muted-foreground">
                                      {formatDuration(getTimeDiff(event.date))} ago
                                    </div>
                                  </div>
                                  
                                  <Button variant="ghost" size="sm" className="h-auto p-1 flex-shrink-0">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded content */}
                          <AnimatePresence>
                            {isExpanded && event.changes && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mt-4 pt-4 border-t space-y-3"
                              >
                                {event.changes.added.length > 0 && (
                                  <div>
                                    <h5 className="text-sm font-medium text-green-600 mb-2">
                                      ✓ Added
                                    </h5>
                                    <ul className="space-y-1">
                                      {event.changes.added.map((item, i) => (
                                        <li key={i} className="text-sm text-muted-foreground pl-4 relative">
                                          <span className="absolute left-0 text-green-600">+</span>
                                          {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {event.changes.removed.length > 0 && (
                                  <div>
                                    <h5 className="text-sm font-medium text-red-600 mb-2">
                                      ✗ Removed
                                    </h5>
                                    <ul className="space-y-1">
                                      {event.changes.removed.map((item, i) => (
                                        <li key={i} className="text-sm text-muted-foreground pl-4 relative">
                                          <span className="absolute left-0 text-red-600">-</span>
                                          {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {event.changes.modified.length > 0 && (
                                  <div>
                                    <h5 className="text-sm font-medium text-amber-600 mb-2">
                                      ↻ Modified
                                    </h5>
                                    <ul className="space-y-1">
                                      {event.changes.modified.map((item, i) => (
                                        <li key={i} className="text-sm text-muted-foreground pl-4 relative">
                                          <span className="absolute left-0 text-amber-600">~</span>
                                          {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </HoverScale>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
          
          {filteredEvents.length === 0 && (
            <FadeIn>
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No events found for the selected filter</p>
              </div>
            </FadeIn>
          )}
        </div>
      </CardContent>
    </Card>
  )
}