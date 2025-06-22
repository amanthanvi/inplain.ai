import { formatTimestamp } from '@policydiff/shared'
import { SYSTEM_PROMPTS, ANALYSIS_PROMPTS, PROMPT_OPTIMIZATION, optimizePromptForModel, selectBestModel } from '../../../lib/prompts'

export interface AIProvider {
  name: string
  models: AIModel[]
  endpoint: string
  headers: (apiKey: string) => Record<string, string>
  formatRequest: (model: string, prompt: string, options?: AIRequestOptions) => any
  parseResponse: (response: any) => AIResponse
}

export interface AIModel {
  id: string
  name: string
  provider: string
  contextLength: number
  costPer1kTokens: {
    input: number
    output: number
  }
  recommended?: boolean
  specialization?: 'legal' | 'financial' | 'technical' | 'general' | 'reasoning'
  supportsStreaming?: boolean
  supportsWebSearch?: boolean
  supportsTools?: boolean
}

export interface AIRequestOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  system?: string // Alias for systemPrompt
  response_format?: { type: 'json_object' | 'text' }
  stream?: boolean
  max_tokens?: number // Alias for maxTokens
}

export interface AIResponse {
  content: string
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  model: string
  finishReason: string
}

// Enhanced AI models with specializations for PolicyDiff
export const AI_MODELS: AIModel[] = [
  // Free/Low-cost tier models
  {
    id: 'google/gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash Preview',
    provider: 'Google',
    contextLength: 1048576,
    costPer1kTokens: { input: 0.0375, output: 0.15 },
    recommended: true,
    specialization: 'general' as const,
    supportsStreaming: true,
    supportsWebSearch: false
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    contextLength: 128000,
    costPer1kTokens: { input: 0.15, output: 0.6 },
    recommended: true,
    specialization: 'general' as const,
    supportsStreaming: true,
    supportsWebSearch: false
  },
  
  // Standard tier models
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'Meta',
    contextLength: 131000,
    costPer1kTokens: { input: 0.59, output: 0.79 },
    specialization: 'general' as const,
    supportsStreaming: true,
    supportsWebSearch: false
  },
  {
    id: 'google/gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    contextLength: 1048576,
    costPer1kTokens: { input: 0.075, output: 0.3 },
    recommended: true,
    specialization: 'technical' as const,
    supportsStreaming: true,
    supportsWebSearch: false
  },
  
  // Premium legal-focused models
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    contextLength: 200000,
    costPer1kTokens: { input: 3.0, output: 15.0 },
    specialization: 'legal' as const,
    supportsStreaming: true,
    supportsWebSearch: false,
    recommended: true
  },
  {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    contextLength: 128000,
    costPer1kTokens: { input: 10.0, output: 30.0 },
    specialization: 'financial' as const,
    supportsStreaming: true,
    supportsWebSearch: false
  },
  
  // Reasoning models
  {
    id: 'openai/o1-preview',
    name: 'O1 Preview',
    provider: 'OpenAI',
    contextLength: 128000,
    costPer1kTokens: { input: 15.0, output: 60.0 },
    specialization: 'reasoning' as const,
    supportsStreaming: false,
    supportsWebSearch: false
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    contextLength: 131072,
    costPer1kTokens: { input: 1.0, output: 3.0 },
    specialization: 'reasoning' as const,
    supportsStreaming: true,
    supportsWebSearch: false
  },
  
  // Web search enabled models
  {
    id: 'perplexity/llama-3.1-sonar-large-128k-online',
    name: 'Perplexity Sonar Large',
    provider: 'Perplexity',
    contextLength: 127072,
    costPer1kTokens: { input: 1.0, output: 1.0 },
    specialization: 'general' as const,
    supportsStreaming: true,
    supportsWebSearch: true
  },
  {
    id: 'openai/gpt-4o:online',
    name: 'GPT-4o with Web Search',
    provider: 'OpenAI',
    contextLength: 128000,
    costPer1kTokens: { input: 2.5, output: 10.0 },
    specialization: 'general' as const,
    supportsStreaming: true,
    supportsWebSearch: true
  },
  
  // Long context models
  {
    id: 'google/gemini-2.5-pro-preview-05-06',
    name: 'Gemini 2.5 Pro Preview',
    provider: 'Google',
    contextLength: 1048576,
    costPer1kTokens: { input: 3.5, output: 14.0 },
    specialization: 'general' as const,
    supportsStreaming: true,
    supportsWebSearch: false
  },
  {
    id: 'openai/gpt-4.1',
    name: 'GPT-4.1',
    provider: 'OpenAI',
    contextLength: 1047576,
    costPer1kTokens: { input: 2.5, output: 10.0 },
    recommended: true,
    specialization: 'general' as const,
    supportsStreaming: true,
    supportsWebSearch: false
  }
].sort((a, b) => {
  // Sort by total cost (input + output) for 1K tokens
  const costA = a.costPer1kTokens.input + a.costPer1kTokens.output
  const costB = b.costPer1kTokens.input + b.costPer1kTokens.output
  return costA - costB
})

