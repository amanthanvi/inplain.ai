/**
 * Intelligent Model Selection for Inplain.AI
 * 
 * This module provides smart model selection based on:
 * - Task complexity and requirements
 * - User tier (free/premium)
 * - Model availability and performance
 * - Cost optimization
 * - Response time requirements
 */

import { z } from 'zod'
import { MODEL_CATALOG, ModelConfig, AnalysisTask } from './unified-ai-service'

// User tier definitions
export const UserTier = z.enum(['free', 'pro', 'enterprise'])
export type UserTier = z.infer<typeof UserTier>

// Selection criteria
export const SelectionCriteria = z.object({
  task: AnalysisTask,
  contentLength: z.number(),
  complexity: z.enum(['low', 'medium', 'high']).optional(),
  responseTime: z.enum(['fast', 'balanced', 'quality']).default('balanced'),
  userTier: UserTier.default('free'),
  requiredFeatures: z.object({
    tools: z.boolean().default(false),
    webSearch: z.boolean().default(false),
    thinking: z.boolean().default(false),
    vision: z.boolean().default(false),
    streaming: z.boolean().default(true)
  }).optional(),
  maxCostPer1kTokens: z.number().optional(),
  preferredProviders: z.array(z.string()).optional()
})

export type SelectionCriteria = z.infer<typeof SelectionCriteria>

// Model performance metrics (would be populated from actual usage data)
export const MODEL_METRICS = {
  'google/gemini-2.0-flash-thinking-exp-1219:free': {
    avgResponseTime: 1200,
    successRate: 0.97,
    qualityScore: 0.85,
    userSatisfaction: 0.88
  },
  'openai/gpt-4o-mini': {
    avgResponseTime: 800,
    successRate: 0.98,
    qualityScore: 0.87,
    userSatisfaction: 0.90
  },
  'anthropic/claude-3.5-sonnet': {
    avgResponseTime: 1500,
    successRate: 0.99,
    qualityScore: 0.95,
    userSatisfaction: 0.94
  },
  'openai/gpt-4-turbo': {
    avgResponseTime: 2000,
    successRate: 0.98,
    qualityScore: 0.93,
    userSatisfaction: 0.92
  },
  'openai/o1-preview': {
    avgResponseTime: 5000,
    successRate: 0.96,
    qualityScore: 0.98,
    userSatisfaction: 0.91
  },
  'deepseek/deepseek-r1': {
    avgResponseTime: 1800,
    successRate: 0.95,
    qualityScore: 0.92,
    userSatisfaction: 0.89
  },
  'perplexity/llama-3.1-sonar-large-128k-online': {
    avgResponseTime: 1600,
    successRate: 0.94,
    qualityScore: 0.86,
    userSatisfaction: 0.87
  }
}

export class ModelSelector {
  /**
   * Select the best model based on criteria
   */
  static selectModel(criteria: SelectionCriteria): {
    primary: ModelConfig
    fallbacks: ModelConfig[]
    reasoning: string[]
  } {
    const validated = SelectionCriteria.parse(criteria)
    const reasoning: string[] = []
    
    // Get all eligible models
    const eligibleModels = this.filterEligibleModels(validated, reasoning)
    
    // Score and rank models
    const scoredModels = this.scoreModels(eligibleModels, validated, reasoning)
    
    // Sort by score
    const sortedModels = scoredModels.sort((a, b) => b.score - a.score)
    
    if (sortedModels.length === 0) {
      throw new Error('No eligible models found for the given criteria')
    }
    
    // Select primary and fallbacks
    const firstModel = sortedModels[0]
    if (!firstModel) {
      throw new Error('No eligible models found')
    }
    const primary = firstModel.model
    const fallbacks = sortedModels.slice(1, 4).map(s => s.model)
    
    reasoning.push(`Selected ${primary.name} as primary model (score: ${firstModel.score.toFixed(2)})`)
    
    return { primary, fallbacks, reasoning }
  }

