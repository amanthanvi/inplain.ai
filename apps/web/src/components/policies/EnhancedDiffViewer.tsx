'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertCircle, Eye, EyeOff, FileText, Plus, Minus, 
  Info, ChevronDown, ChevronRight, Filter, Maximize2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DiffSection {
  type: 'addition' | 'deletion' | 'context' | 'change'
  content: string
  lineNumbers?: { old?: number; new?: number }
}

interface EnhancedDiffViewerProps {
  diffHtml: string
  className?: string
  fromDate?: string
  toDate?: string
  changeStats?: {
    additions: number
    deletions: number
    modifications: number
  }
}

export function EnhancedDiffViewer({ 
  diffHtml, 
  className,
  fromDate,
  toDate,
  changeStats 
}: EnhancedDiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split' | 'inline'>('unified')
  const [showContext, setShowContext] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<'all' | 'additions' | 'deletions'>('all')

  // Parse the diff HTML into structured sections
  const parsedDiff = useMemo(() => {
    if (!diffHtml) return []
    
    const sections: DiffSection[] = []
    const parser = new DOMParser()
    const doc = parser.parseFromString(diffHtml, 'text/html')
    
    // Process all text nodes and elements
    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || ''
        if (text.trim()) {
          sections.push({ type: 'context', content: text })
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        if (element.tagName === 'DEL') {
          sections.push({ type: 'deletion', content: element.textContent || '' })
        } else if (element.tagName === 'INS') {
          sections.push({ type: 'addition', content: element.textContent || '' })
        } else {
          // Recursively process child nodes
          node.childNodes.forEach(processNode)
        }
      }
    }
    
    doc.body.childNodes.forEach(processNode)
    
    // Group consecutive changes into change blocks
    const groupedSections: DiffSection[] = []
    let currentGroup: DiffSection[] = []
    
    sections.forEach((section, index) => {
      if (section.type === 'context') {
        if (currentGroup.length > 0) {
          groupedSections.push({
            type: 'change',
            content: JSON.stringify(currentGroup)
          })
          currentGroup = []
        }
        groupedSections.push(section)
      } else {
        currentGroup.push(section)
      }
    })
    
    if (currentGroup.length > 0) {
      groupedSections.push({
        type: 'change',
        content: JSON.stringify(currentGroup)
      })
    }
    
    return groupedSections
  }, [diffHtml])

  // Filter sections based on selected filter
  const filteredSections = useMemo(() => {
    if (filter === 'all') return parsedDiff
    
    return parsedDiff.filter(section => {
      if (section.type === 'change') {
        const changes = JSON.parse(section.content) as DiffSection[]
        return changes.some(change => 
          (filter === 'additions' && change.type === 'addition') ||
          (filter === 'deletions' && change.type === 'deletion')
        )
      }
      return section.type === 'context'
    })
  }, [parsedDiff, filter])

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedSections(newExpanded)
  }

  const renderUnifiedView = () => {
    return (
      <div className="space-y-2">
        {filteredSections.map((section, index) => {
          if (section.type === 'context' && !showContext) {
            return null
          }
          
          if (section.type === 'change') {
            const changes = JSON.parse(section.content) as DiffSection[]
            const isExpanded = expandedSections.has(index) || expandedSections.size === 0
            
            return (
              <Card key={index} className="overflow-hidden">
                <CardHeader 
                  className="py-2 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleSection(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="text-sm font-medium">Change Block {index + 1}</span>
                      <div className="flex gap-2">
                        {changes.some(c => c.type === 'addition') && (
                          <Badge variant="outline" className="text-green-700 border-green-300">
                            <Plus className="h-3 w-3 mr-1" />
                            Added
                          </Badge>
                        )}
                        {changes.some(c => c.type === 'deletion') && (
                          <Badge variant="outline" className="text-red-700 border-red-300">
                            <Minus className="h-3 w-3 mr-1" />
                            Removed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="p-0">
                    <div className="bg-muted/20 p-4 font-mono text-sm">
                      {changes.map((change, changeIndex) => (
                        <div
                          key={changeIndex}
                          className={cn(
                            "px-2 py-1 rounded",
                            change.type === 'addition' && "bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100",
                            change.type === 'deletion' && "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100 line-through"
                          )}
                        >
                          <span className="select-none mr-2 opacity-50">
                            {change.type === 'addition' ? '+' : '-'}
                          </span>
                          {change.content}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          }
          
          return (
            <div 
              key={index} 
              className="px-4 py-2 text-sm text-muted-foreground font-mono"
            >
              {section.content}
            </div>
          )
        })}
      </div>
    )
  }

  const renderSplitView = () => {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Previous Version</h4>
          {filteredSections.map((section, index) => {
            if (section.type === 'change') {
              const changes = JSON.parse(section.content) as DiffSection[]
              const deletions = changes.filter(c => c.type === 'deletion')
              
              if (deletions.length === 0) {
                return <div key={index} className="h-20" /> // Spacer
              }
              
              return (
                <Card key={index} className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                  <CardContent className="p-3">
                    {deletions.map((del, i) => (
                      <div key={i} className="text-sm font-mono text-red-900 dark:text-red-100 line-through">
                        {del.content}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            }
            return null
          })}
        </div>
        
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Current Version</h4>
          {filteredSections.map((section, index) => {
            if (section.type === 'change') {
              const changes = JSON.parse(section.content) as DiffSection[]
              const additions = changes.filter(c => c.type === 'addition')
              
              if (additions.length === 0) {
                return <div key={index} className="h-20" /> // Spacer
              }
              
              return (
                <Card key={index} className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CardContent className="p-3">
                    {additions.map((add, i) => (
                      <div key={i} className="text-sm font-mono text-green-900 dark:text-green-100">
                        {add.content}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            }
            return null
          })}
        </div>
      </div>
    )
  }

  if (!diffHtml) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No differences found between the selected versions.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList>
              <TabsTrigger value="unified">Unified</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
              <TabsTrigger value="inline">Inline</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowContext(!showContext)}
          >
            {showContext ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            Context
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All Changes</TabsTrigger>
              <TabsTrigger value="additions">Additions Only</TabsTrigger>
              <TabsTrigger value="deletions">Deletions Only</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Summary */}
      {changeStats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">+{changeStats.additions}</div>
              <div className="text-sm text-muted-foreground">Additions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">-{changeStats.deletions}</div>
              <div className="text-sm text-muted-foreground">Deletions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">~{changeStats.modifications}</div>
              <div className="text-sm text-muted-foreground">Modifications</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Diff View */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {viewMode === 'unified' && renderUnifiedView()}
          {viewMode === 'split' && renderSplitView()}
          {viewMode === 'inline' && (
            <div className="p-4 prose prose-sm max-w-none dark:prose-invert">
              <div dangerouslySetInnerHTML={{ __html: diffHtml }} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}