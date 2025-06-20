'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AIModel {
  id: string
  name: string
  provider: string
  contextLength: number
  costPer1kTokens: {
    input: number
    output: number
  }
  recommended?: boolean
}

interface ModelSelectorProps {
  selectedModel?: string
  onModelSelect: (modelId: string) => void
  showCosts?: boolean
}

export function ModelSelector({ selectedModel, onModelSelect, showCosts = false }: ModelSelectorProps) {
  const [models, setModels] = useState<AIModel[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('/api/models?recommended=true')
        const data = await response.json()
        setModels(data.models)
      } catch (error) {
        console.error('Failed to fetch models:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchModels()
  }, [])

  const toggleShowAll = async () => {
    if (!showAll) {
      try {
        const response = await fetch('/api/models')
        const data = await response.json()
        setModels(data.models)
      } catch (error) {
        console.error('Failed to fetch all models:', error)
      }
    } else {
      const response = await fetch('/api/models?recommended=true')
      const data = await response.json()
      setModels(data.models)
    }
    setShowAll(!showAll)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Model</CardTitle>
          <CardDescription>Loading available models...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AI Model Selection</CardTitle>
            <CardDescription>
              Choose the AI model for policy analysis
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={toggleShowAll}>
            {showAll ? 'Show Recommended' : 'Show All Models'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {models.map((model) => (
            <div
              key={model.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedModel === model.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => onModelSelect(model.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div>
                    <div className="font-medium">{model.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {model.provider} • {(model.contextLength / 1000).toFixed(0)}K context
                    </div>
                  </div>
                  {model.recommended && (
                    <Badge variant="secondary" className="text-xs">
                      Recommended
                    </Badge>
                  )}
                </div>
                {showCosts && (
                  <div className="text-right text-sm">
                    <div className="text-muted-foreground">
                      ${model.costPer1kTokens.input.toFixed(3)} / ${model.costPer1kTokens.output.toFixed(3)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      input / output per 1K tokens
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {models.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No models available
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ModelInfo({ modelId }: { modelId: string }) {
  const [model, setModel] = useState<AIModel | null>(null)

  useEffect(() => {
    async function fetchModelInfo() {
      try {
        const response = await fetch('/api/models')
        const data = await response.json()
        const foundModel = data.models.find((m: AIModel) => m.id === modelId)
        setModel(foundModel || null)
      } catch (error) {
        console.error('Failed to fetch model info:', error)
      }
    }
    
    if (modelId) {
      fetchModelInfo()
    }
  }, [modelId])

  if (!model) {
    return (
      <Badge variant="outline" className="text-xs">
        {modelId}
      </Badge>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="text-xs">
        {model.name}
      </Badge>
      {model.recommended && (
        <Badge variant="outline" className="text-xs">
          ⭐ Recommended
        </Badge>
      )}
    </div>
  )
}