  /**
   * Filter models based on hard requirements
   */
  private static filterEligibleModels(
    criteria: SelectionCriteria,
    reasoning: string[]
  ): ModelConfig[] {
    const models = Object.values(MODEL_CATALOG)
    
    return models.filter(model => {
      // Check user tier restrictions
      if (criteria.userTier === 'free') {
        const freeTierModels = [
          'google/gemini-2.0-flash-thinking-exp-1219:free',
          'openai/gpt-4o-mini'
        ]
        if (!freeTierModels.includes(model.id)) {
          return false
        }
      }
      
      // Check required features
      if (criteria.requiredFeatures) {
        if (criteria.requiredFeatures.tools && !model.capabilities.supportsTools) {
          return false
        }
        if (criteria.requiredFeatures.webSearch && !model.capabilities.supportsWebSearch) {
          return false
        }
        if (criteria.requiredFeatures.thinking && !model.capabilities.supportsThinking) {
          return false
        }
        if (criteria.requiredFeatures.vision && !model.capabilities.supportsVision) {
          return false
        }
        if (criteria.requiredFeatures.streaming && !model.capabilities.supportsStreaming) {
          return false
        }
      }
      
      // Check context length
      if (criteria.contentLength > model.capabilities.contextLength) {
        reasoning.push(`${model.name} excluded: content too long`)
        return false
      }
      
      // Check cost constraints
      if (criteria.maxCostPer1kTokens) {
        const avgCost = (model.capabilities.costPer1kTokens.input + 
                        model.capabilities.costPer1kTokens.output) / 2
        if (avgCost > criteria.maxCostPer1kTokens) {
          reasoning.push(`${model.name} excluded: too expensive`)
          return false
        }
      }
      
      // Check preferred providers
      if (criteria.preferredProviders && criteria.preferredProviders.length > 0) {
        if (!criteria.preferredProviders.includes(model.provider)) {
          return false
        }
      }
      
      return true
    })
  }

  /**
   * Score models based on soft criteria
   */
  private static scoreModels(
    models: ModelConfig[],
    criteria: SelectionCriteria,
    reasoning: string[]
  ): Array<{ model: ModelConfig; score: number }> {
    return models.map(model => {
      let score = 0
      const factors: string[] = []
      
      // Task specialization score (0-30 points)
      const taskSpecializationScore = this.getTaskSpecializationScore(model, criteria.task)
      score += taskSpecializationScore * 30
      if (taskSpecializationScore > 0.8) {
        factors.push(`specialized for ${criteria.task}`)
      }
      
      // Performance score (0-25 points)
      const metrics = MODEL_METRICS[model.id as keyof typeof MODEL_METRICS]
      if (metrics) {
        // Response time
        if (criteria.responseTime === 'fast' && metrics.avgResponseTime < 1000) {
          score += 10
          factors.push('fast response')
        } else if (criteria.responseTime === 'quality' && metrics.qualityScore > 0.9) {
          score += 10
          factors.push('high quality')
        } else if (criteria.responseTime === 'balanced') {
          score += 5
        }
        
        // Success rate
        score += metrics.successRate * 10
        
        // User satisfaction
        score += metrics.userSatisfaction * 5
      }
      
      // Cost efficiency score (0-20 points)
      const costScore = this.getCostEfficiencyScore(model, criteria)
      score += costScore * 20
      if (costScore > 0.8) {
        factors.push('cost efficient')
      }
      
      // Complexity match score (0-15 points)
      const complexityScore = this.getComplexityMatchScore(model, criteria.complexity)
      score += complexityScore * 15
      
      // Feature bonus (0-10 points)
      if (model.capabilities.supportsTools) score += 2
      if (model.capabilities.supportsWebSearch) score += 3
      if (model.capabilities.supportsThinking) score += 3
      if (model.capabilities.supportsVision) score += 2
      
      reasoning.push(`${model.name}: score=${score.toFixed(1)} (${factors.join(', ')})`)
      
      return { model, score }
    })
  }

  /**
   * Get task specialization score
   */
  private static getTaskSpecializationScore(
    model: ModelConfig,
    task: AnalysisTask
  ): number {
    const taskSpecializationMap: Record<AnalysisTask, string[]> = {
      summary: ['general'],
      comprehensive: ['legal', 'general'],
      differential: ['legal', 'reasoning'],
      risk_assessment: ['reasoning', 'legal'],
      compliance_check: ['legal'],
      user_impact: ['general'],
      technical_audit: ['technical', 'reasoning']
    }
    
    const requiredSpecs = taskSpecializationMap[task]
    const modelSpecs = model.capabilities.specializations
    
    const matches = requiredSpecs.filter(spec => 
      modelSpecs.includes(spec as any)
    ).length
    
    return matches / requiredSpecs.length
  }