// OpenRouter provider configuration
export const OPENROUTER_PROVIDER: AIProvider = {
  name: 'OpenRouter',
  models: AI_MODELS,
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  
  headers: (apiKey: string) => ({
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://policydiff.com',
    'X-Title': 'PolicyDiff'
  }),
  
  formatRequest: (model: string, prompt: string, options: AIRequestOptions = {}) => {
    const systemPrompt = options.systemPrompt || options.system
    const maxTokens = options.maxTokens || options.max_tokens || 1000
    
    const request: any = {
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: options.temperature || 0.3,
      stream: options.stream || false
    }
    
    if (options.response_format) {
      request.response_format = options.response_format
    }
    
    return request
  },
  
  parseResponse: (response: any): AIResponse => {
    const choice = response.choices[0]
    const usage = response.usage || {}
    
    return {
      content: choice.message.content,
      tokensUsed: {
        input: usage.prompt_tokens || 0,
        output: usage.completion_tokens || 0,
        total: usage.total_tokens || 0
      },
      model: response.model,
      finishReason: choice.finish_reason
    }
  }
}

// Rate limiting and caching interfaces
interface RateLimitState {
  requests: number
  resetTime: number
}

interface CacheEntry {
  response: AIResponse
  timestamp: number
  expiresAt: number
}

export class AIService {
  private provider: AIProvider
  private apiKey: string
  private defaultModel: string
  private rateLimit: Map<string, RateLimitState> = new Map()
  private cache: Map<string, CacheEntry> = new Map()
  private readonly maxRequestsPerMinute = 60
  private readonly cacheExpiryMs = 1000 * 60 * 60 * 24 // 24 hours
  private readonly maxRetries = 3
  private readonly retryDelay = 1000 // Base delay in ms

  constructor(
    apiKey: string, 
    provider: AIProvider = OPENROUTER_PROVIDER,
    defaultModel: string = 'google/gemini-2.5-flash-preview-05-20'
  ) {
    this.provider = provider
    this.apiKey = apiKey
    this.defaultModel = defaultModel
    
    // Clean up expired cache entries every hour
    setInterval(() => this.cleanupCache(), 1000 * 60 * 60)
  }

  private getCacheKey(prompt: string, model: string, options: AIRequestOptions): string {
    return `${model}:${JSON.stringify(options)}:${prompt.substring(0, 100)}`
  }

  private isRateLimited(model: string): boolean {
    const now = Date.now()
    const key = `${model}:${Math.floor(now / 60000)}` // Per minute bucket
    
    const state = this.rateLimit.get(key)
    if (!state) {
      this.rateLimit.set(key, { requests: 1, resetTime: now + 60000 })
      return false
    }
    
    if (now > state.resetTime) {
      this.rateLimit.set(key, { requests: 1, resetTime: now + 60000 })
      return false
    }
    
    if (state.requests >= this.maxRequestsPerMinute) {
      return true
    }
    
    state.requests++
    return false
  }

  private cleanupCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  private validatePrompt(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty')
    }
    
    if (prompt.length > 500000) {
      throw new Error('Prompt too long (max 500k characters)')
    }
    
    // Basic safety checks
    const unsafePatterns = [
      /\bignore\s+(?:previous|all)\s+instructions?\b/i,
      /\bjailbreak\b/i,
      /\bdeveloper\s+mode\b/i,
      /\bprompt\s+injection\b/i
    ]
    
