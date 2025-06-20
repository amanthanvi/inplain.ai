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
    if (!diffData) return
    
    setLoadingSummary(true)
    try {
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
        throw new Error('Failed to generate summary')
      }
      
      const result = await response.json()
      setSummary(result.summary)
      
      toast({
        title: "Summary generated",
        description: `Analysis complete using ${selectedModel.split('/')[1]}`,
      })
    } catch (error) {
      toast({
        title: "Error",
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
                className="prose prose-sm max-w-none overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: diffData.htmlDiff }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}