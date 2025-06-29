'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  ArrowLeftRight, 
  Search, 
  Download, 
  Share2, 
  Eye, 
  EyeOff,
  Maximize2,
  Minimize2,
  AlertTriangle,
  CheckCircle,
  Info,
  Calendar,
  FileText,
  Highlighter,
  Copy,
  Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface Snapshot {
  id: string
  content: string
  timestamp: Date
  version?: string
  metadata?: {
    effectiveDate?: string
    lastUpdated?: string
    extractedAt?: string
  }
}

interface DiffStats {
  additions: number
  deletions: number
  modifications: number
  totalChanges: number
}

interface ComparisonProps {
  companySlug: string
  policySlug: string
  leftSnapshot?: Snapshot
  rightSnapshot?: Snapshot
  snapshots?: Snapshot[]
  onSnapshotChange?: (side: 'left' | 'right', snapshot: Snapshot) => void
  className?: string
}

type ViewMode = 'side-by-side' | 'unified' | 'changes-only'
type HighlightMode = 'all' | 'additions' | 'deletions' | 'none'

export function PolicyVersionComparison({
  companySlug,
  policySlug,
  leftSnapshot: initialLeft,
  rightSnapshot: initialRight,
  snapshots = [],
  onSnapshotChange,
  className
}: ComparisonProps) {
  const [leftSnapshot, setLeftSnapshot] = useState<Snapshot | null>(initialLeft || null)
  const [rightSnapshot, setRightSnapshot] = useState<Snapshot | null>(initialRight || null)
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side')
  const [highlightMode, setHighlightMode] = useState<HighlightMode>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showMetadata, setShowMetadata] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [diffStats, setDiffStats] = useState<DiffStats | null>(null)
  const [diffContent, setDiffContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [syncScroll, setSyncScroll] = useState(true)

  // Load diff when snapshots change
  useEffect(() => {
    if (leftSnapshot && rightSnapshot) {
      loadDiff()
    }
  }, [leftSnapshot, rightSnapshot])

  const loadDiff = async () => {
    if (!leftSnapshot || !rightSnapshot) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/diffs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldContent: leftSnapshot.content,
          newContent: rightSnapshot.content,
          format: 'html'
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setDiffContent(data.diff)
        setDiffStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to load diff:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSnapshotSelect = (side: 'left' | 'right', snapshotId: string) => {
    const snapshot = snapshots.find(s => s.id === snapshotId)
    if (snapshot) {
      if (side === 'left') {
        setLeftSnapshot(snapshot)
      } else {
        setRightSnapshot(snapshot)
      }
      onSnapshotChange?.(side, snapshot)
    }
  }

  const renderSideBySide = () => (
    <div className="grid grid-cols-2 gap-4 h-full">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Select 
              value={leftSnapshot?.id || ''} 
              onValueChange={(id) => handleSnapshotSelect('left', id)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((snapshot) => (
                  <SelectItem key={snapshot.id} value={snapshot.id}>
                    {format(snapshot.timestamp, 'MMM d, yyyy')}
                    {snapshot.version && ` (${snapshot.version})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showMetadata && leftSnapshot?.metadata && (
            <div className="text-sm text-muted-foreground space-y-1">
              {leftSnapshot.metadata.effectiveDate && (
                <p>Effective: {leftSnapshot.metadata.effectiveDate}</p>
              )}
              {leftSnapshot.metadata.extractedAt && (
                <p>Extracted: {format(new Date(leftSnapshot.metadata.extractedAt), 'PPp')}</p>
              )}
            </div>
          )}
        </Card>
        
        <ScrollArea className="h-[600px] border rounded-lg p-4">
          {leftSnapshot ? (
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ 
                __html: highlightContent(leftSnapshot.content, 'old')
              }}
            />
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Select a version to compare
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Select 
              value={rightSnapshot?.id || ''} 
              onValueChange={(id) => handleSnapshotSelect('right', id)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((snapshot) => (
                  <SelectItem key={snapshot.id} value={snapshot.id}>
                    {format(snapshot.timestamp, 'MMM d, yyyy')}
                    {snapshot.version && ` (${snapshot.version})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showMetadata && rightSnapshot?.metadata && (
            <div className="text-sm text-muted-foreground space-y-1">
              {rightSnapshot.metadata.effectiveDate && (
                <p>Effective: {rightSnapshot.metadata.effectiveDate}</p>
              )}
              {rightSnapshot.metadata.extractedAt && (
                <p>Extracted: {format(new Date(rightSnapshot.metadata.extractedAt), 'PPp')}</p>
              )}
            </div>
          )}
        </Card>
        
        <ScrollArea className="h-[600px] border rounded-lg p-4">
          {rightSnapshot ? (
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ 
                __html: highlightContent(rightSnapshot.content, 'new')
              }}
            />
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Select a version to compare
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )

  const renderUnified = () => (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="w-4 h-4 p-0" />
              <span className="text-sm">
                {leftSnapshot?.timestamp ? format(leftSnapshot.timestamp, 'MMM d, yyyy') : 'Old'}
              </span>
            </div>
            <ArrowLeftRight className="h-4 w-4" />
            <div className="flex items-center gap-2">
              <Badge className="w-4 h-4 p-0 bg-green-500" />
              <span className="text-sm">
                {rightSnapshot?.timestamp ? format(rightSnapshot.timestamp, 'MMM d, yyyy') : 'New'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <ScrollArea className="h-[650px] border rounded-lg p-4">
        {diffContent ? (
          <div 
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: diffContent }}
          />
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Select versions to compare
          </div>
        )}
      </ScrollArea>
    </div>
  )

  const renderChangesOnly = () => (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Changes Summary</h3>
          {diffStats && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600">+{diffStats.additions} additions</span>
              <span className="text-red-600">-{diffStats.deletions} deletions</span>
              <span className="text-yellow-600">~{diffStats.modifications} modifications</span>
            </div>
          )}
        </div>
      </Card>

      <ScrollArea className="h-[650px] border rounded-lg p-4">
        {diffContent ? (
          <div className="space-y-4">
            <div 
              className="diff-content"
              dangerouslySetInnerHTML={{ __html: filterDiffContent(diffContent) }}
            />
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Select versions to see changes
          </p>
        )}
      </ScrollArea>
    </div>
  )

  const highlightContent = (content: string, type: 'old' | 'new'): string => {
    if (highlightMode === 'none' || !diffContent) return content
    
    // This is a simplified implementation
    // In production, use a proper diff library to highlight changes
    return content
  }

  const filterDiffContent = (diff: string): string => {
    if (highlightMode === 'none') return diff
    
    // Filter based on highlight mode
    // This is a simplified implementation
    return diff
  }

  const exportComparison = async (format: 'pdf' | 'markdown' | 'html') => {
    if (!leftSnapshot || !rightSnapshot) return
    
    try {
      const response = await fetch('/api/export/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leftSnapshot,
          rightSnapshot,
          diffStats,
          format
        })
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `comparison-${companySlug}-${policySlug}.${format}`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const shareComparison = async () => {
    if (!leftSnapshot || !rightSnapshot) return
    
    try {
      const response = await fetch('/api/share/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companySlug,
          policySlug,
          leftSnapshotId: leftSnapshot.id,
          rightSnapshotId: rightSnapshot.id
        })
      })
      
      if (response.ok) {
        const { shareUrl } = await response.json()
        await navigator.clipboard.writeText(shareUrl)
        // Show toast notification
      }
    } catch (error) {
      console.error('Share failed:', error)
    }
  }

  return (
    <div className={cn(
      "space-y-4",
      isFullscreen && "fixed inset-0 z-50 bg-background p-4",
      className
    )}>
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side-by-side">Side by Side</SelectItem>
                  <SelectItem value="unified">Unified</SelectItem>
                  <SelectItem value="changes-only">Changes Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={highlightMode} onValueChange={(v) => setHighlightMode(v as HighlightMode)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Changes</SelectItem>
                  <SelectItem value="additions">Additions Only</SelectItem>
                  <SelectItem value="deletions">Deletions Only</SelectItem>
                  <SelectItem value="none">No Highlights</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search changes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowMetadata(!showMetadata)}
                    >
                      {showMetadata ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle metadata</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSyncScroll(!syncScroll)}
                      disabled={viewMode !== 'side-by-side'}
                    >
                      <ArrowLeftRight className={cn("h-4 w-4", syncScroll && "text-primary")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sync scrolling</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                    >
                      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle fullscreen</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={shareComparison}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share comparison</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => exportComparison('pdf')}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export comparison</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Stats Bar */}
          {diffStats && (
            <div className="flex items-center gap-4 p-3 bg-muted rounded-lg text-sm">
              <span className="font-medium">Total Changes: {diffStats.totalChanges}</span>
              <div className="flex-1 flex items-center gap-6">
                <span className="text-green-600">+{diffStats.additions} additions</span>
                <span className="text-red-600">-{diffStats.deletions} deletions</span>
                <span className="text-yellow-600">~{diffStats.modifications} modifications</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Main Content */}
      {loading ? (
        <Card className="p-8">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Analyzing changes...</p>
          </div>
        </Card>
      ) : (
        <>
          {viewMode === 'side-by-side' && renderSideBySide()}
          {viewMode === 'unified' && renderUnified()}
          {viewMode === 'changes-only' && renderChangesOnly()}
        </>
      )}
    </div>
  )
}