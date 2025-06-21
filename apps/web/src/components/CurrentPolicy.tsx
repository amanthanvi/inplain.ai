'use client'

import { useState, useEffect } from 'react'
import { useStreamingAnalysis } from '@/hooks/useStreamingAnalysis'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, FileText, Calendar, Hash, Sparkles, Shield, AlertCircle, CheckCircle2, Info, Users, Lock, Cookie, Clock, Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface CurrentPolicyProps {
  slug: string
}

export function CurrentPolicy({ slug }: CurrentPolicyProps) {
  const [snapshot, setSnapshot] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useStreaming, setUseStreaming] = useState(true)
  const streaming = useStreamingAnalysis()

  useEffect(() => {
    fetchSnapshot()
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSnapshot = async () => {
    try {
      const response = await fetch(`/api/snapshot/${slug}`)
      
      if (response.status === 404) {
        // No snapshot exists yet - this is expected for new companies
        setSnapshot(null)
        setLoading(false)
        return
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch snapshot')
      }
      
      const data = await response.json()
      setSnapshot(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policy')
    } finally {
      setLoading(false)
    }
  }

  const analyzePolicy = async () => {
    if (useStreaming) {
      streaming.reset()
      await streaming.startStreaming(slug)
    } else {
      setAnalyzing(true)
      try {
        const response = await fetch(`/api/analyze/${slug}`, {
          method: 'POST'
        })
        if (!response.ok) {
          throw new Error('Failed to analyze policy')
        }
        const data = await response.json()
        setAnalysis(data.analysis)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to analyze policy')
      } finally {
        setAnalyzing(false)
      }
    }
  }

  // Unified analysis data from either regular or streaming
  const currentAnalysis = analysis || streaming.analysis
  
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !snapshot) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <p className="text-muted-foreground">
            {error || 'No policy snapshot available yet'}
          </p>
          {!error && (
            <p className="text-sm text-muted-foreground">
              The first snapshot will be captured during the next daily check at 9 AM UTC.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current Policy Version</CardTitle>
            <Badge variant="secondary">
              {formatDistanceToNow(new Date(snapshot.snapshot.capturedAt), { addSuffix: true })}
            </Badge>
          </div>
          <CardDescription>
            Last captured on {new Date(snapshot.snapshot.capturedAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Words:</span>
              <span className="font-medium">{snapshot.content.wordCount.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Characters:</span>
              <span className="font-medium">{snapshot.content.characterCount.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              asChild
            >
              <a href={snapshot.snapshot.url} target="_blank" rel="noopener noreferrer">
                View Original
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={analyzePolicy}
              disabled={analyzing || streaming.isStreaming || !!currentAnalysis}
            >
              {(analyzing || streaming.isStreaming) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : currentAnalysis ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analysis Ready
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyze with AI
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(streaming.isStreaming || streaming.content) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Analysis {streaming.isStreaming && '(Streaming...)'}
            </CardTitle>
            {streaming.metadata && (
              <CardDescription>
                Model: {streaming.metadata.model}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {streaming.error ? (
              <InteractiveMarkdown content={formatErrorToMarkdown(streaming.error)} />
            ) : streaming.isStreaming ? (
              <InteractiveMarkdown content={formatLoadingMarkdown()} />
            ) : null}
          </CardContent>
        </Card>
      )}

      {currentAnalysis && !streaming.isStreaming && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Analysis
            </CardTitle>
            <CardDescription>
              Generated {formatDistanceToNow(new Date(currentAnalysis.generatedAt), { addSuffix: true })}
              {' • '}Model: {currentAnalysis.model}
              {currentAnalysis.cached && ' • Cached'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(currentAnalysis.structured_content && !currentAnalysis.structured_content.parse_error) ? (
              <InteractiveMarkdown 
                content={formatAnalysisToMarkdown(currentAnalysis.structured_content)} 
              />
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div className="whitespace-pre-wrap">{currentAnalysis.raw_content || currentAnalysis.content}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}