  /**
   * Get cost efficiency score
   */
  private static getCostEfficiencyScore(
    model: ModelConfig,
    criteria: SelectionCriteria
  ): number {
    const avgCost = (model.capabilities.costPer1kTokens.input + 
                    model.capabilities.costPer1kTokens.output) / 2
    
    // Free models get maximum score
    if (avgCost === 0) return 1
    
    // Score based on tier expectations
    const tierMaxCost = {
      free: 1,
      pro: 10,
      enterprise: 50
    }
    
    const maxAcceptable = tierMaxCost[criteria.userTier]
    
    if (avgCost > maxAcceptable) return 0
    
    // Linear scoring within acceptable range
    return 1 - (avgCost / maxAcceptable)
  }

  /**
   * Get complexity match score
   */
  private static getComplexityMatchScore(
    model: ModelConfig,
    complexity?: 'low' | 'medium' | 'high'
  ): number {
    if (!complexity) return 0.5 // Neutral if not specified
    
    const modelComplexity = {
      fast: 'low',
      balanced: 'medium',
      slow: 'high'
    }[model.capabilities.speed]
    
    // Perfect match
    if (modelComplexity === complexity) return 1
    
    // Adjacent match
    const complexityLevels = ['low', 'medium', 'high']
    const modelIdx = complexityLevels.indexOf(modelComplexity || 'medium')
    const targetIdx = complexityLevels.indexOf(complexity)
    const distance = Math.abs(modelIdx - targetIdx)
    
    return 1 - (distance * 0.3)
  }

  /**
   * Get model recommendations for display
   */
  static getRecommendations(
    task: AnalysisTask,
    userTier: UserTier = 'free'
  ): Array<{
    model: ModelConfig
    badge?: string
    description: string
  }> {
    const criteria: SelectionCriteria = {
      task,
      userTier,
      contentLength: 10000, // Average
      responseTime: 'balanced'
    }
    
    const { primary, fallbacks } = this.selectModel(criteria)
    const allModels = [primary, ...fallbacks]
    
    return allModels.map((model, index) => {
      let badge: string | undefined
      let description: string
      
      if (index === 0) {
        badge = 'Recommended'
        description = 'Best overall choice for this task'
      } else if (model.capabilities.costPer1kTokens.input === 0) {
        badge = 'Free'
        description = 'No cost option with good performance'
      } else if (model.capabilities.speed === 'fast') {
        badge = 'Fast'
        description = 'Quick responses for time-sensitive needs'
      } else if (model.capabilities.quality === 'excellent') {
        badge = 'Premium'
        description = 'Highest quality analysis available'
      } else {
        description = 'Reliable alternative option'
      }
      
      return { model, badge, description }
    })
  }

  /**
   * Validate model availability
   */
  static async validateAvailability(
    modelIds: string[]
  ): Promise<Record<string, boolean>> {
    // In production, this would ping each model
    // For now, return mock availability
    const availability: Record<string, boolean> = {}
    
    for (const modelId of modelIds) {
      // Simulate some models being unavailable
      availability[modelId] = Math.random() > 0.1
    }
    
    return availability
  }

  /**
   * Get usage statistics for optimization
   */
  static getUsageStats(): {
    modelUsage: Record<string, number>
    taskDistribution: Record<AnalysisTask, number>
    averageCost: number
    recommendations: string[]
  } {
    // In production, this would come from analytics
    return {
      modelUsage: {
        'openai/gpt-4o-mini': 450,
        'google/gemini-2.0-flash-thinking-exp-1219:free': 380,
        'anthropic/claude-3.5-sonnet': 120,
        'openai/gpt-4-turbo': 50
      },
      taskDistribution: {
        summary: 400,
        comprehensive: 300,
        differential: 200,
        risk_assessment: 50,
        compliance_check: 30,
        user_impact: 15,
        technical_audit: 5
      },
      averageCost: 0.0023,
      recommendations: [
        'Consider using more free tier models for summaries',
        'Premium models are underutilized for complex tasks',
        'Enable web search for better context in risk assessments'
      ]
    }
  }
}

// Export convenience functions
export function selectBestModel(
  task: AnalysisTask,
  userTier: UserTier = 'free'
): ModelConfig {
  const { primary } = ModelSelector.selectModel({
    task,
    userTier,
    contentLength: 10000,
    responseTime: 'balanced'
  })
  return primary
}

export function getModelFallbacks(
  task: AnalysisTask,
  primaryModel: string
): string[] {
  const { fallbacks } = ModelSelector.selectModel({
    task,
    contentLength: 10000,
    responseTime: 'balanced',
    userTier: 'free'
  })
  return fallbacks
    .filter(m => m.id !== primaryModel)
    .map(m => m.id)
}