    for (const pattern of unsafePatterns) {
      if (pattern.test(prompt)) {
        throw new Error('Prompt contains potentially unsafe content')
      }
    }
  }

  async generateResponse(
    prompt: string, 
    options: AIRequestOptions & { model?: string; useCache?: boolean; fallbackModels?: string[] } = {}
  ): Promise<AIResponse> {
    const model = options.model || this.defaultModel
    const useCache = options.useCache !== false // Default to true
    const fallbackModels = options.fallbackModels || []
    
    // Validate input
    this.validatePrompt(prompt)
    
    // Check rate limiting
    if (this.isRateLimited(model)) {
      throw new Error('Rate limit exceeded. Please try again in a minute.')
    }
    
    // Check cache
    if (useCache) {
      const cacheKey = this.getCacheKey(prompt, model, options)
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() < cached.expiresAt) {
        return { ...cached.response, cached: true } as AIResponse & { cached: boolean }
      }
    }
    
    // Try primary model with retries
    try {
      return await this.generateWithRetries(prompt, model, options, useCache)
    } catch (primaryError) {
      console.error(`Primary model ${model} failed:`, primaryError)
      
      // Try fallback models
      for (const fallbackModel of fallbackModels) {
        try {
          console.log(`Trying fallback model: ${fallbackModel}`)
          return await this.generateWithRetries(prompt, fallbackModel, options, useCache)
        } catch (fallbackError) {
          console.error(`Fallback model ${fallbackModel} failed:`, fallbackError)
        }
      }
      
      // All models failed
      throw primaryError
    }
  }
  
  private async generateWithRetries(
    prompt: string,
    model: string,
    options: AIRequestOptions,
    useCache: boolean
  ): Promise<AIResponse> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.callAPI(prompt, model, options)
        
        // Cache successful response
        if (useCache) {
          const cacheKey = this.getCacheKey(prompt, model, options)
          this.cache.set(cacheKey, {
            response,
            timestamp: Date.now(),
            expiresAt: Date.now() + this.cacheExpiryMs
          })
        }
        
        return response
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          throw lastError
        }
        
        // Calculate exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1)
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError || new Error('All retry attempts failed')
  }
  
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return (
      message.includes('invalid request') ||
      message.includes('insufficient credits') ||
      message.includes('unsafe content') ||
      message.includes('rate limit exceeded')
    )
  }
  
  private async callAPI(
    prompt: string,
    model: string,
    options: AIRequestOptions
  ): Promise<AIResponse> {
    
    // Optimize prompt for the specific model
    const optimizedPrompt = optimizePromptForModel(prompt, model)
    
    const request = this.provider.formatRequest(model, optimizedPrompt, {
      ...options,
      maxTokens: Math.min(options.maxTokens || 1500, 4000), // Cap at 4k tokens
      temperature: Math.max(0, Math.min(options.temperature || 0.3, 1)) // Clamp 0-1
    })
    
    const response = await fetch(this.provider.endpoint, {
      method: 'POST',
      headers: this.provider.headers(this.apiKey),
      body: JSON.stringify(request),
      signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined // 30s timeout if supported
    })

      if (!response.ok) {
        const errorText = await response.text()
        
        // Handle specific OpenRouter errors
        if (response.status === 429) {
          throw new Error('Rate limit exceeded by OpenRouter. Please try again later.')
        } else if (response.status === 402) {
          throw new Error('Insufficient credits. Please check your OpenRouter balance.')
        } else if (response.status === 400) {
          throw new Error('Invalid request format or unsupported model.')
        }
        
        throw new Error(`AI API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      const aiResponse = this.provider.parseResponse(data)
      
    // Validate response
    if (!aiResponse.content || aiResponse.content.trim().length === 0) {
      throw new Error('Received empty response from AI model')
    }
    
    return aiResponse
  }

  getAvailableModels(): AIModel[] {
    return this.provider.models
  }

  getModelById(modelId: string): AIModel | undefined {
    return this.provider.models.find(m => m.id === modelId)
  }

  getRecommendedModels(): AIModel[] {
    return this.provider.models.filter(m => m.recommended)
  }

  estimateCost(inputTokens: number, outputTokens: number, modelId: string): number {
    const model = this.getModelById(modelId)
    if (!model) return 0
    
    const inputCost = (inputTokens / 1000) * model.costPer1kTokens.input
    const outputCost = (outputTokens / 1000) * model.costPer1kTokens.output
    
    return inputCost + outputCost
  }

  /**
   * Send a raw request to the AI API with full control over options
   * This is useful for advanced use cases where you need direct API access
   */
  async sendRequest(
    model: string, 
    prompt: string, 
    options: AIRequestOptions = {}
  ): Promise<string> {
    const response = await this.generateResponse(prompt, {
      ...options,
      model,
      useCache: false // Disable caching for raw requests
    })
    
    return response.content
  }
}

// Policy analysis specific prompts and parsing
export class PolicyAnalysisService extends AIService {
  private systemPrompt = SYSTEM_PROMPTS.privacyAnalyst

  async analyzePolicyChanges(
    diffData: {
      additions: number
      deletions: number
      changeCount: number
      changeType: string
      htmlDiff: string
      oldContent?: string
      newContent?: string
    },
    options: { model?: string; forceRegenerate?: boolean } = {}
  ) {
    // Use the structured differential prompt from the prompts library
    const prompt = diffData.oldContent && diffData.newContent 
      ? ANALYSIS_PROMPTS.differential(diffData.oldContent, diffData.newContent)
      : `Analyze the following privacy policy changes and provide a structured JSON response:

**Change Statistics:**
- ${diffData.additions} characters added
- ${diffData.deletions} characters deleted  
- ${diffData.changeCount} total changes
- Change type: ${diffData.changeType}

**HTML Diff:**
${diffData.htmlDiff}

Provide a JSON response following this format:
{
  "change_summary": "Overview of what changed and why it matters",
  "key_highlights": ["Most significant changes that affect users"],
  "risk_level": "low/medium/high",
  "categories": ["affected areas like data_collection, data_sharing, etc."],
  "user_impact": "How these changes affect user privacy",
  "recommended_actions": ["What users should do in response"]
}

Return ONLY valid JSON without markdown formatting.`

    // Get available models and select the best one for differential analysis
    const availableModels = this.getAvailableModels().map(m => m.id)
    const selectedModel = options.model || selectBestModel('comprehensive', availableModels)
    
    // Define fallback models for reliability
    const fallbackModels = PROMPT_OPTIMIZATION.modelRecommendations.comprehensive
      .filter(m => m !== selectedModel && availableModels.includes(m))

    const response = await this.generateResponse(prompt, {
      model: selectedModel,
      systemPrompt: SYSTEM_PROMPTS.comparativeAnalyst,
      maxTokens: PROMPT_OPTIMIZATION.maxTokens.differential,
      temperature: PROMPT_OPTIMIZATION.temperatures.comparative,
      fallbackModels
    })

    return {
      ...this.parseAnalysisResponse(response.content),
      model: response.model,
      tokensUsed: response.tokensUsed.total,
      generatedAt: formatTimestamp()
    }
  }

  private parseAnalysisResponse(content: string): {
    summary: string
    highlights: string[]
    riskLevel: 'low' | 'medium' | 'high'
    categories: string[]
  } {
    // First try to parse as JSON
    try {
      const cleanedContent = content
        .replace(/^```json\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim()
      
      const parsed = JSON.parse(cleanedContent)
      
      return {
        summary: parsed.change_summary || parsed.summary || parsed.user_impact || 'Policy changes detected.',
        highlights: parsed.key_highlights || parsed.highlights || [],
        riskLevel: this.parseRiskLevel(parsed.risk_level || parsed.riskLevel || 'low'),
        categories: Array.isArray(parsed.categories) ? parsed.categories : this.parseCategories(parsed.categories || '')
      }
    } catch (parseError) {
      console.error('Failed to parse JSON response, falling back to text extraction:', parseError)
      
      // Fallback to text extraction
      const sections = this.extractSections(content)
      
      return {
        summary: sections.summary || 'Policy changes have been detected and analyzed.',
        highlights: sections.highlights.slice(0, 5),
        riskLevel: this.parseRiskLevel(sections.risk),
        categories: this.parseCategories(sections.categories)
      }
    }
  }

  private extractSections(content: string) {
    const sections = {
      summary: '',
      highlights: [] as string[],
      risk: '',
      categories: ''
    }

    const lines = content.split('\n').map(line => line.trim()).filter(Boolean)
    let currentSection = ''

    for (const line of lines) {
      if (line.match(/^##?\s*summary/i)) {
        currentSection = 'summary'
      } else if (line.match(/^##?\s*key\s*highlights?/i)) {
        currentSection = 'highlights'
      } else if (line.match(/^##?\s*risk\s*assessment/i)) {
        currentSection = 'risk'
      } else if (line.match(/^##?\s*categories/i)) {
        currentSection = 'categories'
      } else if (currentSection === 'summary' && !line.startsWith('#')) {
        sections.summary = line
      } else if (currentSection === 'highlights' && line.startsWith('-')) {
        sections.highlights.push(line.replace(/^[-*]\s*/, ''))
      } else if (currentSection === 'risk' && !line.startsWith('#')) {
        sections.risk = line
      } else if (currentSection === 'categories' && !line.startsWith('#')) {
        sections.categories = line
      }
    }

    return sections
  }

  private parseRiskLevel(riskText: string): 'low' | 'medium' | 'high' {
    const text = riskText.toLowerCase()
    if (text.includes('high')) return 'high'
    if (text.includes('medium')) return 'medium'
    return 'low'
  }

  private parseCategories(categoriesText: string): string[] {
    const validCategories = [
      'data_collection', 'data_sharing', 'data_retention', 
      'user_rights', 'security', 'cookies', 'third_parties', 
      'children', 'other'
    ]

    const found = new Set<string>()
    const text = categoriesText.toLowerCase()

    const categoryMap: Record<string, string> = {
      'data collection': 'data_collection',
      'data sharing': 'data_sharing', 
      'data retention': 'data_retention',
      'user rights': 'user_rights',
      'security': 'security',
      'cookies': 'cookies',
      'third parties': 'third_parties',
      'children': 'children',
      'other': 'other'
    }

    for (const [phrase, category] of Object.entries(categoryMap)) {
      if (text.includes(phrase)) {
        found.add(category)
      }
    }

    // Also check for exact category names
    for (const category of validCategories) {
      if (text.includes(category)) {
        found.add(category)
      }
    }

    return Array.from(found)
  }
}