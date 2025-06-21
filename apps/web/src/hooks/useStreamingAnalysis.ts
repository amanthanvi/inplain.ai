import { useState, useCallback } from 'react'

export interface StreamingAnalysisState {
  isStreaming: boolean
  content: string
  metadata?: {
    model: string
    snapshotId: string
    wordCount: number
  }
  analysis?: any
  error?: string
}

export function useStreamingAnalysis() {
  const [state, setState] = useState<StreamingAnalysisState>({
    isStreaming: false,
    content: ''
  })

  const startStreaming = useCallback(async (slug: string) => {
    setState({ isStreaming: true, content: '', error: undefined })

    try {
      const response = await fetch(`/api/analyze-stream/${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        setState(prev => ({ 
          ...prev, 
          isStreaming: false, 
          error: error.error || 'Failed to start analysis' 
        }))
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        setState(prev => ({ 
          ...prev, 
          isStreaming: false, 
          error: 'No response body' 
        }))
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (!data) continue

            try {
              const parsed = JSON.parse(data)

              switch (parsed.type) {
                case 'metadata':
                  setState(prev => ({
                    ...prev,
                    metadata: {
                      model: parsed.model,
                      snapshotId: parsed.snapshotId,
                      wordCount: parsed.wordCount
                    }
                  }))
                  break

                case 'content':
                  setState(prev => ({
                    ...prev,
                    content: prev.content + parsed.content
                  }))
                  break

                case 'complete':
                  setState(prev => ({
                    ...prev,
                    isStreaming: false,
                    analysis: parsed.analysis
                  }))
                  break

                case 'error':
                  setState(prev => ({
                    ...prev,
                    isStreaming: false,
                    error: parsed.error
                  }))
                  break
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e)
            }
          }
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [])

  const reset = useCallback(() => {
    setState({
      isStreaming: false,
      content: ''
    })
  }, [])

  return {
    ...state,
    startStreaming,
    reset
  }
}