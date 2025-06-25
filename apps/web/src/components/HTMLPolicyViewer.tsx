'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  FileText, Eye, Code, List, Hash, Clock, 
  AlertCircle, ChevronRight, Search, Copy, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface HTMLPolicyViewerProps {
  htmlContent: string
  metadata?: {
    capturedAt?: string
    url?: string
    wordCount?: number
    characterCount?: number
  }
}

// Safe HTML sanitization function
function sanitizeHTML(html: string): string {
  // Remove script tags and their content
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  
  // Remove style tags (we'll apply our own styles)
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  
  // Remove on* event handlers
  cleaned = cleaned.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
  
  // Remove javascript: URLs
  cleaned = cleaned.replace(/javascript:/gi, '')
  
  return cleaned
}

// Extract text content from HTML
function extractTextContent(html: string): string {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = sanitizeHTML(html)
  return tempDiv.textContent || tempDiv.innerText || ''
}

// Extract sections from HTML
function extractSections(html: string): Array<{ id: string; title: string; content: string }> {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = sanitizeHTML(html)
  
  const sections: Array<{ id: string; title: string; content: string }> = []
  const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6')
  
  headings.forEach((heading, index) => {
    const title = heading.textContent || `Section ${index + 1}`
    const id = `section-${index}`
    
    // Get content until next heading
    let content = ''
    let nextElement = heading.nextElementSibling
    
    while (nextElement && !['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(nextElement.tagName)) {
      content += nextElement.outerHTML
      nextElement = nextElement.nextElementSibling
    }
    
    sections.push({ id, title: title.trim(), content })
  })
  
  // If no headings found, treat the whole content as one section
  if (sections.length === 0) {
    sections.push({
      id: 'main',
      title: 'Privacy Policy',
      content: tempDiv.innerHTML
    })
  }
  
  return sections
}

export function HTMLPolicyViewer({ htmlContent, metadata }: HTMLPolicyViewerProps) {
  const [viewMode, setViewMode] = useState<'formatted' | 'outline' | 'raw'>('formatted')
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [copied, setCopied] = useState(false)

  const sanitizedContent = useMemo(() => sanitizeHTML(htmlContent), [htmlContent])
  const textContent = useMemo(() => extractTextContent(htmlContent), [htmlContent])
  const sections = useMemo(() => extractSections(htmlContent), [htmlContent])
  
  const wordCount = metadata?.wordCount || textContent.split(/\s+/).filter(Boolean).length
  const charCount = metadata?.characterCount || textContent.length

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(textContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  const highlightSearchTerm = (text: string) => {
    if (!searchTerm) return text
    
    // Escape special regex characters in search term
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi')
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>')
  }

  const filteredSections = useMemo(() => {
    if (!searchTerm) return sections
    
    return sections.filter(section => 
      section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [sections, searchTerm])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Privacy Policy Viewer</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                <FileText className="mr-1 h-3 w-3" />
                {wordCount.toLocaleString()} words
              </Badge>
              <Badge variant="outline">
                <Hash className="mr-1 h-3 w-3" />
                {charCount.toLocaleString()} chars
              </Badge>
            </div>
          </div>
          {metadata?.capturedAt && (
            <CardDescription>
              Captured on {new Date(metadata.capturedAt).toLocaleDateString()}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                <TabsList>
                  <TabsTrigger value="formatted">
                    <Eye className="mr-2 h-4 w-4" />
                    Formatted
                  </TabsTrigger>
                  <TabsTrigger value="outline">
                    <List className="mr-2 h-4 w-4" />
                    Outline
                  </TabsTrigger>
                  <TabsTrigger value="raw">
                    <Code className="mr-2 h-4 w-4" />
                    Raw HTML
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="flex-1" />
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyText}
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Text
                  </>
                )}
              </Button>
              
              {metadata?.url && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={metadata.url} target="_blank" rel="noopener noreferrer">
                    View Original
                  </a>
                </Button>
              )}
            </div>

            {/* Search Bar */}
            {viewMode !== 'raw' && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search in policy..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            )}

            {/* Content Display */}
            <div className="mt-4">
              {viewMode === 'formatted' && (
                <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                  <div 
                    className="policy-viewer"
                    dangerouslySetInnerHTML={{ 
                      __html: searchTerm ? highlightSearchTerm(sanitizedContent) : sanitizedContent 
                    }}
                  />
                </ScrollArea>
              )}

              {viewMode === 'outline' && (
                <div className="grid grid-cols-12 gap-4">
                  {/* Section List */}
                  <div className="col-span-4">
                    <ScrollArea className="h-[600px] w-full rounded-md border">
                      <div className="p-4 space-y-2">
                        {filteredSections.map((section) => (
                          <button
                            key={section.id}
                            onClick={() => setSelectedSection(section.id)}
                            className={cn(
                              "w-full text-left p-3 rounded-md transition-colors",
                              "hover:bg-accent hover:text-accent-foreground",
                              selectedSection === section.id && "bg-accent text-accent-foreground"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{section.title}</span>
                              <ChevronRight className="h-4 w-4" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Section Content */}
                  <div className="col-span-8">
                    <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                      {selectedSection ? (
                        <div className="space-y-4">
                          <h2 className="text-xl font-semibold">
                            {sections.find(s => s.id === selectedSection)?.title}
                          </h2>
                          <div 
                            className="policy-viewer"
                            dangerouslySetInnerHTML={{ 
                              __html: searchTerm 
                                ? highlightSearchTerm(sections.find(s => s.id === selectedSection)?.content || '')
                                : sections.find(s => s.id === selectedSection)?.content || ''
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <p>Select a section to view its content</p>
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              )}

              {viewMode === 'raw' && (
                <ScrollArea className="h-[600px] w-full rounded-md border">
                  <pre className="p-4 text-xs font-mono">
                    <code>{htmlContent}</code>
                  </pre>
                </ScrollArea>
              )}
            </div>

            {/* Info Alert */}
            {sections.length > 10 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This policy contains {sections.length} sections. Use the outline view for easier navigation.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}