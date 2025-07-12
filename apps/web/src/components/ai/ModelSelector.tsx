'use client'

import { useState, useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Info, Zap, Brain, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModelCatalog } from '@/lib/ai/model-catalog'

interface UIModel {
  id: string
  name: string
  provider: string
  description: string
  speed: 'fast' | 'medium' | 'slow'
  quality: 'good' | 'better' | 'best'
  cost: 'free' | 'low' | 'medium' | 'high'
  features?: string[]
}

// Map model categories to UI attributes
const getModelAttributes = (modelId: string): UIModel | null => {
  const model = ModelCatalog.getModel(modelId)
  if (!model) return null
  
  // Map speed from capabilities  
  let speed: 'fast' | 'medium' | 'slow' = 'medium'
  if (model.capabilities.speed === 'fast') speed = 'fast'
  else if (model.capabilities.speed === 'slow') speed = 'slow'
  else speed = 'medium' // for 'balanced'
  
  // Map quality to UI representation
  let quality: 'good' | 'better' | 'best' = 'good'
  if (model.capabilities.quality === 'good') quality = 'better'
  else if (model.capabilities.quality === 'excellent') quality = 'best'
  
  // Determine cost based on pricing
  let cost: 'free' | 'low' | 'medium' | 'high' = 'medium'
  if (model.id.includes(':free')) cost = 'free'
  else if (model.capabilities.costPer1kTokens.input < 0.001) cost = 'low'
  else if (model.capabilities.costPer1kTokens.input > 0.01) cost = 'high'
  
  // Map features from capabilities
  const features = []
  if (model.capabilities.supportsWebSearch) features.push('Web search')
  if (model.capabilities.supportsTools) features.push('Tool usage')
  if (model.capabilities.supportsStreaming) features.push('Streaming')
  if (model.capabilities.supportsThinking) features.push('Advanced reasoning')
  
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    description: `${model.capabilities.quality} model with ${model.capabilities.speed} performance`,
    speed,
    quality,
    cost,
    features
  }
}

interface ModelSelectorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function ModelSelector({ value, onChange, disabled, className }: ModelSelectorProps) {
  const models = useMemo(() => {
    const allModels = ModelCatalog.getAllModels()
    return allModels
      .map(model => getModelAttributes(model.id))
      .filter((m): m is UIModel => m !== null)
  }, [])
  
  const selectedModel = models.find(m => m.id === value) || models[0]

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'good': return 'text-green-600'
      case 'better': return 'text-blue-600'
      case 'best': return 'text-purple-600'
      default: return 'text-gray-600'
    }
  }

  const getSpeedIcon = (speed: string) => {
    switch (speed) {
      case 'fast': return <Zap className="h-3 w-3" />
      case 'medium': return <Brain className="h-3 w-3" />
      case 'slow': return <Sparkles className="h-3 w-3" />
      default: return <Info className="h-3 w-3" />
    }
  }

  const getCostBadge = (cost: string) => {
    switch (cost) {
      case 'free': return <Badge variant="success" className="text-xs">Free</Badge>
      case 'low': return <Badge variant="secondary" className="text-xs">$</Badge>
      case 'medium': return <Badge variant="secondary" className="text-xs">$$</Badge>
      case 'high': return <Badge variant="secondary" className="text-xs">$$$</Badge>
      default: return null
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor="model-select" className="text-sm font-medium">
        AI Model
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="model-select" className="w-full">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id} className="py-3">
              <div className="flex items-start justify-between w-full gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-xs text-muted-foreground">by {model.provider}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
                  {model.features && model.features.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {model.features.map((feature, i) => (
                        <span key={i} className="text-xs text-muted-foreground">
                          {feature}{i < (model.features?.length || 0) - 1 && ' •'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {getSpeedIcon(model.speed)}
                    <span className={cn("text-xs font-medium", getQualityColor(model.quality))}>
                      {model.quality}
                    </span>
                  </div>
                  {getCostBadge(model.cost)}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedModel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          <span>
            {selectedModel.speed === 'fast' && 'Quick results, ideal for summaries'}
            {selectedModel.speed === 'medium' && 'Balanced speed and quality'}
            {selectedModel.speed === 'slow' && 'Thorough analysis, may take longer'}
          </span>
        </div>
      )}
    </div>
  )
}