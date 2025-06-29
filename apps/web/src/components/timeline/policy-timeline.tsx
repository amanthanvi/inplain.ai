'use client'

/**
 * Policy Timeline Component
 * Phase 2: Interactive timeline visualization for policy changes
 */

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, AlertCircle, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EnhancedSnapshotMeta, EnhancedDiffMeta } from '@/lib/snapshots/kv-snapshot-manager'
import { kvSnapshotManager } from '@/lib/snapshots/kv-snapshot-manager'
import { semanticDiffEngine } from '@/lib/diffs/semantic-diff-engine'

interface PolicyTimelineProps {
  slug: string
  initialSnapshots?: EnhancedSnapshotMeta[]
  onSnapshotSelect?: (snapshot: EnhancedSnapshotMeta) => void
  onDiffSelect?: (diff: EnhancedDiffMeta) => void
  className?: string
}

interface TimelineEvent {
  id: string
  type: 'snapshot' | 'diff'
  date: Date
  data: EnhancedSnapshotMeta | EnhancedDiffMeta
  position: number
  clustered: boolean
  clusterSize?: number
}

export function PolicyTimeline({
  slug,
  initialSnapshots,
  onSnapshotSelect,
  onDiffSelect,
  className
}: PolicyTimelineProps) {
  const [snapshots, setSnapshots] = useState<EnhancedSnapshotMeta[]>(initialSnapshots || [])
  const [diffs, setDiffs] = useState<EnhancedDiffMeta[]>([])
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [loading, setLoading] = useState(!initialSnapshots)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'year' | 'all'>('year')
  const [currentPage, setCurrentPage] = useState(0)
  
  const timelineRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch data
  useEffect(() => {
    if (!initialSnapshots) {
      loadTimelineData()
    }
  }, [slug])

  // Process events when data changes
  useEffect(() => {
    processTimelineEvents()
  }, [snapshots, diffs, viewMode])

  const loadTimelineData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [snapshotData, diffData] = await Promise.all([
        kvSnapshotManager.getSnapshots(slug, 50),
        kvSnapshotManager.getDiffs(slug, 50)
      ])

      setSnapshots(snapshotData)
      setDiffs(diffData)
    } catch (err) {
      console.error('Error loading timeline data:', err)
      setError('Failed to load timeline data')
    } finally {
      setLoading(false)
    }
  }

  const processTimelineEvents = () => {
    const allEvents: TimelineEvent[] = []
    
    // Add snapshots
    snapshots.forEach((snapshot, index) => {
      allEvents.push({
        id: snapshot.id,
        type: 'snapshot',
        date: new Date(snapshot.capturedAt),
        data: snapshot,
        position: 0,
        clustered: false
      })
    })

    // Add diffs
    diffs.forEach(diff => {
      allEvents.push({
        id: diff.id,
        type: 'diff',
        date: new Date(diff.createdAt),
        data: diff,
        position: 0,
        clustered: false
      })
    })

    // Sort by date
    allEvents.sort((a, b) => b.date.getTime() - a.date.getTime())

    // Filter by view mode
    const now = new Date()
    const filteredEvents = allEvents.filter(event => {
      const daysDiff = differenceInDays(now, event.date)
      
      switch (viewMode) {
        case 'month':
          return daysDiff <= 30
        case 'year':
          return daysDiff <= 365
        case 'all':
          return true
        default:
          return true
      }
    })

    // Cluster nearby events
    const clusteredEvents = clusterEvents(filteredEvents)
    
    // Calculate positions
    positionEvents(clusteredEvents)
    
    setEvents(clusteredEvents)
  }

  const clusterEvents = (events: TimelineEvent[]): TimelineEvent[] => {
    if (events.length <= 1) return events
    
    const clustered: TimelineEvent[] = []
    const clusterThreshold = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    
    let currentCluster: TimelineEvent[] = [events[0]!]
    
    for (let i = 1; i < events.length; i++) {
      const event = events[i]
      if (!event || currentCluster.length === 0) continue
      
      const firstEvent = currentCluster[0]
      if (!firstEvent) continue
      
      const timeDiff = firstEvent.date.getTime() - event.date.getTime()
      
      if (timeDiff <= clusterThreshold) {
        currentCluster.push(event)
      } else {
        // Process current cluster
        if (currentCluster.length > 1 && currentCluster[0]) {
          clustered.push({
            ...currentCluster[0],
            clustered: true,
            clusterSize: currentCluster.length
          })
        } else if (currentCluster[0]) {
          clustered.push(currentCluster[0])
        }
        
        currentCluster = [event]
      }
    }
    
    // Process last cluster
    if (currentCluster.length > 1 && currentCluster[0]) {
      clustered.push({
        ...currentCluster[0],
        clustered: true,
        clusterSize: currentCluster.length
      })
    } else if (currentCluster[0]) {
      clustered.push(currentCluster[0])
    }
    
    return clustered
  }

  const positionEvents = (events: TimelineEvent[]) => {
    if (events.length === 0) return
    
    const lastEvent = events[events.length - 1]
    const firstEvent = events[0]
    
    if (!lastEvent || !firstEvent) return
    
    const firstDate = lastEvent.date.getTime()
    const lastDate = firstEvent.date.getTime()
    const range = lastDate - firstDate
    
    events.forEach(event => {
      if (range === 0) {
        event.position = 50
      } else {
        event.position = ((event.date.getTime() - firstDate) / range) * 100
      }
    })
  }

  const handleEventClick = (event: TimelineEvent) => {
    setSelectedEvent(event)
    
    if (event.type === 'snapshot' && onSnapshotSelect) {
      onSnapshotSelect(event.data as EnhancedSnapshotMeta)
    } else if (event.type === 'diff' && onDiffSelect) {
      onDiffSelect(event.data as EnhancedDiffMeta)
    }
  }

  const getRiskColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'critical':
        return 'text-red-600 bg-red-100'
      case 'high':
        return 'text-orange-600 bg-orange-100'
      case 'medium':
        return 'text-yellow-600 bg-yellow-100'
      case 'low':
        return 'text-green-600 bg-green-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getChangeIcon = (changeRatio?: number) => {
    if (!changeRatio) return <Minus className="w-4 h-4" />
    if (changeRatio > 0.3) return <TrendingUp className="w-4 h-4 text-red-500" />
    if (changeRatio > 0.1) return <TrendingUp className="w-4 h-4 text-orange-500" />
    return <Minus className="w-4 h-4 text-gray-500" />
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="text-red-600 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('month')}
            className={cn(
              "px-3 py-1 rounded-md text-sm font-medium transition-colors",
              viewMode === 'month'
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('year')}
            className={cn(
              "px-3 py-1 rounded-md text-sm font-medium transition-colors",
              viewMode === 'year'
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            Year
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={cn(
              "px-3 py-1 rounded-md text-sm font-medium transition-colors",
              viewMode === 'all'
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            All Time
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          {events.length} events
        </div>
      </div>

      {/* Timeline */}
      <div ref={containerRef} className="relative">
        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-200 -translate-y-1/2" />
        
        <div ref={timelineRef} className="relative h-32 overflow-hidden">
          <AnimatePresence>
            {events.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `${event.position}%` }}
              >
                <button
                  onClick={() => handleEventClick(event)}
                  className={cn(
                    "relative group",
                    selectedEvent?.id === event.id && "z-10"
                  )}
                >
                  {/* Event dot */}
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 transition-all",
                      event.type === 'snapshot'
                        ? "bg-blue-500 border-blue-600"
                        : "bg-purple-500 border-purple-600",
                      selectedEvent?.id === event.id && "scale-150",
                      event.clustered && "w-6 h-6"
                    )}
                  >
                    {event.clustered && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                        {event.clusterSize}
                      </span>
                    )}
                  </div>
                  
                  {/* Hover tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 whitespace-nowrap">
                      <div className="font-medium">
                        {format(event.date, 'MMM d, yyyy')}
                      </div>
                      <div className="text-gray-300">
                        {event.type === 'snapshot' ? 'Snapshot' : 'Changes detected'}
                      </div>
                      {event.type === 'diff' && (
                        <div className="flex items-center gap-1 mt-1">
                          {getChangeIcon((event.data as EnhancedDiffMeta).summary?.changeRatio)}
                          <span className="text-gray-300">
                            {(event.data as EnhancedDiffMeta).summary?.totalChanges} changes
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {/* Date labels */}
        <div className="absolute top-full mt-4 left-0 right-0 flex justify-between text-xs text-gray-600">
          <span>{events.length > 0 && events[events.length - 1] && format(events[events.length - 1]!.date, 'MMM yyyy')}</span>
          <span>{events.length > 0 && events[0] && format(events[0]!.date, 'MMM yyyy')}</span>
        </div>
      </div>

      {/* Selected event details */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-50 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  selectedEvent.type === 'snapshot'
                    ? "bg-blue-500"
                    : "bg-purple-500"
                )} />
                <h3 className="font-medium">
                  {selectedEvent.type === 'snapshot' ? 'Policy Snapshot' : 'Policy Changes'}
                </h3>
                <span className="text-sm text-gray-600">
                  {format(selectedEvent.date, 'PPP')}
                </span>
              </div>
              
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            {selectedEvent.type === 'snapshot' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Version</div>
                  <div className="font-medium">
                    v{(selectedEvent.data as EnhancedSnapshotMeta).version}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Quality Score</div>
                  <div className="font-medium">
                    {(selectedEvent.data as EnhancedSnapshotMeta).metadata.quality}/100
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Word Count</div>
                  <div className="font-medium">
                    {(selectedEvent.data as EnhancedSnapshotMeta).metadata.wordCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Sections</div>
                  <div className="font-medium">
                    {(selectedEvent.data as EnhancedSnapshotMeta).metadata.sections.length}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Versions</div>
                    <div className="font-medium">
                      v{(selectedEvent.data as EnhancedDiffMeta).fromVersion} → v{(selectedEvent.data as EnhancedDiffMeta).toVersion}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Total Changes</div>
                    <div className="font-medium">
                      {(selectedEvent.data as EnhancedDiffMeta).summary.totalChanges}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Risk Level</div>
                    <div className={cn(
                      "font-medium inline-flex items-center px-2 py-0.5 rounded-md text-xs",
                      getRiskColor((selectedEvent.data as EnhancedDiffMeta).riskAssessment?.level)
                    )}>
                      {(selectedEvent.data as EnhancedDiffMeta).riskAssessment?.level || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Change Ratio</div>
                    <div className="font-medium">
                      {((selectedEvent.data as EnhancedDiffMeta).summary.changeRatio * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>{(selectedEvent.data as EnhancedDiffMeta).summary.addedSections} added</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span>{(selectedEvent.data as EnhancedDiffMeta).summary.removedSections} removed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span>{(selectedEvent.data as EnhancedDiffMeta).summary.modifiedSections} modified</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}