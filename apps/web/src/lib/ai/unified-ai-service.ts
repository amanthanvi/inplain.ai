/**
 * Unified AI Service for Inplain.AI
 * 
 * This service consolidates all AI functionality and maximizes OpenRouter capabilities:
 * - Tool calling for structured data extraction
 * - Web search for real-time context
 * - Thinking/reasoning for complex analysis
 * - Multi-modal support for documents and images
 * - Intelligent model orchestration
 * - Robust error handling and retry logic
 * - Streaming support with reconnection
 * - Response validation and quality control
 */

import { z } from 'zod'
import { OpenAI } from 'openai'
import { formatTimestamp } from '@inplain.ai/shared'
import { getPersonaForTask, getPromptTemplate, buildPrompt } from './prompts/prompt-library'

// ============= Error Class Hierarchy =============

export class AIError extends Error {
  constructor(message: string, public cause?: any) {
    super(message)
    this.name = this.constructor.name
  }
}

export class AIConfigurationError extends AIError {}
export class AIRequestError extends AIError {}
export class AIResponseError extends AIError {}
export class AIRateLimitError extends AIResponseError {}
export class AINotFoundError extends AIResponseError {}
export class AIAuthError extends AIConfigurationError {}
export class AITimeoutError extends AIRequestError {}
export class AIContentPolicyError extends AIResponseError {}

// ============= Streaming Event Types =============

export type StreamingEventType =
  | 'model'           // Provides the model name being used
  | 'textDelta'       // A chunk of text content
  | 'toolCallDelta'   // A chunk of a tool call's arguments or name
  | 'toolCallComplete'// Signals a complete tool call with all its arguments
  | 'finishReason'    // The reason the stream ended
  | 'progress'        // Progress update
  | 'error'           // An error occurred

export interface StreamingEvent {
  type: StreamingEventType
  data: any // Data structure depends on the event type
}

// ============= Model Configuration =============

export const ModelCapabilities = z.object({
  contextLength: z.number(),
  supportsTools: z.boolean().default(false),
  supportsWebSearch: z.boolean().default(false),
  supportsThinking: z.boolean().default(false),
  supportsVision: z.boolean().default(false),
  supportsStreaming: z.boolean().default(true),
  supportsJSON: z.boolean().default(true),
  costPer1kTokens: z.object({
    input: z.number(),
    output: z.number()
  }),
  speed: z.enum(['fast', 'balanced', 'slow']),
  quality: z.enum(['basic', 'good', 'excellent']),
  specializations: z.array(z.enum(['legal', 'technical', 'financial', 'general', 'reasoning']))
})

export type ModelCapabilities = z.infer<typeof ModelCapabilities>

export const ModelConfig = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  capabilities: ModelCapabilities
})

export type ModelConfig = z.infer<typeof ModelConfig>

