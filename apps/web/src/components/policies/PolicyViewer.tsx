'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { 
  Search, X, Download, Share2, Printer, ChevronLeft, ChevronRight,
  FileText, Clock, Shield, AlertCircle, Eye, Hash, Maximize2,
  Minimize2, Sun, Moon, Type, ZoomIn, ZoomOut, Bookmark,
  ChevronUp, ChevronDown, Highlighter, Copy, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useDebounce } from '@/hooks/useDebounce'

interface PolicySection {
  id: string
  title: string
  level: number
  content: string
  startIndex: number
  endIndex: number
  wordCount: number
  changes?: Array<{
    type: 'added' | 'removed' | 'modified'
    date: Date
    summary: string
  }>
}

interface PolicyViewerProps {
  policyContent: string
  metadata: {
    title: string
    company: string
    lastUpdated: Date
    version?: string
    url?: string
    wordCount: number
    readingTime: number
    sections?: PolicySection[]
  }
  changes?: Array<{
    id: string
    type: 'added' | 'removed' | 'modified'
    section: string
    content: string
    date: Date
  }>
  onSectionClick?: (section: PolicySection) => void
  className?: string
}

export function PolicyViewer({ 
  policyContent, 
  metadata, 
  changes = [],
  onSectionClick,
  className 
}: PolicyViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ index: number; length: number }>>([])
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0)
  const [showSearch, setShowSearch] = useState(false)
  const [fontSize, setFontSize] = useState(16)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [bookmarks, setBookmarks] = useState<string[]>([])
  const [showChanges, setShowChanges] = useState(true)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Parse sections from content if not provided
  const sections = metadata.sections || parseSections(policyContent)

  // Search functionality
  useEffect(() => {
    if (!debouncedSearchQuery) {
      setSearchResults([])
      setCurrentSearchIndex(0)
      clearHighlights()
      return
    }

    const results: Array<{ index: number; length: number }> = []
    const regex = new RegExp(debouncedSearchQuery, 'gi')
    let match

    while ((match = regex.exec(policyContent)) !== null) {
      results.push({ index: match.index, length: match[0].length })
    }

    setSearchResults(results)
    setCurrentSearchIndex(0)
    
    if (results.length > 0) {
      highlightSearchResults(results, 0)
      if (results[0]) {
        scrollToSearchResult(results[0])
      }
    }
  }, [debouncedSearchQuery, policyContent])

  const clearHighlights = () => {
    if (!contentRef.current) return
    contentRef.current.innerHTML = contentRef.current.innerHTML.replace(
      /<mark class="search-highlight[^"]*"[^>]*>(.*?)<\/mark>/g,
      '$1'
    )
  }

  const highlightSearchResults = (results: Array<{ index: number; length: number }>, currentIndex: number) => {
    if (!contentRef.current) return
    
    clearHighlights()
    
    let html = policyContent
    const highlights: Array<{ start: number; end: number; isCurrent: boolean }> = []
    
    results.forEach((result, index) => {
      highlights.push({
        start: result.index,
        end: result.index + result.length,
        isCurrent: index === currentIndex
      })
    })
    
    // Sort highlights by start position in reverse order
    highlights.sort((a, b) => b.start - a.start)
    
    // Apply highlights
    highlights.forEach(highlight => {
      const className = highlight.isCurrent ? 'search-highlight-current' : 'search-highlight'
      html = html.slice(0, highlight.start) + 
        `<mark class="${className}">` + 
        html.slice(highlight.start, highlight.end) + 
        '</mark>' + 
        html.slice(highlight.end)
    })
    
    contentRef.current.innerHTML = html
  }

  const scrollToSearchResult = (result: { index: number; length: number }) => {
    const marks = contentRef.current?.getElementsByClassName('search-highlight-current')
    if (marks && marks[0]) {
      marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return
    
    let newIndex = currentSearchIndex
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length
    } else {
      newIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1
    }
    
    setCurrentSearchIndex(newIndex)
    highlightSearchResults(searchResults, newIndex)
    const result = searchResults[newIndex]
    if (result) {
      scrollToSearchResult(result)
    }
  }

  const toggleBookmark = (sectionId: string) => {
    setBookmarks(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  const copySection = async (section: PolicySection) => {
    try {
      await navigator.clipboard.writeText(section.content)
      setCopiedSection(section.id)
      setTimeout(() => setCopiedSection(null), 2000)
    } catch (error) {
      console.error('Failed to copy section:', error)
    }
  }

  const exportPolicy = async (format: 'pdf' | 'markdown' | 'text') => {
    const content = {
      title: metadata.title,
      company: metadata.company,
      lastUpdated: metadata.lastUpdated,
      content: policyContent,
      sections: sections
    }

    switch (format) {
      case 'text':
        downloadFile(`${metadata.company}-policy.txt`, policyContent, 'text/plain')
        break
      case 'markdown':
        const markdown = convertToMarkdown(content)
        downloadFile(`${metadata.company}-policy.md`, markdown, 'text/markdown')
        break
      case 'pdf':
        // In a real implementation, this would use a PDF generation library
        alert('PDF export would be implemented with a library like jsPDF')
        break
    }
  }

  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const convertToMarkdown = (content: any): string => {
    let markdown = `# ${content.title}\n\n`
    markdown += `**Company:** ${content.company}\n`
    markdown += `**Last Updated:** ${format(content.lastUpdated, 'MMMM d, yyyy')}\n\n`
    
    content.sections.forEach((section: PolicySection) => {
      const headerLevel = '#'.repeat(Math.min(section.level + 1, 6))
      markdown += `${headerLevel} ${section.title}\n\n`
      markdown += `${section.content}\n\n`
    })
    
    return markdown
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
    setIsFullscreen(!isFullscreen)
  }

  return (
    <div className={cn(
      "flex h-full",
      isDarkMode && "dark",
      isFullscreen && "fixed inset-0 z-50 bg-background",
      className
    )}>
      {/* Navigation Sidebar */}
      <div className="w-64 border-r bg-muted/10 hidden lg:block">
        <div className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-sm mb-2">Table of Contents</h3>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setSelectedSection(section.id)
                      onSectionClick?.(section)
                      const element = document.getElementById(section.id)
                      element?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                      "hover:bg-muted focus:bg-muted focus:outline-none",
                      selectedSection === section.id && "bg-muted font-medium",
                      section.level > 0 && `ml-${section.level * 4}`
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="line-clamp-1">{section.title}</span>
                      {bookmarks.includes(section.id) && (
                        <Bookmark className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    {section.changes && section.changes.length > 0 && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {section.changes.length} changes
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Bookmarks */}
          {bookmarks.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Bookmarks</h3>
              <div className="space-y-1">
                {bookmarks.map(id => {
                  const section = sections.find(s => s.id === id)
                  if (!section) return null
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        const element = document.getElementById(id)
                        element?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted"
                    >
                      {section.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b p-4 bg-background sticky top-0 z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">{metadata.title}</h2>
              <Badge variant="outline">
                {metadata.version || `Updated ${format(metadata.lastUpdated, 'MMM d, yyyy')}`}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              {showSearch ? (
                <div className="relative flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Search in document..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64"
                    autoFocus
                  />
                  {searchResults.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">
                        {currentSearchIndex + 1} of {searchResults.length}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigateSearch('prev')}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigateSearch('next')}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowSearch(false)
                      setSearchQuery('')
                      clearHighlights()
                    }}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSearch(true)}
                >
                  <Search className="h-4 w-4" />
                </Button>
              )}

              {/* View Options */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Type className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Font Size</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                          className="h-7 w-7 p-0"
                        >
                          <ZoomOut className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-8 text-center">{fontSize}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                          className="h-7 w-7 p-0"
                        >
                          <ZoomIn className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Dark Mode</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className="h-7 w-7 p-0"
                      >
                        {isDarkMode ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Show Changes</span>
                      <Button
                        size="sm"
                        variant={showChanges ? "secondary" : "ghost"}
                        onClick={() => setShowChanges(!showChanges)}
                        className="h-7 px-2"
                      >
                        {showChanges ? 'On' : 'Off'}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Export */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Download className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => exportPolicy('text')}
                    >
                      Export as Text
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => exportPolicy('markdown')}
                    >
                      Export as Markdown
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => exportPolicy('pdf')}
                    >
                      Export as PDF
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Other Actions */}
              <Button size="sm" variant="ghost" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {metadata.wordCount.toLocaleString()} words
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {metadata.readingTime} min read
            </div>
            {metadata.url && (
              <a
                href={metadata.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary"
              >
                <Eye className="h-3 w-3" />
                View original
              </a>
            )}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div
            ref={contentRef}
            className="prose prose-sm max-w-none p-8"
            style={{ fontSize: `${fontSize}px` }}
          >
            {sections.map((section) => (
              <div
                key={section.id}
                id={section.id}
                className={cn(
                  "group relative",
                  showChanges && section.changes && section.changes.length > 0 && "border-l-4 border-primary pl-4"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className={cn(
                    "font-semibold",
                    section.level === 0 && "text-2xl",
                    section.level === 1 && "text-xl",
                    section.level === 2 && "text-lg",
                    section.level > 2 && "text-base"
                  )}>
                    {section.title}
                  </h3>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleBookmark(section.id)}
                      className="h-7 w-7 p-0"
                    >
                      <Bookmark className={cn(
                        "h-3 w-3",
                        bookmarks.includes(section.id) && "fill-current"
                      )} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copySection(section)}
                      className="h-7 w-7 p-0"
                    >
                      {copiedSection === section.id ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>

                {showChanges && section.changes && section.changes.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {section.changes.map((change, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <Badge
                          variant={
                            change.type === 'added' ? 'success' :
                            change.type === 'removed' ? 'destructive' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {change.type}
                        </Badge>
                        <span className="text-muted-foreground">
                          {format(change.date, 'MMM d, yyyy')} - {change.summary}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="whitespace-pre-wrap">{section.content}</div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            // Show navigation sheet on mobile
          }}
        >
          <Hash className="h-4 w-4 mr-2" />
          Navigate Sections
        </Button>
      </div>
    </div>
  )
}

// Helper function to parse sections from content
function parseSections(content: string): PolicySection[] {
  const sections: PolicySection[] = []
  const lines = content.split('\n')
  let currentSection: PolicySection | null = null
  let sectionContent = ''
  let startIndex = 0
  
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] || ''
    
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    
    if (headerMatch && headerMatch[1] && headerMatch[2]) {
      // Save previous section
      if (currentSection) {
        currentSection.content = sectionContent.trim()
        currentSection.endIndex = startIndex
        currentSection.wordCount = sectionContent.split(/\s+/).filter(Boolean).length
        sections.push(currentSection)
      }
      
      // Start new section
      const level = headerMatch[1].length - 1
      const title = headerMatch[2]
      currentSection = {
        id: `section-${sections.length}`,
        title,
        level,
        content: '',
        startIndex: startIndex + line.length + 1,
        endIndex: 0,
        wordCount: 0
      }
      sectionContent = ''
    } else {
      sectionContent += line + '\n'
    }
    
    startIndex += line.length + 1
  }
  
  // Save last section
  if (currentSection) {
    currentSection.content = sectionContent.trim()
    currentSection.endIndex = content.length
    currentSection.wordCount = sectionContent.split(/\s+/).filter(Boolean).length
    sections.push(currentSection)
  }
  
  // If no sections found, create one for the entire content
  if (sections.length === 0) {
    sections.push({
      id: 'section-0',
      title: 'Policy Content',
      level: 0,
      content: content,
      startIndex: 0,
      endIndex: content.length,
      wordCount: content.split(/\s+/).filter(Boolean).length
    })
  }
  
  return sections
}

// Add styles for search highlighting
const searchStyles = `
  .search-highlight {
    background-color: yellow;
    padding: 0 2px;
  }
  
  .search-highlight-current {
    background-color: orange;
    padding: 0 2px;
    font-weight: bold;
  }
  
  @media print {
    .search-highlight,
    .search-highlight-current {
      background-color: transparent;
      font-weight: normal;
    }
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.innerHTML = searchStyles
  document.head.appendChild(styleElement)
}