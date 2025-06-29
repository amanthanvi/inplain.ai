'use client'

/**
 * Version Comparison Component
 * Phase 2: Side-by-side comparison of policy versions
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  AlertTriangle,
  Info,
  Shield,
  Database,
  Share2,
  Users,
  Lock,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EnhancedSnapshotMeta } from '@/lib/snapshots/kv-snapshot-manager'
import type { SemanticDiff, SemanticChange } from '@/lib/diffs/semantic-diff-engine'
import { kvSnapshotManager } from '@/lib/snapshots/kv-snapshot-manager'
import { semanticDiffEngine } from '@/lib/diffs/semantic-diff-engine'

interface VersionComparisonProps {
  slug: string
  fromVersion?: number
  toVersion?: number
  onVersionChange?: (from: number, to: number) => void
  className?: string
}

export function VersionComparison({
  slug,
  fromVersion,
  toVersion,
  onVersionChange,
  className
}: VersionComparisonProps) {
  const [snapshots, setSnapshots] = useState<EnhancedSnapshotMeta[]>([])
  const [selectedFrom, setSelectedFrom] = useState<EnhancedSnapshotMeta | null>(null)
  const [selectedTo, setSelectedTo] = useState<EnhancedSnapshotMeta | null>(null)
  const [diff, setDiff] = useState<SemanticDiff | null>(null)
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified')
  const [highlightChanges, setHighlightChanges] = useState(true)

  // Load available versions
  useEffect(() => {
    loadSnapshots()
  }, [slug])

  // Load specific versions if provided
  useEffect(() => {
    if (fromVersion && toVersion && snapshots.length > 0) {
      loadVersions(fromVersion, toVersion)
    }
  }, [fromVersion, toVersion, snapshots])

  // Perform comparison when selections change
  useEffect(() => {
    if (selectedFrom && selectedTo && selectedFrom.version < selectedTo.version) {
      performComparison()
    }
  }, [selectedFrom, selectedTo])

  const loadSnapshots = async () => {
    try {
      setLoading(true)
      const data = await kvSnapshotManager.getSnapshots(slug, 20)
      setSnapshots(data)
      
      // Select latest two versions by default
      if (data.length >= 2 && !fromVersion && !toVersion) {
        setSelectedFrom(data[1] || null)
        setSelectedTo(data[0] || null)
      }
    } catch (err) {
      console.error('Error loading snapshots:', err)
      setError('Failed to load versions')
    } finally {
      setLoading(false)
    }
  }

  const loadVersions = async (from: number, to: number) => {
    try {
      const [fromSnapshot, toSnapshot] = await Promise.all([
        kvSnapshotManager.getByVersion(slug, from),
        kvSnapshotManager.getByVersion(slug, to)
      ])
      
      if (fromSnapshot && toSnapshot) {
        setSelectedFrom(fromSnapshot)
        setSelectedTo(toSnapshot)
      }
    } catch (err) {
      console.error('Error loading specific versions:', err)
    }
  }

  const performComparison = async () => {
    if (!selectedFrom || !selectedTo) return
    
    try {
      setComparing(true)
      setError(null)
      
      // Parse sections from content
      const fromSections = selectedFrom.metadata.sections.map(s => ({
        title: s.title,
        content: '' // Would need to extract from full content
      }))
      
      const toSections = selectedTo.metadata.sections.map(s => ({
        title: s.title,
        content: '' // Would need to extract from full content
      }))
      
      const semanticDiff = await semanticDiffEngine.analyze(
        selectedFrom.content,
        selectedTo.content,
        fromSections,
        toSections
      )
      
      setDiff(semanticDiff)
      
      if (onVersionChange) {
        onVersionChange(selectedFrom.version, selectedTo.version)
      }
    } catch (err) {
      console.error('Error comparing versions:', err)
      setError('Failed to compare versions')
    } finally {
      setComparing(false)
    }
  }

  const handleVersionSelect = (snapshot: EnhancedSnapshotMeta, type: 'from' | 'to') => {
    if (type === 'from') {
      setSelectedFrom(snapshot)
      // Ensure "to" version is newer
      if (selectedTo && selectedTo.version <= snapshot.version) {
        const newerVersions = snapshots.filter(s => s.version > snapshot.version)
        if (newerVersions.length > 0) {
          setSelectedTo(newerVersions[newerVersions.length - 1] || null)
        } else {
          setSelectedTo(null)
        }
      }
    } else {
      setSelectedTo(snapshot)
      // Ensure "from" version is older
      if (selectedFrom && selectedFrom.version >= snapshot.version) {
        const olderVersions = snapshots.filter(s => s.version < snapshot.version)
        if (olderVersions.length > 0) {
          setSelectedFrom(olderVersions[0] || null)
        } else {
          setSelectedFrom(null)
        }
      }
    }
  }

  const getChangeIcon = (type: SemanticChange['type']) => {
    const icons = {
      permission: Shield,
      data_usage: Database,
      retention: Clock,
      sharing: Share2,
      rights: Users,
      security: Lock
    }
    
    const Icon = icons[type] || FileText
    return <Icon className="w-4 h-4" />
  }

  const getSeverityColor = (severity: SemanticChange['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const renderDiffContent = () => {
    if (!diff) return null
    
    const visualDiff = semanticDiffEngine.generateVisualDiff(
      selectedFrom?.content || '',
      selectedTo?.content || ''
    )
    
    if (viewMode === 'unified') {
      return (
        <div className="prose prose-sm max-w-none">
          {visualDiff.map((segment, index) => {
            if (segment.type === 'equal') {
              return (
                <span key={index} className="text-gray-700">
                  {segment.text}
                </span>
              )
            } else if (segment.type === 'delete') {
              return highlightChanges ? (
                <span key={index} className="bg-red-100 text-red-800 line-through">
                  {segment.text}
                </span>
              ) : null
            } else {
              return highlightChanges ? (
                <span key={index} className="bg-green-100 text-green-800">
                  {segment.text}
                </span>
              ) : (
                <span key={index} className="text-gray-700">
                  {segment.text}
                </span>
              )
            }
          })}
        </div>
      )
    } else {
      // Split view
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="prose prose-sm max-w-none">
            <h4 className="text-sm font-medium text-gray-600 mb-2">
              Version {selectedFrom?.version} - {format(new Date(selectedFrom?.capturedAt || ''), 'MMM d, yyyy')}
            </h4>
            <div className="bg-gray-50 p-4 rounded-lg">
              {selectedFrom?.content}
            </div>
          </div>
          <div className="prose prose-sm max-w-none">
            <h4 className="text-sm font-medium text-gray-600 mb-2">
              Version {selectedTo?.version} - {format(new Date(selectedTo?.capturedAt || ''), 'MMM d, yyyy')}
            </h4>
            <div className="bg-gray-50 p-4 rounded-lg">
              {selectedTo?.content}
            </div>
          </div>
        </div>
      )
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Version Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Compare from
          </label>
          <select
            value={selectedFrom?.version || ''}
            onChange={(e) => {
              const version = parseInt(e.target.value)
              const snapshot = snapshots.find(s => s.version === version)
              if (snapshot) handleVersionSelect(snapshot, 'from')
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select version</option>
            {snapshots
              .filter(s => !selectedTo || s.version < selectedTo.version)
              .map(snapshot => (
                <option key={snapshot.id} value={snapshot.version}>
                  Version {snapshot.version} - {format(new Date(snapshot.capturedAt), 'MMM d, yyyy')}
                </option>
              ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Compare to
          </label>
          <select
            value={selectedTo?.version || ''}
            onChange={(e) => {
              const version = parseInt(e.target.value)
              const snapshot = snapshots.find(s => s.version === version)
              if (snapshot) handleVersionSelect(snapshot, 'to')
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select version</option>
            {snapshots
              .filter(s => !selectedFrom || s.version > selectedFrom.version)
              .map(snapshot => (
                <option key={snapshot.id} value={snapshot.version}>
                  Version {snapshot.version} - {format(new Date(snapshot.capturedAt), 'MMM d, yyyy')}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Comparison Results */}
      {comparing && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          <span className="ml-2 text-gray-600">Analyzing changes...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {diff && !comparing && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Change Summary</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {diff.summary.totalChanges}
                </div>
                <div className="text-sm text-gray-600">Total Changes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  +{diff.summary.addedWords}
                </div>
                <div className="text-sm text-gray-600">Words Added</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  -{diff.summary.removedWords}
                </div>
                <div className="text-sm text-gray-600">Words Removed</div>
              </div>
              <div className="text-center">
                <div className={cn(
                  "text-2xl font-bold",
                  diff.riskAssessment.overallRisk === 'critical' ? 'text-red-600' :
                  diff.riskAssessment.overallRisk === 'high' ? 'text-orange-600' :
                  diff.riskAssessment.overallRisk === 'medium' ? 'text-yellow-600' :
                  'text-green-600'
                )}>
                  {diff.riskAssessment.score}
                </div>
                <div className="text-sm text-gray-600">Risk Score</div>
              </div>
            </div>

            {/* Key Highlights */}
            {diff.summary.keyHighlights.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Key Changes</h4>
                <ul className="space-y-1">
                  {diff.summary.keyHighlights.map((highlight, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Semantic Changes */}
          {diff.semanticChanges.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Privacy Impact Analysis</h3>
              
              <div className="space-y-3">
                {diff.semanticChanges.map((change, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-4 rounded-lg border",
                      getSeverityColor(change.severity)
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {getChangeIcon(change.type)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium capitalize">
                            {change.type.replace('_', ' ')}
                          </h4>
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            change.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            change.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                            change.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          )}>
                            {change.severity}
                          </span>
                        </div>
                        
                        <p className="text-sm mb-2">{change.description}</p>
                        
                        {change.impact.length > 0 && (
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Impact:</span>
                            <ul className="mt-1 space-y-0.5">
                              {change.impact.map((impact, i) => (
                                <li key={i}>• {impact}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {change.recommendation && (
                          <div className="mt-2 text-xs text-blue-600">
                            <span className="font-medium">Recommendation:</span> {change.recommendation}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View Options */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewMode('unified')}
                className={cn(
                  "px-3 py-1 rounded-md text-sm font-medium transition-colors",
                  viewMode === 'unified'
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                Unified
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={cn(
                  "px-3 py-1 rounded-md text-sm font-medium transition-colors",
                  viewMode === 'split'
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                Split
              </button>
            </div>
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={highlightChanges}
                onChange={(e) => setHighlightChanges(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Highlight changes</span>
            </label>
          </div>

          {/* Diff Content */}
          <div className="bg-gray-50 rounded-lg p-6 overflow-auto max-h-96">
            {renderDiffContent()}
          </div>
        </div>
      )}
    </div>
  )
}