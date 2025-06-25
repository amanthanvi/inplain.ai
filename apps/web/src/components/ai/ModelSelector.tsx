'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Info, Zap, Brain, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AIModel {
  id: string
  name: string
  provider: string
  description: string
  speed: 'fast' | 'medium' | 'slow'
  quality: 'good' | 'better' | 'best'
  cost: 'free' | 'low' | 'medium' | 'high'
  features?: string[]
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'google/gemini-2.0-flash-preview-05-20:free',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    description: 'Fast and efficient for quick analysis',
    speed: 'fast',
    quality: 'good',
    cost: 'free',
    features: ['Quick summaries', 'Basic analysis']
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    description: 'Fast and cost-effective',
    speed: 'fast',
    quality: 'good',
    cost: 'low',
    features: ['Fast analysis', 'Good accuracy']
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Balanced performance and quality',
    speed: 'medium',
    quality: 'better',
    cost: 'medium',
    features: ['Detailed analysis', 'High accuracy', 'Nuanced insights']
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'Advanced analysis with visual understanding',
    speed: 'medium',
    quality: 'best',
    cost: 'medium',
    features: ['Comprehensive analysis', 'Visual processing', 'Complex reasoning']
  },
  {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    description: 'Highest quality, most thorough analysis',
    speed: 'slow',
    quality: 'best',
    cost: 'high',
    features: ['Expert-level analysis', 'Maximum accuracy', 'Deep insights']
  }
]

interface ModelSelectorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function ModelSelector({ value, onChange, disabled, className }: ModelSelectorProps) {
  const selectedModel = AI_MODELS.find(m => m.id === value) || AI_MODELS[0]

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
          {AI_MODELS.map((model) => (
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