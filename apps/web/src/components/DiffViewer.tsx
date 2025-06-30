'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getDiff, getSummary } from '@/lib/api'
import { LoadingSpinner } from './LoadingSpinner'
import { DiffCard } from './DiffCard'
import { ModelSelector } from './ModelSelector'
import { useToast } from '@/components/ui/use-toast'

interface DiffViewerProps {
  slug: string
}

export function DiffViewer({ slug }: DiffViewerProps) {
  const [diffData, setDiffData] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [showRawDiff, setShowRawDiff] = useState(false)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('google/gemini-2.5-flash-preview-05-20')
  const { toast } = useToast()

  useEffect(() => {
    async function fetchDiff() {
      const data = await getDiff(slug)
      if (data) {
        setDiffData(data)
        
        if (data.diff.summaryId) {
          const summaryData = await getSummary(slug, data.diff.id)
          setSummary(summaryData)
        }
      }
      setLoading(false)
    }
    
    fetchDiff()
  }, [slug])

  async function generateSummary() {
    if (!diffData) {
      console.error('No diff data available')
      toast({
        title: "Error",
        description: "No diff data available to generate summary",
        variant: "destructive",
      })
      return
    }
    
    if (!diffData.diff?.id) {
      console.error('Diff data missing ID:', diffData)
      toast({
        title: "Error",
        description: "Invalid diff data structure",
        variant: "destructive",
      })
      return
    }
    
    setLoadingSummary(true)
    try {
      console.log('Generating summary for diff:', {
        diffId: diffData.diff.id,
        slug,
        model: selectedModel
      })
      
      const response = await fetch(`/api/summary/${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          diffId: diffData.diff.id,
          model: selectedModel,
          force: true
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `Summary generation failed (${response.status})`
        
        console.error('Summary API error:', {
          status: response.status,
          errorData,
          requestBody: {
            diffId: diffData.diff.id,
            model: selectedModel,
            force: true
          }
        })
        
        // Add specific error handling for common issues
        if (response.status === 400) {
          const details = errorData.details ? errorData.details.map((d: any) => `${d.field}: ${d.message}`).join(', ') : ''
          throw new Error(`Invalid request: ${errorMessage}${details ? ` (${details})` : ''}. ${errorData.received ? `Received: ${JSON.stringify(errorData.received)}` : ''}`)
        } else if (response.status === 500) {
          throw new Error(`${errorMessage}. Please try again or select a different model.`)
        } else if (response.status === 503) {
          throw new Error('Storage service not configured. Please check server configuration.')
        } else if (response.status === 404) {
          throw new Error('Diff not found. Please refresh the page and try again.')
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.')
        } else {
          throw new Error(errorMessage)
        }
      }
      
      const result = await response.json()
      
      if (!result.summary) {
        throw new Error('No summary data received from the server')
      }
      
      setSummary(result.summary)
      
      toast({
        title: "Summary generated",
        description: `Analysis complete using ${selectedModel.split('/')[1]}`,
      })
    } catch (error) {
      console.error('Summary generation error:', error)
      
      toast({
        title: "Summary Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate summary",
        variant: "destructive",
      })
    } finally {
      setLoadingSummary(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (!diffData) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No changes detected yet for this policy</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <DiffCard diff={diffData.diff} summary={summary} />

      {!summary && (
        <div className="space-y-4">
          <div className="flex gap-2 justify-center">
            <Button onClick={generateSummary} disabled={loadingSummary}>
              {loadingSummary ? "Generating..." : "Generate AI Summary"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowModelSelector(!showModelSelector)}
            >
              Choose Model
            </Button>
          </div>
          
          {showModelSelector && (
            <ModelSelector
              selectedModel={selectedModel}
              onModelSelect={(model) => {
                setSelectedModel(model)
                setShowModelSelector(false)
                toast({
                  title: "Model selected",
                  description: `Using ${model.split('/')[1]} for analysis`,
                })
              }}
              showCosts={true}
            />
          )}
        </div>
      )}

      <div className="space-y-2">
        <Button 
          variant="outline" 
          onClick={() => setShowRawDiff(!showRawDiff)}
          className="w-full"
        >
          {showRawDiff ? "Hide" : "Show"} Raw Diff
        </Button>

        {showRawDiff && (
          <Card>
            <CardContent className="p-4">
              <div 
                className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-words overflow-x-auto max-h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded"
                dangerouslySetInnerHTML={{ 
                  __html: diffData.htmlDiff
                    // Add inline styles to the diff elements
                    .replace(/<ins class="diff-addition">/g, '<ins style="background-color: #d4f4dd; color: #22863a; text-decoration: none; padding: 2px 4px; border-radius: 3px;">')
                    .replace(/<del class="diff-deletion">/g, '<del style="background-color: #ffeef0; color: #cb2431; text-decoration: line-through; padding: 2px 4px; border-radius: 3px;">')
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}