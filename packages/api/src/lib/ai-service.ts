import { formatTimestamp } from '@inplain.ai/shared'

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
}

export interface AIRequestOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
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

// Top 10 Legal category models from OpenRouter, sorted by cost-effectiveness
export const AI_MODELS: AIModel[] = [
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    contextLength: 128000,
    costPer1kTokens: { input: 0.15, output: 0.6 },
    recommended: true
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'Meta',
    contextLength: 131000,
    costPer1kTokens: { input: 0.59, output: 0.79 }
  },
  {
    id: 'openai/gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'OpenAI',
    contextLength: 1047576,
    costPer1kTokens: { input: 0.8, output: 3.2 }
  },
  {
    id: 'deepseek/deepseek-r1-0528-qwen3-8b',
    name: 'DeepSeek R1 Qwen3 8B',
    provider: 'DeepSeek',
    contextLength: 131072,
    costPer1kTokens: { input: 1.0, output: 3.0 }
  },
  {
    id: 'google/gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    contextLength: 1048576,
    costPer1kTokens: { input: 0.075, output: 0.3 },
    recommended: true
  },
  {
    id: 'google/gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash Preview (May 20)',
    provider: 'Google',
    contextLength: 1048576,
    costPer1kTokens: { input: 0.0375, output: 0.15 }
  },
  {
    id: 'google/gemini-2.5-flash-preview-04-17',
    name: 'Gemini 2.5 Flash Preview (April 17)',
    provider: 'Google',
    contextLength: 1048576,
    costPer1kTokens: { input: 0.0375, output: 0.15 }
  },
  {
    id: 'google/gemini-2.5-pro-preview-05-06',
    name: 'Gemini 2.5 Pro Preview (May 6)',
    provider: 'Google',
    contextLength: 1048576,
    costPer1kTokens: { input: 3.5, output: 14.0 }
  },
  {
    id: 'google/gemini-2.5-pro-preview-06-05',
    name: 'Gemini 2.5 Pro Preview (June 5)',
    provider: 'Google',
    contextLength: 1048576,
    costPer1kTokens: { input: 3.5, output: 14.0 }
  },
  {
    id: 'openai/gpt-4.1',
    name: 'GPT-4.1',
    provider: 'OpenAI',
    contextLength: 1047576,
    costPer1kTokens: { input: 2.5, output: 10.0 },
    recommended: true
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
    'HTTP-Referer': 'https://inplain.ai',
    'X-Title': 'Inplain.AI'
  }),
  
  formatRequest: (model: string, prompt: string, options: AIRequestOptions = {}) => ({
    model,
    messages: [
      ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      { role: 'user', content: prompt }
    ],
    max_tokens: options.maxTokens || 1000,
    temperature: options.temperature || 0.3,
    stream: false
  }),
  
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
    options: AIRequestOptions & { model?: string; useCache?: boolean } = {}
  ): Promise<AIResponse> {
    const model = options.model || this.defaultModel
    const useCache = options.useCache !== false // Default to true
    
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
    
    try {
      const request = this.provider.formatRequest(model, prompt, {
        ...options,
        maxTokens: Math.min(options.maxTokens || 1500, 4000), // Cap at 4k tokens
        temperature: Math.max(0, Math.min(options.temperature || 0.3, 1)) // Clamp 0-1
      })
      
      const response = await fetch(this.provider.endpoint, {
        method: 'POST',
        headers: this.provider.headers(this.apiKey),
        body: JSON.stringify(request)
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
      
      // Cache the response
      if (useCache) {
        const cacheKey = this.getCacheKey(prompt, model, options)
        this.cache.set(cacheKey, {
          response: aiResponse,
          timestamp: Date.now(),
          expiresAt: Date.now() + this.cacheExpiryMs
        })
      }
      
      return aiResponse
      
    } catch (error) {
      console.error(`AI service error with model ${model}:`, error)
      throw error
    }
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
}

// Policy analysis specific prompts and parsing
export class PolicyAnalysisService extends AIService {
  private systemPrompt = `You are an expert privacy policy analyst. Your role is to analyze changes to privacy policies and terms of service documents, providing clear, accurate assessments of how changes affect user privacy and rights.

When analyzing policy changes:
1. Focus on practical implications for users
2. Use clear, non-technical language
3. Assess privacy risks objectively
4. Categorize changes appropriately
5. Highlight the most important changes

Always respond in this structured format:

## Summary
[2-3 sentence summary of what changed]

## Key Highlights
- [Most important change 1]
- [Most important change 2]
- [etc, up to 5 items]

## Risk Assessment
[low/medium/high]

## Categories
[comma-separated list: data_collection, data_sharing, data_retention, user_rights, security, cookies, third_parties, children, other]`

  async analyzePolicyChanges(
    diffData: {
      additions: number
      deletions: number
      changeCount: number
      changeType: string
      htmlDiff: string
    },
    options: { model?: string; forceRegenerate?: boolean } = {}
  ) {
    const prompt = `Analyze the following privacy policy changes:

**Change Statistics:**
- ${diffData.additions} characters added
- ${diffData.deletions} characters deleted  
- ${diffData.changeCount} total changes
- Change type: ${diffData.changeType}

**HTML Diff:**
${diffData.htmlDiff}

Please provide your analysis following the structured format.`

    const response = await this.generateResponse(prompt, {
      model: options.model,
      systemPrompt: this.systemPrompt,
      maxTokens: 1500,
      temperature: 0.2
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
    const sections = this.extractSections(content)
    
    return {
      summary: sections.summary || 'Changes detected in the policy document.',
      highlights: sections.highlights.slice(0, 5),
      riskLevel: this.parseRiskLevel(sections.risk),
      categories: this.parseCategories(sections.categories)
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