/**
 * Model Catalog for Inplain.AI
 * 
 * Provides a clean API for accessing and querying AI models
 * with their capabilities and configurations.
 */

import { MODEL_CATALOG, ModelConfig, AnalysisTask } from './unified-ai-service'

export class ModelCatalog {
  /**
   * Get all available models
   */
  static getAllModels(): ModelConfig[] {
    return Object.values(MODEL_CATALOG)
  }

  /**
   * Get a specific model by ID
   */
  static getModel(id: string): ModelConfig | undefined {
    return MODEL_CATALOG[id]
  }

  /**
   * Get models suitable for a specific task
   */
  static getModelsForTask(task: AnalysisTask): ModelConfig[] {
    // Task-specific model recommendations
    const taskModelMap: Record<AnalysisTask, string[]> = {
      summary: [
        'google/gemini-2.0-flash-thinking-exp-1219:free',
        'openai/gpt-4o-mini',
        'anthropic/claude-3.5-sonnet'
      ],
      comprehensive: [
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4-turbo',
        'deepseek/deepseek-r1'
      ],
      differential: [
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4-turbo',
        'openai/o1-preview'
      ],
      risk_assessment: [
        'openai/o1-preview',
        'deepseek/deepseek-r1',
        'anthropic/claude-3.5-sonnet'
      ],
      compliance_check: [
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4-turbo',
        'openai/o1-preview'
      ],
      user_impact: [
        'openai/gpt-4o-mini',
        'anthropic/claude-3.5-sonnet',
        'google/gemini-2.0-flash-thinking-exp-1219:free'
      ],
      technical_audit: [
        'openai/o1-preview',
        'deepseek/deepseek-r1',
        'openai/gpt-4-turbo'
      ]
    }

    const recommendedModelIds = taskModelMap[task] || []
    return recommendedModelIds
      .map(id => MODEL_CATALOG[id])
      .filter((model): model is ModelConfig => model !== undefined)
  }

  /**
   * Get recommended models based on various criteria
   */
  static getRecommendedModels(criteria?: {
    task?: AnalysisTask
    maxCost?: number // Max cost per 1k tokens (input + output)
    requiresTools?: boolean
    requiresWebSearch?: boolean
    requiresThinking?: boolean
    requiresVision?: boolean
    requiresStreaming?: boolean
    preferredSpeed?: 'fast' | 'balanced' | 'slow'
    preferredQuality?: 'basic' | 'good' | 'excellent'
    specialization?: 'legal' | 'technical' | 'financial' | 'general' | 'reasoning'
  }): ModelConfig[] {
    let models = this.getAllModels()

    // Filter by task if specified
    if (criteria?.task) {
      const taskModels = this.getModelsForTask(criteria.task)
      // Prefer task-specific models but include others as fallback
      models = [
        ...taskModels,
        ...models.filter(m => !taskModels.find(tm => tm.id === m.id))
      ]
    }

    // Apply capability filters
    if (criteria?.requiresTools) {
      models = models.filter(m => m.capabilities.supportsTools)
    }

    if (criteria?.requiresWebSearch) {
      models = models.filter(m => m.capabilities.supportsWebSearch)
    }

    if (criteria?.requiresThinking) {
      models = models.filter(m => m.capabilities.supportsThinking)
    }

    if (criteria?.requiresVision) {
      models = models.filter(m => m.capabilities.supportsVision)
    }

    if (criteria?.requiresStreaming) {
      models = models.filter(m => m.capabilities.supportsStreaming)
    }

    // Filter by cost
    if (criteria?.maxCost !== undefined) {
      models = models.filter(m => {
        const totalCost = m.capabilities.costPer1kTokens.input + m.capabilities.costPer1kTokens.output
        return totalCost <= (criteria.maxCost || Infinity)
      })
    }

    // Filter by speed preference
    if (criteria?.preferredSpeed) {
      models = models.filter(m => m.capabilities.speed === criteria.preferredSpeed)
    }

    // Filter by quality preference
    if (criteria?.preferredQuality) {
      models = models.filter(m => m.capabilities.quality === criteria.preferredQuality)
    }

    // Filter by specialization
    if (criteria?.specialization) {
      models = models.filter(m => m.capabilities.specializations.includes(criteria.specialization!))
    }

    // Sort by relevance (task-specific first, then by quality, then by cost)
    return models.sort((a, b) => {
      // Task-specific models first
      if (criteria?.task) {
        const taskModels = this.getModelsForTask(criteria.task)
        const aIsTaskSpecific = taskModels.some(tm => tm.id === a.id)
        const bIsTaskSpecific = taskModels.some(tm => tm.id === b.id)
        if (aIsTaskSpecific && !bIsTaskSpecific) return -1
        if (!aIsTaskSpecific && bIsTaskSpecific) return 1
      }

      // Then by quality
      const qualityOrder = { excellent: 3, good: 2, basic: 1 }
      const qualityDiff = qualityOrder[b.capabilities.quality] - qualityOrder[a.capabilities.quality]
      if (qualityDiff !== 0) return qualityDiff

      // Then by cost (lower is better)
      const aCost = a.capabilities.costPer1kTokens.input + a.capabilities.costPer1kTokens.output
      const bCost = b.capabilities.costPer1kTokens.input + b.capabilities.costPer1kTokens.output
      return aCost - bCost
    })
  }