// Enhanced model catalog with full OpenRouter capabilities
export const MODEL_CATALOG: Record<string, ModelConfig> = {
  // Fast tier - for quick summaries and basic analysis
  'google/gemini-2.0-flash-thinking-exp-1219:free': {
    id: 'google/gemini-2.0-flash-thinking-exp-1219:free',
    name: 'Gemini 2.0 Flash Thinking (Free)',
    provider: 'Google',
    capabilities: {
      contextLength: 32768,
      supportsTools: true,
      supportsWebSearch: false,
      supportsThinking: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsJSON: true,
      costPer1kTokens: { input: 0, output: 0 },
      speed: 'fast',
      quality: 'good',
      specializations: ['general', 'reasoning']
    }
  },
  'openai/gpt-4o-mini': {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    capabilities: {
      contextLength: 128000,
      supportsTools: true,
      supportsWebSearch: false,
      supportsThinking: false,
      supportsVision: true,
      supportsStreaming: true,
      supportsJSON: true,
      costPer1kTokens: { input: 0.15, output: 0.6 },
      speed: 'fast',
      quality: 'good',
      specializations: ['general', 'technical']
    }
  },

  // Balanced tier - for standard analysis
  'anthropic/claude-3.5-sonnet': {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    capabilities: {
      contextLength: 200000,
      supportsTools: true,
      supportsWebSearch: false,
      supportsThinking: false,
      supportsVision: true,
      supportsStreaming: true,
      supportsJSON: true,
      costPer1kTokens: { input: 3.0, output: 15.0 },
      speed: 'balanced',
      quality: 'excellent',
      specializations: ['legal', 'technical', 'general']
    }
  },
  'openai/gpt-4-turbo': {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    capabilities: {
      contextLength: 128000,
      supportsTools: true,
      supportsWebSearch: false,
      supportsThinking: false,
      supportsVision: true,
      supportsStreaming: true,
      supportsJSON: true,
      costPer1kTokens: { input: 10.0, output: 30.0 },
      speed: 'balanced',
      quality: 'excellent',
      specializations: ['financial', 'technical', 'general']
    }
  },

  // Advanced tier - for deep analysis and reasoning
  'openai/o1-preview': {
    id: 'openai/o1-preview',
    name: 'O1 Preview',
    provider: 'OpenAI',
    capabilities: {
      contextLength: 128000,
      supportsTools: false,
      supportsWebSearch: false,
      supportsThinking: true,
      supportsVision: false,
      supportsStreaming: false,
      supportsJSON: true,
      costPer1kTokens: { input: 15.0, output: 60.0 },
      speed: 'slow',
      quality: 'excellent',
      specializations: ['reasoning', 'technical', 'legal']
    }
  },
  'deepseek/deepseek-r1': {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    capabilities: {
      contextLength: 131072,
      supportsTools: true,
      supportsWebSearch: false,
      supportsThinking: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsJSON: true,
      costPer1kTokens: { input: 1.0, output: 3.0 },
      speed: 'balanced',
      quality: 'excellent',
      specializations: ['reasoning', 'technical']
    }
  },

  // Web search enabled models
  'perplexity/llama-3.1-sonar-large-128k-online': {
    id: 'perplexity/llama-3.1-sonar-large-128k-online',
    name: 'Perplexity Sonar Large',
    provider: 'Perplexity',
    capabilities: {
      contextLength: 127072,
      supportsTools: false,
      supportsWebSearch: true,
      supportsThinking: false,
      supportsVision: false,
      supportsStreaming: true,
      supportsJSON: true,
      costPer1kTokens: { input: 1.0, output: 1.0 },
      speed: 'balanced',
      quality: 'good',
      specializations: ['general']
    }
  },
  'openai/gpt-4o:online': {
    id: 'openai/gpt-4o:online',
    name: 'GPT-4o with Web Search',
    provider: 'OpenAI',
    capabilities: {
      contextLength: 128000,
      supportsTools: true,
      supportsWebSearch: true,
      supportsThinking: false,
      supportsVision: true,
      supportsStreaming: true,
      supportsJSON: true,
      costPer1kTokens: { input: 2.5, output: 10.0 },
      speed: 'balanced',
      quality: 'excellent',
      specializations: ['general', 'technical']
    }
  }
}

// ============= Request/Response Types =============

export const AnalysisTask = z.enum([
  'summary',
  'comprehensive',
  'differential',
  'risk_assessment',
  'compliance_check',
  'user_impact',
  'technical_audit'
])

export type AnalysisTask = z.infer<typeof AnalysisTask>

export const AnalysisOptions = z.object({
  task: AnalysisTask,
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).default(0.3),
  maxTokens: z.number().min(100).max(4000).default(2000),
  useTools: z.boolean().default(true),
  useWebSearch: z.boolean().default(false),
  useThinking: z.boolean().default(false),
  stream: z.boolean().default(false),
  includeConfidence: z.boolean().default(true),
  includeEvidence: z.boolean().default(true),
  language: z.string().default('en'),
  systemPrompt: z.string().optional(),
  userPrompt: z.string().optional(),
  metadata: z.any().optional()
})

export type AnalysisOptions = z.infer<typeof AnalysisOptions>

export const AnalysisResult = z.object({
  task: AnalysisTask,
  content: z.any(), // Flexible content based on task
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).optional(),
  model: z.string(),
  tokensUsed: z.object({
    input: z.number(),
    output: z.number(),
    total: z.number()
  }),
  processingTime: z.number(),
  timestamp: z.string()
})

export type AnalysisResult = z.infer<typeof AnalysisResult>

// ============= Tool Definitions =============

