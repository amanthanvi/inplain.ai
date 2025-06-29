// Placeholder for Model Catalog
// This file will store information about available AI models

export interface AIModelCapability {
  type: 'text_generation' | 'tool_use' | 'web_search' | 'image_input' | 'json_output';
  // Add specific details per capability, e.g., for tool_use, list of supported tool schemas
}

export interface AIModelRate {
  prompt: number; // Cost per 1M prompt tokens
  completion: number; // Cost per 1M completion tokens
  unit: 'USD_PER_MTKN'; // Unit for cost
}

export interface AIModelMeta {
  id: string; // Unique model ID, matching OpenRouter's model name
  name: string; // Human-readable name
  provider: string; // e.g., OpenAI, Anthropic, Google
  contextWindow: number; // Max tokens in context
  capabilities: AIModelCapability[];
  performanceTier?: 'fast' | 'balanced' | 'advanced' | 'specialized'; // Our classification
  temperature?: number; // Default temperature for this model
  maxTokens?: number; // Default max output tokens for this model
  rate?: AIModelRate; // Pricing information
  notes?: string; // Any specific notes about the model
}

// Example model definitions - this will be expanded and curated
const MODEL_CATALOG: AIModelMeta[] = [
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    contextWindow: 128000,
    capabilities: [
      { type: 'text_generation' },
      { type: 'tool_use' },
      { type: 'json_output' },
      { type: 'image_input' },
    ],
    performanceTier: 'balanced',
    rate: { prompt: 0.15, completion: 0.60, unit: 'USD_PER_MTKN'},
    notes: 'High intelligence, multi-modal, good for complex tasks, cost-effective for its capabilities.'
  },
  {
    id: 'anthropic/claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    contextWindow: 200000,
    capabilities: [
      { type: 'text_generation' },
      { type: 'tool_use' }, // Assuming Haiku supports tool use effectively
      { type: 'json_output' },
    ],
    performanceTier: 'fast',
    rate: { prompt: 0.25, completion: 1.25, unit: 'USD_PER_MTKN'},
    notes: 'Fastest and most compact model in Claude 3 family, good for responsiveness.'
  },
  {
    id: 'anthropic/claude-3.5-sonnet-20240620',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    contextWindow: 200000,
    capabilities: [
        { type: 'text_generation' },
        { type: 'tool_use' },
        { type: 'json_output' },
        { type: 'image_input' },
    ],
    performanceTier: 'advanced', // Superior to Opus for many tasks
    rate: { prompt: 3.00, completion: 15.00, unit: 'USD_PER_MTKN' },
    notes: 'Anthropic\'s most intelligent model as of June 2024, strong vision capabilities.'
  },
  {
    id: 'perplexity/llama-3-sonar-large-32k-online', // Example, check OpenRouter for exact ID
    name: 'Perplexity Llama 3 Sonar Large Online',
    provider: 'Perplexity',
    contextWindow: 32768,
    capabilities: [
      { type: 'text_generation' },
      { type: 'web_search' }, // Native web search capability
      { type: 'json_output' }, // Often good at following formatting instructions
    ],
    performanceTier: 'specialized',
    rate: { prompt: 1.00, completion: 1.00, unit: 'USD_PER_MTKN'}, // Example rate
    notes: 'Excellent for tasks requiring real-time web information. May answer directly or use search in its reasoning. Check if tool use is supported if needed alongside search.'
  },
  {
    id: 'google/gemini-2.0-flash-exp', // Fictional or example, verify actual ID
    name: 'Gemini 2.0 Flash (Experimental)',
    provider: 'Google',
    contextWindow: 1048576, // Example, verify
    capabilities: [
      { type: 'text_generation' },
      { type: 'tool_use' },
      { type: 'json_output' },
      // { type: 'web_search' }, // If supported directly
    ],
    performanceTier: 'fast',
    // rate: { prompt: 0.075, completion: 0.30, unit: 'USD_PER_MTKN' }, // Example from old file
    notes: 'Google\'s fast model, potentially with long context. Check OpenRouter for free status or specific ID.'
  },
  // TODO: Add more models based on inspection of existing services and OpenRouter docs.
  // Models from `enhanced-ai-service.ts`:
  // 'openai/gpt-3.5-turbo'
  // 'anthropic/claude-3-sonnet'
  // 'openai/gpt-4-turbo'
  // 'anthropic/claude-3-opus' (Consider 3.5 Sonnet as potentially replacing this for many tasks)
  // 'openai/gpt-4-vision-preview' (or gpt-4o/gpt-4o-mini for vision)

  // Models from `ai-service.ts` (OpenRouter legal category, check for current relevance):
  // 'meta-llama/llama-3.3-70b-instruct' (Typo? Llama 3 is 70B, not 3.3) -> meta-llama/llama-3-70b-instruct
  // 'deepseek/deepseek-r1-0528-qwen3-8b' (Might be too specialized or outdated name)
  // 'google/gemini-2.5-flash-preview-05-20' (and other previews)
  // 'google/gemini-2.5-pro-preview-05-06' (and other previews)
  // 'openai/gpt-4.1' (Likely gpt-4-turbo or gpt-4o now)
];

export function getModelById(id: string): AIModelMeta | undefined {
  return MODEL_CATALOG.find(model => model.id === id);
}

export function getAllModels(): AIModelMeta[] {
  return [...MODEL_CATALOG];
}

export function findModelsByCapability(capabilityType: AIModelCapability['type']): AIModelMeta[] {
  return MODEL_CATALOG.filter(model =>
    model.capabilities.some(cap => cap.type === capabilityType)
  );
}

export function findModelsByPerformanceTier(tier: AIModelMeta['performanceTier']): AIModelMeta[] {
  return MODEL_CATALOG.filter(model => model.performanceTier === tier);
}

// TODO: Add more sophisticated model selection logic here based on ModelConfigOptions
// e.g., selectBestModelForTask(options: ModelConfigOptions): AIModelMeta | undefined
// This function would consider tier, capabilities, cost, context window, etc.
// It could also incorporate provider preferences or specific model requests.