  /**
   * Get models by provider
   */
  static getModelsByProvider(provider: string): ModelConfig[] {
    return this.getAllModels().filter(m => 
      m.provider.toLowerCase() === provider.toLowerCase()
    )
  }

  /**
   * Get free models (zero cost)
   */
  static getFreeModels(): ModelConfig[] {
    return this.getAllModels().filter(m => 
      m.capabilities.costPer1kTokens.input === 0 && 
      m.capabilities.costPer1kTokens.output === 0
    )
  }

  /**
   * Get models with specific capabilities
   */
  static getModelsWithCapabilities(capabilities: {
    minContextLength?: number
    supportsTools?: boolean
    supportsWebSearch?: boolean
    supportsThinking?: boolean
    supportsVision?: boolean
    supportsStreaming?: boolean
    supportsJSON?: boolean
  }): ModelConfig[] {
    return this.getAllModels().filter(model => {
      const caps = model.capabilities
      
      if (capabilities.minContextLength && caps.contextLength < capabilities.minContextLength) {
        return false
      }
      
      if (capabilities.supportsTools !== undefined && caps.supportsTools !== capabilities.supportsTools) {
        return false
      }
      
      if (capabilities.supportsWebSearch !== undefined && caps.supportsWebSearch !== capabilities.supportsWebSearch) {
        return false
      }
      
      if (capabilities.supportsThinking !== undefined && caps.supportsThinking !== capabilities.supportsThinking) {
        return false
      }
      
      if (capabilities.supportsVision !== undefined && caps.supportsVision !== capabilities.supportsVision) {
        return false
      }
      
      if (capabilities.supportsStreaming !== undefined && caps.supportsStreaming !== capabilities.supportsStreaming) {
        return false
      }
      
      if (capabilities.supportsJSON !== undefined && caps.supportsJSON !== capabilities.supportsJSON) {
        return false
      }
      
      return true
    })
  }

  /**
   * Get the cheapest model for a task
   */
  static getCheapestModelForTask(task: AnalysisTask): ModelConfig | undefined {
    const models = this.getModelsForTask(task)
    if (models.length === 0) return undefined

    return models.reduce((cheapest, current) => {
      const cheapestCost = cheapest.capabilities.costPer1kTokens.input + cheapest.capabilities.costPer1kTokens.output
      const currentCost = current.capabilities.costPer1kTokens.input + current.capabilities.costPer1kTokens.output
      return currentCost < cheapestCost ? current : cheapest
    })
  }

  /**
   * Get the best quality model for a task within budget
   */
  static getBestModelForBudget(task: AnalysisTask, maxCostPer1k: number): ModelConfig | undefined {
    const models = this.getModelsForTask(task).filter(m => {
      const totalCost = m.capabilities.costPer1kTokens.input + m.capabilities.costPer1kTokens.output
      return totalCost <= maxCostPer1k
    })

    if (models.length === 0) return undefined

    // Sort by quality (best first), then by cost (cheapest first)
    const qualityOrder = { excellent: 3, good: 2, basic: 1 }
    return models.sort((a, b) => {
      const qualityDiff = qualityOrder[b.capabilities.quality] - qualityOrder[a.capabilities.quality]
      if (qualityDiff !== 0) return qualityDiff

      const aCost = a.capabilities.costPer1kTokens.input + a.capabilities.costPer1kTokens.output
      const bCost = b.capabilities.costPer1kTokens.input + b.capabilities.costPer1kTokens.output
      return aCost - bCost
    })[0]
  }

  /**
   * Estimate tokens for content
   * Note: This is a rough approximation
   */
  static estimateTokens(content: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(content.length / 4)
  }

  /**
   * Calculate estimated cost for a model and content
   */
  static calculateCost(
    modelId: string, 
    inputContent: string, 
    estimatedOutputTokens: number = 1000
  ): { total: number; breakdown: { input: number; output: number } } | null {
    const model = this.getModel(modelId)
    if (!model) return null

    const inputTokens = this.estimateTokens(inputContent)
    const inputCost = (inputTokens / 1000) * model.capabilities.costPer1kTokens.input
    const outputCost = (estimatedOutputTokens / 1000) * model.capabilities.costPer1kTokens.output

    return {
      total: inputCost + outputCost,
      breakdown: {
        input: inputCost,
        output: outputCost
      }
    }
  }
}

// Re-export types for convenience
export { MODEL_CATALOG, ModelConfig, AnalysisTask } from './unified-ai-service'