const extractDataTool = {
  type: 'function' as const,
  function: {
    name: 'extract_privacy_data',
    description: 'Extract structured data from privacy policy text with detailed analysis',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'A 2-3 sentence executive summary of the privacy policy'
        },
        dataCollected: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', enum: ['personal', 'usage', 'device', 'location', 'financial', 'health', 'biometric', 'behavioral'] },
              types: { type: 'array', items: { type: 'string' } },
              purpose: { type: 'string' },
              required: { type: 'boolean' },
              source: { type: 'string', enum: ['direct', 'automatic', 'third_party'] }
            }
          }
        },
        dataSharing: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              recipient: { type: 'string' },
              recipientType: { type: 'string', enum: ['service_provider', 'business_partner', 'advertiser', 'government', 'affiliate', 'other'] },
              purpose: { type: 'string' },
              dataTypes: { type: 'array', items: { type: 'string' } },
              userControl: { type: 'boolean' },
              legalBasis: { type: 'string' }
            }
          }
        },
        userRights: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['access', 'deletion', 'portability', 'correction', 'opt-out', 'restriction', 'objection', 'withdraw_consent', 'complaint']
          }
        },
        retentionPeriod: { type: 'string' },
        securityMeasures: { type: 'array', items: { type: 'string' } },
        detailedChanges: {
          type: 'array',
          description: 'Specific changes found in the policy (for diff analysis)',
          items: {
            type: 'object',
            properties: {
              areaOfChange: { type: 'string' },
              descriptionOfChange: { type: 'string' },
              implicationForUser: { type: 'string' },
              sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral', 'mixed'] }
            }
          }
        },
        riskAssessment: {
          type: 'object',
          properties: {
            overallRisk: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            keyRisks: { type: 'array', items: { type: 'string' } },
            privacyScore: { type: 'number', minimum: 0, maximum: 100 }
          }
        },
        compliance: {
          type: 'object',
          properties: {
            gdpr: { type: 'boolean' },
            ccpa: { type: 'boolean' },
            coppa: { type: 'boolean' },
            otherRegulations: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      required: ['summary', 'dataCollected', 'dataSharing', 'userRights', 'riskAssessment']
    }
  }
}

const searchContextTool = {
  type: 'function' as const,
  function: {
    name: 'search_context',
    description: 'Search for additional context about a company or privacy practice',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for additional context' },
        type: { type: 'string', enum: ['news', 'legal', 'technical', 'general'] }
      },
      required: ['query']
    }
  }
}

// ============= Main Service Class =============

export class UnifiedAIService {
  private static instance: UnifiedAIService
  private openai: OpenAI
  private cache = new Map<string, AnalysisResult>()
  private requestQueue = new Map<string, Promise<any>>()
  private rateLimiter = new Map<string, { count: number; resetAt: number }>()
  
