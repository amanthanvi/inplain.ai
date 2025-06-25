'use client'

import { useState } from 'react'
import { 
  ChevronUp, ChevronDown, Search, Share2, 
  Bookmark, ZoomIn, ZoomOut, FileText,
  X, Menu
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { AnimatedContainer } from '@/components/ui/animations'

interface MobilePolicyViewerProps {
  content: string
  metadata?: {
    title?: string
    lastUpdated?: string
    wordCount?: number
  }
  highlightedSections?: string[]
}

export function MobilePolicyViewer({ 
  content, 
  metadata,
  highlightedSections = []
}: MobilePolicyViewerProps) {
  const [fontSize, setFontSize] = useState(16)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showTableOfContents, setShowTableOfContents] = useState(false)
  const [savedPosition, setSavedPosition] = useState(0)

  // Extract sections from content
  const sections = extractSections(content)

  const handleFontSizeChange = (delta: number) => {
    setFontSize(prev => Math.max(12, Math.min(24, prev + delta)))
  }

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setShowTableOfContents(false)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: metadata?.title || 'Privacy Policy',
          text: 'Check out this privacy policy',
          url: window.location.href
        })
      } catch (err) {
        console.log('Share failed:', err)
      }
    }
  }

  return (
    <div className="relative">
      {/* Mobile Header */}
      <div className="sticky top-14 z-40 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center justify-between p-2">
          {/* Left Actions */}
          <div className="flex items-center gap-1">
            <Sheet open={showTableOfContents} onOpenChange={setShowTableOfContents}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle>Table of Contents</SheetTitle>
                </SheetHeader>
                <nav className="mt-4 space-y-1">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                        "hover:bg-muted",
                        highlightedSections.includes(section.id) && "bg-primary/10 text-primary font-medium"
                      )}
                      style={{ paddingLeft: `${section.level * 12}px` }}
                    >
                      {section.title}
                    </button>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {/* Font Size Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFontSizeChange(-2)}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs px-2 min-w-[3rem] text-center">
              {Math.round((fontSize / 16) * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFontSizeChange(2)}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <AnimatedContainer animation="slideUp" className="p-2 border-t">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search in policy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 h-9 text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9"
                onClick={() => {
                  setSearchQuery('')
                  setShowSearch(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </AnimatedContainer>
        )}
      </div>

      {/* Metadata Bar */}
      {metadata && (
        <div className="bg-muted/50 px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {metadata.lastUpdated && `Updated ${new Date(metadata.lastUpdated).toLocaleDateString()}`}
          </span>
          {metadata.wordCount && (
            <Badge variant="secondary" className="text-xs">
              {metadata.wordCount.toLocaleString()} words
            </Badge>
          )}
        </div>
      )}

      {/* Content */}
      <div 
        className="px-4 py-6 max-w-3xl mx-auto"
        style={{ fontSize: `${fontSize}px` }}
      >
        <div 
          className="policy-content space-y-4"
          dangerouslySetInnerHTML={{ 
            __html: highlightSearchQuery(content, searchQuery) 
          }}
        />
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-2">
        <AnimatedContainer animation="scale" delay={0.1}>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={() => {
              const currentPosition = window.scrollY
              setSavedPosition(currentPosition)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
        </AnimatedContainer>
        
        {savedPosition > 0 && (
          <AnimatedContainer animation="scale" delay={0.2}>
            <Button
              size="icon"
              variant="outline"
              className="h-12 w-12 rounded-full shadow-lg"
              onClick={() => {
                window.scrollTo({ top: savedPosition, behavior: 'smooth' })
                setSavedPosition(0)
              }}
            >
              <Bookmark className="h-5 w-5" />
            </Button>
          </AnimatedContainer>
        )}
      </div>
    </div>
  )
}

// Helper functions
function extractSections(content: string): Array<{ id: string; title: string; level: number }> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/html')
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6')
  
  return Array.from(headings).map((heading, index) => ({
    id: `section-${index}`,
    title: heading.textContent || '',
    level: parseInt(heading.tagName.charAt(1))
  }))
}

function highlightSearchQuery(content: string, query: string): string {
  if (!query || query.length < 3) return content
  
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  
  return content.replace(regex, '<mark class="bg-yellow-200 text-black">$1</mark>')
}

// Responsive wrapper
export function ResponsivePolicyViewer(props: MobilePolicyViewerProps & { desktopComponent: React.ReactNode }) {
  return (
    <>
      <div className="md:hidden">
        <MobilePolicyViewer {...props} />
      </div>
      <div className="hidden md:block">
        {props.desktopComponent}
      </div>
    </>
  )
}