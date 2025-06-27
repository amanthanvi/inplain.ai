'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  CheckCircle, XCircle, AlertTriangle, Eye, 
  Contrast, Keyboard, MousePointer, Volume2 
} from 'lucide-react'
import { checkColorContrast } from '@/lib/accessibility'
import { cn } from '@/lib/utils'

interface AccessibilityIssue {
  id: string
  type: 'error' | 'warning' | 'info'
  category: string
  message: string
  element?: HTMLElement
  wcagCriteria?: string
}

export function AccessibilityAudit() {
  const [issues, setIssues] = useState<AccessibilityIssue[]>([])
  const [isAuditing, setIsAuditing] = useState(false)
  const [showAudit, setShowAudit] = useState(false)

  const runAudit = async () => {
    setIsAuditing(true)
    const newIssues: AccessibilityIssue[] = []

    // Check for images without alt text
    const images = document.querySelectorAll('img')
    images.forEach((img, index) => {
      if (!img.alt && !img.getAttribute('aria-label') && img.getAttribute('role') !== 'presentation') {
        newIssues.push({
          id: `img-alt-${index}`,
          type: 'error',
          category: 'Images',
          message: `Image missing alt text: ${img.src}`,
          element: img as HTMLElement,
          wcagCriteria: '1.1.1'
        })
      }
    })

    // Check for form inputs without labels
    const inputs = document.querySelectorAll('input, textarea, select')
    inputs.forEach((input, index) => {
      const id = input.id
      const ariaLabel = input.getAttribute('aria-label')
      const ariaLabelledBy = input.getAttribute('aria-labelledby')
      
      if (!id || (!document.querySelector(`label[for="${id}"]`) && !ariaLabel && !ariaLabelledBy)) {
        newIssues.push({
          id: `input-label-${index}`,
          type: 'error',
          category: 'Forms',
          message: `Form input missing label: ${input.getAttribute('name') || input.getAttribute('type') || 'unknown'}`,
          element: input as HTMLElement,
          wcagCriteria: '3.3.2'
        })
      }
    })

    // Check for buttons without accessible text
    const buttons = document.querySelectorAll('button, [role="button"]')
    buttons.forEach((button, index) => {
      const text = button.textContent?.trim()
      const ariaLabel = button.getAttribute('aria-label')
      
      if (!text && !ariaLabel) {
        newIssues.push({
          id: `button-text-${index}`,
          type: 'error',
          category: 'Buttons',
          message: 'Button missing accessible text',
          element: button as HTMLElement,
          wcagCriteria: '4.1.2'
        })
      }
    })

    // Check heading structure
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    let previousLevel = 0
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName[1]!)
      
      if (previousLevel > 0 && level - previousLevel > 1) {
        newIssues.push({
          id: `heading-structure-${index}`,
          type: 'warning',
          category: 'Structure',
          message: `Heading level skipped: h${previousLevel} to h${level}`,
          element: heading as HTMLElement,
          wcagCriteria: '1.3.1'
        })
      }
      
      previousLevel = level
    })

    // Check for links without descriptive text
    const links = document.querySelectorAll('a[href]')
    links.forEach((link, index) => {
      const text = link.textContent?.trim().toLowerCase()
      const badLinkTexts = ['click here', 'here', 'read more', 'link', 'more']
      
      if (text && badLinkTexts.includes(text)) {
        newIssues.push({
          id: `link-text-${index}`,
          type: 'warning',
          category: 'Links',
          message: `Link has non-descriptive text: "${text}"`,
          element: link as HTMLElement,
          wcagCriteria: '2.4.4'
        })
      }
    })

    // Check color contrast (simplified check)
    const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, li, td, th')
    textElements.forEach((element, index) => {
      const computedStyle = window.getComputedStyle(element)
      const color = computedStyle.color
      const backgroundColor = computedStyle.backgroundColor
      
      if (color && backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
        // Note: This is a simplified check - real contrast checking would need to handle more cases
        const fontSize = parseFloat(computedStyle.fontSize)
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && computedStyle.fontWeight === 'bold')
        
        // Skip the actual contrast calculation for now as it requires color parsing
        // In a real implementation, you would use the checkColorContrast function
      }
    })

    // Check for keyboard accessibility
    const interactiveElements = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [onclick]')
    interactiveElements.forEach((element, index) => {
      const tabIndex = element.getAttribute('tabindex')
      
      if (tabIndex === '-1' && !element.closest('[aria-hidden="true"]')) {
        newIssues.push({
          id: `keyboard-access-${index}`,
          type: 'warning',
          category: 'Keyboard',
          message: 'Interactive element not keyboard accessible',
          element: element as HTMLElement,
          wcagCriteria: '2.1.1'
        })
      }
    })

    setIssues(newIssues)
    setIsAuditing(false)
  }

  const getIssueIcon = (category: string) => {
    switch (category) {
      case 'Images':
        return <Eye className="h-4 w-4" />
      case 'Forms':
        return <MousePointer className="h-4 w-4" />
      case 'Keyboard':
        return <Keyboard className="h-4 w-4" />
      case 'Structure':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getIssueTypeIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />
      case 'info':
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      default:
        return null
    }
  }

  const highlightElement = (element?: HTMLElement) => {
    if (!element) return

    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element.style.outline = '3px solid red'
    element.style.outlineOffset = '2px'
    
    setTimeout(() => {
      element.style.outline = ''
      element.style.outlineOffset = ''
    }, 3000)
  }

  const errorCount = issues.filter(i => i.type === 'error').length
  const warningCount = issues.filter(i => i.type === 'warning').length

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setShowAudit(!showAudit)}
          size="icon"
          className="rounded-full shadow-lg"
          aria-label="Toggle accessibility audit"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>

      {/* Audit panel */}
      {showAudit && (
        <Card className="fixed bottom-16 right-4 z-50 w-96 max-h-[600px] overflow-hidden shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Accessibility Audit
              <div className="flex gap-2">
                {errorCount > 0 && (
                  <Badge variant="destructive">{errorCount} errors</Badge>
                )}
                {warningCount > 0 && (
                  <Badge variant="secondary">{warningCount} warnings</Badge>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              WCAG 2.1 AA compliance check
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button
                onClick={runAudit}
                disabled={isAuditing}
                className="w-full"
              >
                {isAuditing ? 'Running audit...' : 'Run audit'}
              </Button>

              {issues.length > 0 && (
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {issues.map((issue) => (
                    <Alert
                      key={issue.id}
                      className={cn(
                        'cursor-pointer',
                        issue.type === 'error' && 'border-destructive',
                        issue.type === 'warning' && 'border-amber-600'
                      )}
                      onClick={() => highlightElement(issue.element)}
                    >
                      <div className="flex items-start gap-2">
                        {getIssueTypeIcon(issue.type)}
                        <div className="flex-1 space-y-1">
                          <AlertTitle className="text-sm flex items-center gap-2">
                            {getIssueIcon(issue.category)}
                            {issue.category}
                            {issue.wcagCriteria && (
                              <Badge variant="outline" className="text-xs">
                                WCAG {issue.wcagCriteria}
                              </Badge>
                            )}
                          </AlertTitle>
                          <AlertDescription className="text-xs">
                            {issue.message}
                          </AlertDescription>
                        </div>
                      </div>
                    </Alert>
                  ))}
                </div>
              )}

              {issues.length === 0 && !isAuditing && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>No issues found</AlertTitle>
                  <AlertDescription>
                    Run an audit to check for accessibility issues
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}