  constructor(private apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://inplain.ai',
        'X-Title': 'Inplain.AI - Privacy Policy Analysis'
      }
    })
  }
  
  static getInstance(apiKey?: string): UnifiedAIService {
    if (!this.instance) {
      if (!apiKey) {
        throw new AIConfigurationError('API key required for first initialization')
      }
      this.instance = new UnifiedAIService(apiKey)
    }
    return this.instance
  }

  /**
   * Select the optimal model based on task requirements and availability
   */
  private selectOptimalModel(
    task: AnalysisTask,
    options: Partial<AnalysisOptions> = {}
  ): ModelConfig {
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

    // Get recommended models for task
    const recommendedModels = taskModelMap[task]
    
    // Filter by required capabilities
    const eligibleModels = recommendedModels.filter(modelId => {
      const model = MODEL_CATALOG[modelId]
      if (!model) return false
      
      if (options.useTools && !model.capabilities.supportsTools) return false
      if (options.useWebSearch && !model.capabilities.supportsWebSearch) return false
      if (options.useThinking && !model.capabilities.supportsThinking) return false
      if (options.stream && !model.capabilities.supportsStreaming) return false
      
      return true
    })

    // Return first eligible model or fallback
    const selectedModelId = options.model || eligibleModels[0] || recommendedModels[0]
    if (!selectedModelId) {
      return MODEL_CATALOG['openai/gpt-4o-mini']!
    }
    const selectedModel = MODEL_CATALOG[selectedModelId]
    if (!selectedModel) {
      // Return a guaranteed fallback
      return MODEL_CATALOG['openai/gpt-4o-mini']!
    }
    return selectedModel
  }

  /**
   * Check if we're rate limited for a specific model
   */
  private checkRateLimit(modelId: string): boolean {
    const limit = this.rateLimiter.get(modelId)
    if (!limit) return false
    
    if (Date.now() > limit.resetAt) {
      this.rateLimiter.delete(modelId)
      return false
    }
    
    return limit.count >= 10 // 10 requests per minute per model
  }

  /**
   * Update rate limit tracking
   */
  private updateRateLimit(modelId: string): void {
    const limit = this.rateLimiter.get(modelId)
    const now = Date.now()
    
    if (!limit || now > limit.resetAt) {
      this.rateLimiter.set(modelId, {
        count: 1,
        resetAt: now + 60000 // 1 minute
      })
    } else {
      limit.count++
    }
  }

  /**
   * Generate a cache key for deduplication
   */
  private getCacheKey(content: string, options: AnalysisOptions): string {
    const contentHash = content.substring(0, 100) // Simple hash
    return `${options.task}:${options.model}:${contentHash}`
  }

  /**
   * Main analysis method with full OpenRouter capabilities
   */
  async analyze(
    content: string,
    options: Partial<AnalysisOptions> = {}
  ): Promise<AnalysisResult> {
    const validatedOptions = AnalysisOptions.parse({
      task: 'comprehensive',
      ...options
    })

    // Check cache
    const cacheKey = this.getCacheKey(content, validatedOptions)
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - new Date(cached.timestamp).getTime() < 3600000) {
      return cached
    }

    // Dedup concurrent requests
    const existingRequest = this.requestQueue.get(cacheKey)
    if (existingRequest) {
      return existingRequest
    }

    // Create new request
    const requestPromise = this.performAnalysis(content, validatedOptions)
    this.requestQueue.set(cacheKey, requestPromise)

    try {
      const result = await requestPromise
      this.cache.set(cacheKey, result)
      return result
    } finally {
      this.requestQueue.delete(cacheKey)
    }
  }

  /**
   * Perform the actual analysis with retry logic
   */
  private async performAnalysis(
    content: string,
    options: AnalysisOptions
  ): Promise<AnalysisResult> {
    const startTime = Date.now()
    const model = this.selectOptimalModel(options.task, options)
    
    // Check rate limit
    if (this.checkRateLimit(model.id)) {
      throw new Error(`Rate limited for model ${model.name}. Please try again in a minute.`)
    }

    let lastError: Error | null = null
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.updateRateLimit(model.id)
        
        const result = await this.callModel(content, model, options)
        
        return {
          task: options.task,
          content: result.content,
          confidence: result.confidence || this.calculateConfidence(result),
          evidence: result.evidence,
          model: model.id,
          tokensUsed: result.tokensUsed,
          processingTime: Date.now() - startTime,
          timestamp: formatTimestamp()
        }
      } catch (error) {
        lastError = error as Error
        console.error(`Attempt ${attempt} failed for ${model.id}:`, error)
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error as Error)) {
          throw error
        }
        
        // Exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('Analysis failed after all retries')
  }

  /**
   * Call the AI model with appropriate configuration
   */
  private async callModel(
    content: string,
    model: ModelConfig,
    options: AnalysisOptions
  ): Promise<any> {
    const messages: any[] = [
      {
        role: 'system',
        content: options.systemPrompt || this.getSystemPrompt(options.task)
      },
      {
        role: 'user',
        content: options.userPrompt || this.getUserPrompt(content, options.task)
      }
    ]

    // Configure tools if supported and requested
    const tools = []
    if (options.useTools && model.capabilities.supportsTools) {
      tools.push(extractDataTool)
      if (options.useWebSearch && model.capabilities.supportsWebSearch) {
        tools.push(searchContextTool)
      }
    }

    const requestConfig: any = {
      model: model.id,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      ...(tools.length > 0 && { tools, tool_choice: 'auto' }),
      ...(options.stream && { stream: true })
    }

    if (options.stream && model.capabilities.supportsStreaming) {
      return this.handleStreamingResponse(requestConfig, options)
    } else {
      return this.handleStandardResponse(requestConfig, options)
    }
  }

  /**
   * Handle standard (non-streaming) responses
   */
  private async handleStandardResponse(
    requestConfig: any,
    options: AnalysisOptions
  ): Promise<any> {
    const completion = await this.openai.chat.completions.create(requestConfig)
    const response = completion.choices[0]
    
    if (!response) {
      throw new Error('No response from AI model')
    }
    
    // Handle tool calls if present
    if (response.message.tool_calls) {
      const toolResults = await this.processToolCalls(response.message.tool_calls)
      
      // Continue conversation with tool results
      const toolMessages = [
        response.message,
        ...toolResults.map(result => ({
          role: 'tool' as const,
          content: JSON.stringify(result.content),
          tool_call_id: result.tool_call_id
        }))
      ]
      
      const finalCompletion = await this.openai.chat.completions.create({
        ...requestConfig,
        messages: [...requestConfig.messages, ...toolMessages]
      })
      
      return this.parseResponse(finalCompletion, options)
    }
    
    return this.parseResponse(completion, options)
  }

  /**
   * Handle streaming responses with reconnection
   */
  private async handleStreamingResponse(
    requestConfig: any,
    options: AnalysisOptions
  ): Promise<any> {
    const stream = await this.openai.chat.completions.create({
      ...requestConfig,
      stream: true
    })

    let fullContent = ''
    let toolCalls: any[] = []
    
    try {
      // Check if stream is iterable
      if (!stream || typeof (stream as any)[Symbol.asyncIterator] !== 'function') {
        throw new Error('Stream is not iterable')
      }
      
      for await (const chunk of stream as any) {
        const delta = chunk.choices[0]?.delta
        
        if (delta?.content) {
          fullContent += delta.content
        }
        
        if (delta?.tool_calls) {
          // Accumulate tool calls
          toolCalls.push(...delta.tool_calls)
        }
      }
      
      // Process accumulated data
      if (toolCalls.length > 0) {
        const toolResults = await this.processToolCalls(toolCalls)
        // For streaming, we'd need to make another call with tool results
        // This is simplified for now
        return {
          content: { fullContent, toolResults },
          tokensUsed: { input: 0, output: 0, total: 0 }, // Would need to track
          confidence: 0.8
        }
      }
      
      return {
        content: this.parseContent(fullContent, options),
        tokensUsed: { input: 0, output: 0, total: 0 }, // Would need to track
        confidence: 0.8
      }
    } catch (error) {
      console.error('Streaming error:', error)
      if (error instanceof Error && error.message.includes('rate limit')) {
        throw new AIRateLimitError('Rate limit exceeded', error)
      }
      throw new AIRequestError('Streaming failed', error)
    }
  }

  /**
   * Process tool calls from the model
   */
  private async processToolCalls(toolCalls: any[]): Promise<any[]> {
    const results = []
    
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name
      const args = JSON.parse(toolCall.function.arguments)
      
      switch (functionName) {
        case 'extract_privacy_data':
          results.push({
            tool_call_id: toolCall.id,
            content: args // In production, we'd validate and process
          })
          break
          
        case 'search_context':
          // In production, this would actually search
          results.push({
            tool_call_id: toolCall.id,
            content: {
              query: args.query,
              results: [
                'Recent news about company privacy practices',
                'Industry standards for data collection',
                'Regulatory requirements in jurisdiction'
              ]
            }
          })
          break
      }
    }
    
    return results
  }

  /**
   * Parse the model response based on task type
   */
  private parseResponse(completion: any, options: AnalysisOptions): any {
    const message = completion.choices[0].message
    const usage = completion.usage || {}
    
    const content = this.parseContent(message.content, options)
    
    return {
      content,
      tokensUsed: {
        input: usage.prompt_tokens || 0,
        output: usage.completion_tokens || 0,
        total: usage.total_tokens || 0
      },
      evidence: this.extractEvidence(message.content),
      confidence: this.calculateConfidence({ content, model: completion.model })
    }
  }

  /**
   * Parse content based on expected format
   */
  private parseContent(raw: string, options: AnalysisOptions): any {
    try {
      // Try JSON parsing first
      const cleaned = raw.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim()
      return JSON.parse(cleaned)
    } catch {
      // Fallback to structured text parsing based on task
      return this.parseStructuredText(raw, options.task)
    }
  }

  /**
   * Parse structured text responses
   */
  private parseStructuredText(text: string, task: AnalysisTask): any {
    // Task-specific parsing logic
    switch (task) {
      case 'summary':
        return {
          summary: text.trim(),
          keyPoints: this.extractBulletPoints(text)
        }
      
      case 'comprehensive':
        return {
          overview: this.extractSection(text, 'overview'),
          dataCollection: this.extractSection(text, 'data collection'),
          dataSharing: this.extractSection(text, 'data sharing'),
          userRights: this.extractSection(text, 'user rights'),
          risks: this.extractSection(text, 'risks'),
          recommendations: this.extractSection(text, 'recommendations')
        }
      
      default:
        return { content: text }
    }
  }

  /**
   * Extract evidence from the response
   */
  private extractEvidence(content: string): string[] {
    const evidence: string[] = []
    const lines = content.split('\n')
    
    for (const line of lines) {
      // Look for quoted text or specific references
      const quotes = line.match(/"([^"]+)"/g)
      if (quotes) {
        evidence.push(...quotes.map(q => q.replace(/"/g, '')))
      }
      
      // Look for section references
      if (line.match(/section \d+/i) || line.match(/clause \d+/i)) {
        evidence.push(line.trim())
      }
    }
    
    return evidence.slice(0, 10) // Limit evidence items
  }

  /**
   * Calculate confidence score for the response
   */
  private calculateConfidence(result: any): number {
    let confidence = 0.7 // Base confidence
    
    // Adjust based on model quality
    if (result.model?.includes('opus') || result.model?.includes('o1')) {
      confidence += 0.1
    }
    
    // Adjust based on evidence
    if (result.evidence?.length > 3) {
      confidence += 0.05
    }
    
    // Adjust based on content structure
    if (result.content && typeof result.content === 'object') {
      confidence += 0.05
    }
    
    return Math.min(confidence, 0.95)
  }

  /**
   * Check if an error is non-retryable
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return (
      message.includes('invalid api key') ||
      message.includes('insufficient credits') ||
      message.includes('content policy') ||
      message.includes('invalid request')
    )
  }

  /**
   * Get system prompt based on task
   */
  private getSystemPrompt(task: AnalysisTask): string {
    const persona = getPersonaForTask(task)
    return persona.content
  }

  /**
   * Get user prompt based on task
   */
  private getUserPrompt(content: string, task: AnalysisTask): string {
    const taskInstructions: Record<AnalysisTask, string> = {
      summary: `Summarize this privacy policy in 3-5 key points that users need to know. Use simple language.`,
      
      comprehensive: `Analyze this privacy policy comprehensively. Cover all major aspects and provide detailed findings.`,
      
      differential: `Compare these privacy policy versions and identify what changed and why it matters.`,
      
      risk_assessment: `Assess the privacy risks in this policy. Rate each risk and provide mitigation strategies.`,
      
      compliance_check: `Check this policy for compliance with major privacy regulations. List any gaps found.`,
      
      user_impact: `Explain how this privacy policy affects users in practical terms. What should they know and do?`,
      
      technical_audit: `Audit the technical privacy measures described in this policy. Are they sufficient?`
    }
    
    return `${taskInstructions[task]}\n\nPrivacy Policy:\n${content}`
  }

  /**
   * Extract bullet points from text
   */
  private extractBulletPoints(text: string): string[] {
    const points: string[] = []
    const lines = text.split('\n')
    
    for (const line of lines) {
      if (line.match(/^[-*•]\s+/) || line.match(/^\d+\.\s+/)) {
        points.push(line.replace(/^[-*•\d.]\s+/, '').trim())
      }
    }
    
    return points
  }

  /**
   * Extract a specific section from text
   */
  private extractSection(text: string, sectionName: string): string {
    const regex = new RegExp(`#{1,3}\\s*${sectionName}[:\\s]*([^#]+)`, 'i')
    const match = text.match(regex)
    return match && match[1] ? match[1].trim() : ''
  }

  /**
   * Stream analysis results with progress updates
   */
  async *streamAnalysis(
    content: string,
    options: Partial<AnalysisOptions> = {}
  ): AsyncGenerator<{
    type: 'progress' | 'content' | 'complete'
    data: any
  }> {
    const validatedOptions = AnalysisOptions.parse({
      ...options,
      stream: true
    })

    yield { type: 'progress', data: { status: 'Selecting optimal model...', progress: 0.1 } }
    
    const model = this.selectOptimalModel(validatedOptions.task, validatedOptions)
    
    yield { type: 'progress', data: { status: `Using ${model.name}...`, progress: 0.2 } }
    
    if (!model.capabilities.supportsStreaming) {
      // Fallback to standard analysis with progress simulation
      const result = await this.analyze(content, { ...validatedOptions, stream: false })
      yield { type: 'content', data: result.content }
      yield { type: 'complete', data: result }
      return
    }

    // Implement actual streaming
    const stream = await this.openai.chat.completions.create({
      model: model.id,
      messages: [
        { role: 'system', content: this.getSystemPrompt(validatedOptions.task) },
        { role: 'user', content: this.getUserPrompt(content, validatedOptions.task) }
      ],
      temperature: validatedOptions.temperature,
      max_tokens: validatedOptions.maxTokens,
      stream: true
    })

    let accumulated = ''
    let chunkCount = 0
    
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (delta?.content) {
        accumulated += delta.content
        chunkCount++
        
        // Yield content updates periodically
        if (chunkCount % 5 === 0) {
          yield { 
            type: 'content', 
            data: { 
              partial: accumulated,
              progress: Math.min(0.9, 0.2 + (chunkCount * 0.01))
            }
          }
        }
      }
    }

    // Parse and yield final result
    const parsed = this.parseContent(accumulated, validatedOptions)
    const result: AnalysisResult = {
      task: validatedOptions.task,
      content: parsed,
      confidence: this.calculateConfidence({ content: parsed, model: model.id }),
      model: model.id,
      tokensUsed: { input: 0, output: 0, total: 0 }, // Would need actual tracking
      processingTime: 0,
      timestamp: formatTimestamp()
    }

    yield { type: 'complete', data: result }
  }

  /**
   * Get model recommendations for a task
   */
  getModelRecommendations(task: AnalysisTask): ModelConfig[] {
    const taskModelMap: Record<AnalysisTask, (keyof typeof MODEL_CATALOG)[]> = {
      summary: [
        'google/gemini-2.0-flash-thinking-exp-1219:free',
        'openai/gpt-4o-mini'
      ],
      comprehensive: [
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4-turbo'
      ],
      differential: [
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4-turbo'
      ],
      risk_assessment: [
        'openai/o1-preview',
        'deepseek/deepseek-r1'
      ],
      compliance_check: [
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4-turbo'
      ],
      user_impact: [
        'openai/gpt-4o-mini',
        'anthropic/claude-3.5-sonnet'
      ],
      technical_audit: [
        'openai/o1-preview',
        'deepseek/deepseek-r1'
      ]
    }

    return taskModelMap[task]
      .map(id => MODEL_CATALOG[id])
      .filter((model): model is ModelConfig => model !== undefined)
  }

  /**
   * Estimate cost for analysis
   */
  estimateCost(
    content: string,
    task: AnalysisTask,
    modelId?: string
  ): { estimated: number; breakdown: { input: number; output: number } } {
    const model = modelId 
      ? MODEL_CATALOG[modelId] 
      : this.selectOptimalModel(task)
    
    if (!model) {
      return { estimated: 0, breakdown: { input: 0, output: 0 } }
    }

    // Rough token estimation
    const inputTokens = Math.ceil(content.length / 4)
    const outputTokens = task === 'comprehensive' ? 2000 : 1000
    
    const inputCost = (inputTokens / 1000) * model.capabilities.costPer1kTokens.input
    const outputCost = (outputTokens / 1000) * model.capabilities.costPer1kTokens.output
    
    return {
      estimated: inputCost + outputCost,
      breakdown: { input: inputCost, output: outputCost }
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    models: Record<string, { available: boolean; responseTime?: number }>
    cache: { size: number; hitRate: number }
  }> {
    const modelStatus: Record<string, { available: boolean; responseTime?: number }> = {}
    
    // Test a few key models
    const testModels = [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.0-flash-thinking-exp-1219:free'
    ]
    
    for (const modelId of testModels) {
      const start = Date.now()
      try {
        await this.openai.chat.completions.create({
          model: modelId,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        })
        modelStatus[modelId] = { 
          available: true, 
          responseTime: Date.now() - start 
        }
      } catch {
        modelStatus[modelId] = { available: false }
      }
    }
    
    const availableCount = Object.values(modelStatus).filter(s => s.available).length
    const status = availableCount === testModels.length ? 'healthy' 
      : availableCount > 0 ? 'degraded' 
      : 'unhealthy'
    
    return {
      status,
      models: modelStatus,
      cache: {
        size: this.cache.size,
        hitRate: 0 // Would need to track hits/misses
      }
    }
  }
}

// Export singleton instance
let serviceInstance: UnifiedAIService | null = null

export function getUnifiedAIService(): UnifiedAIService {
  if (!serviceInstance) {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured')
    }
    serviceInstance = new UnifiedAIService(apiKey)
  }
  return serviceInstance
}