import OpenAI from 'openai';
import { AIModelMeta, getModelById, findModelsByPerformanceTier } from './model-catalog';

// Custom Error Classes
export class AIError extends Error {
  constructor(message: string, public cause?: any) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AIConfigurationError extends AIError {}
export class AIRequestError extends AIError {}
export class AIResponseError extends AIError {}
export class AIRateLimitError extends AIResponseError {}
export class AINotFoundError extends AIResponseError {} // For 404s from provider
export class AIAuthError extends AIConfigurationError {} // For 401/403s from provider
export class AITimeoutError extends AIRequestError {}

export type StreamingEventType =
  | "model"           // Provides the model name being used
  | "textDelta"       // A chunk of text content
  | "toolCallDelta"   // A chunk of a tool call's arguments or name
  | "toolCallComplete"// Signals a complete tool call with all its arguments
  | "finishReason"    // The reason the stream segment ended (e.g., "stop", "tool_calls")
  | "error";          // An error occurred during streaming

export interface StreamingEvent {
  type: StreamingEventType;
  data: any; // Data structure depends on the event type
}

// Example data structures for StreamingEvent data:
// For "model": string (model name)
// For "textDelta": string (text chunk)
// For "toolCallDelta": { id: string; name?: string; argsChunk: string; }
// For "toolCallComplete": { id: string; name: string; args: string; } (args is full JSON string)
// For "finishReason": string
// For "error": { message: string; code?: number; }


// Main service interfaces
export interface UnifiedAIRequest {
  prompt: string;
  systemPrompt?: string;
  // Define tools for structured output
  tools?: OpenAITool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  modelConfig?: ModelConfigOptions; // To select model type, capabilities
  // Other options like temperature, maxTokens will go here or in ModelConfigOptions
  temperature?: number;
  maxTokens?: number;
  stream?: boolean; // For streaming responses
  // Add other relevant request parameters
}

export interface UnifiedAIResponse {
  content?: string | null; // For text responses, OpenRouter uses null for tool use
  toolCalls?: ToolCall[];
  error?: string;
  modelUsed: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  // Add other relevant response parameters like finishReason, latency
}

export interface ModelConfigOptions {
  // Options to guide model selection, e.g.:
  // type: 'fast' | 'balanced' | 'advanced';
  // capabilities: ('text' | 'json_tool' | 'web_search')[];
  // specificModelId?: string; // To request a specific model
}

export class UnifiedAIService {
  private openRouterApiKey: string;
  private openai: OpenAI;
  private defaultModelId: string = 'anthropic/claude-3-haiku-20240307'; // A sensible default
  // TODO: Add cache, rate limiter, retry policies, etc.

  constructor(openRouterApiKey: string, defaultModelId?: string) {
    if (!openRouterApiKey) {
      throw new AIConfigurationError("OpenRouter API key is required for UnifiedAIService.");
    }
    this.openRouterApiKey = openRouterApiKey;
    if (defaultModelId) {
      this.defaultModelId = defaultModelId;
    }

    this.openai = new OpenAI({
      apiKey: this.openRouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        // TODO: Make these configurable or pass from environment
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'InplainAI',
      },
      timeout: 60 * 1000, // 60 seconds timeout
    });
  }

  private selectModel(options?: ModelConfigOptions): AIModelMeta {
    // Basic model selection logic, to be expanded
    if (options?.specificModelId) {
      const model = getModelById(options.specificModelId);
      if (model) return model;
      console.warn(`Requested specific model ${options.specificModelId} not found or configured. Falling back.`);
    }

    if (options?.performanceTier) {
        const tierModels = findModelsByPerformanceTier(options.performanceTier);
        if (tierModels.length > 0 && tierModels[0]) { // Add null check for tierModels[0]
            // TODO: Add more logic here, e.g. pick cheapest, or one with specific capabilities
            return tierModels[0];
        }
    }

    const defaultModel = getModelById(this.defaultModelId);
    if (!defaultModel) {
        // This case should ideally not happen if defaultModelId is valid
        throw new AIConfigurationError(`Default model ${this.defaultModelId} not found in catalog.`);
    }
    return defaultModel;
  }

  async request(request: UnifiedAIRequest): Promise<UnifiedAIResponse> {
    const modelMeta = this.selectModel(request.modelConfig);
    const modelIdToUse = modelMeta.id;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    try {
      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: modelIdToUse,
        messages: messages,
        temperature: request.temperature ?? modelMeta.temperature ?? 0.7, // Provide a default if not in modelMeta
        max_tokens: request.maxTokens ?? modelMeta.maxTokens ?? 1024, // Provide a default
        // stream: request.stream ?? false, // Add later for streamRequest
      };

      if (request.tools && request.tools.length > 0) {
        completionParams.tools = request.tools;
        completionParams.tool_choice = request.toolChoice ?? 'auto';
      }

      const response: OpenAI.Chat.Completions.ChatCompletion = await this.openai.chat.completions.create(completionParams);

      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      const choice = response.choices[0];

      if (!choice) {
        throw new AIResponseError("No choice returned from AI model.");
      }

      return {
        content: choice.message.content,
        toolCalls: choice.message.tool_calls?.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments
          }
        })),
        modelUsed: response.model,
        tokensUsed: {
          input: usage.prompt_tokens,
          output: usage.completion_tokens,
          total: usage.total_tokens,
        },
      };
    } catch (error: any) {
      if (error instanceof OpenAI.APIError) {
        // More specific error handling based on OpenAI/OpenRouter status codes
        if (error.status === 401 || error.status === 403) throw new AIAuthError(error.message, error);
        if (error.status === 429) throw new AIRateLimitError(error.message, error);
        if (error.status === 404) throw new AINotFoundError(error.message, error); // Model not found etc.
        // Default to AIResponseError for other API errors
        throw new AIResponseError(`OpenRouter API Error: ${error.status} ${error.message}`, error);
      }
      // Re-throw other errors or wrap them
      throw new AIError(`UnifiedAIService request failed: ${error.message}`, error);
    }
  }

  async *streamRequest(
    request: UnifiedAIRequest
  ): AsyncGenerator<StreamingEvent, void, undefined> {
    const modelMeta = this.selectModel(request.modelConfig);
    const modelIdToUse = modelMeta.id;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.prompt });

    let accumulatedToolCallArgs: { [toolCallId: string]: string } = {};
    let toolCallFunctionName: { [toolCallId: string]: string } = {};

    try {
      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: modelIdToUse,
        messages: messages,
        temperature: request.temperature ?? modelMeta.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? modelMeta.maxTokens ?? 1024, // Max tokens for the whole response
        stream: true,
      };

      if (request.tools && request.tools.length > 0) {
        completionParams.tools = request.tools;
        completionParams.tool_choice = request.toolChoice ?? "auto";
      }

      const stream = await this.openai.chat.completions.create(completionParams);
      yield { type: "model", data: stream.model || modelIdToUse };


      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        if (choice.delta.content) {
          yield { type: "textDelta", data: choice.delta.content };
        }

        if (choice.delta.tool_calls) {
          for (const toolCallDelta of choice.delta.tool_calls) {
            const toolCallId = toolCallDelta.id;

            if (toolCallId && toolCallDelta.function?.name) {
              toolCallFunctionName[toolCallId] = toolCallDelta.function.name;
            }

            if (toolCallId && toolCallDelta.function?.arguments) {
              if (!accumulatedToolCallArgs[toolCallId]) {
                accumulatedToolCallArgs[toolCallId] = "";
              }
              accumulatedToolCallArgs[toolCallId] += toolCallDelta.function.arguments;

              // Yield intermediate progress for tool call arguments
              yield {
                type: "toolCallDelta",
                data: {
                  id: toolCallId,
                  name: toolCallFunctionName[toolCallId], // Send the name with each delta
                  argsChunk: toolCallDelta.function.arguments,
                }
              };
            }
          }
        }

        if (choice.finish_reason) { // Indicates end of a message or tool call sequence for this choice
          if (choice.finish_reason === "tool_calls") {
            // All tool call argument chunks should have been received.
            // Yield the fully accumulated arguments for each tool call.
            for (const toolCallId in accumulatedToolCallArgs) {
              yield {
                type: "toolCallComplete",
                data: {
                  id: toolCallId,
                  name: toolCallFunctionName[toolCallId],
                  args: accumulatedToolCallArgs[toolCallId], // The complete JSON string for arguments
                }
              };
            }
            // Reset for potential future tool calls in complex scenarios (though typically one set per request)
            accumulatedToolCallArgs = {};
            toolCallFunctionName = {};
          }
          yield { type: "finishReason", data: choice.finish_reason };
        }
      }

      // After the loop, OpenRouter might send a final chunk with usage if not already part of the main stream.
      // For now, we assume usage might be part of the last chunk or needs a separate call if this.openai.chat.completions. έτσι
      // The 'usage' is typically available on the response object of a non-streaming call, or in specific events for streaming.
      // If OpenRouter streaming doesn't provide total usage directly in the stream, we might omit it or estimate.
      // For now, this example doesn't explicitly yield total usage from stream.
      // It would be part of the `chunk.usage` or a final event if supported by the provider.

    } catch (error: any) {
      if (error instanceof OpenAI.APIError) {
        if (error.status === 401 || error.status === 403) throw new AIAuthError(error.message, error);
        if (error.status === 429) throw new AIRateLimitError(error.message, error);
        if (error.status === 404) throw new AINotFoundError(error.message, error);
        throw new AIResponseError(`OpenRouter API Error (stream): ${error.status} ${error.message}`, error);
      }
      throw new AIError(`UnifiedAIService streamRequest failed: ${error.message}`, error);
    }
  }
  // TODO: Add methods for model selection, error handling, etc.
}

// Interfaces for OpenAI-compatible Tool Calling
// See: https://platform.openai.com/docs/guides/function-calling
// OpenRouter uses a similar structure.

export interface OpenAIFunctionParameters {
  type: 'object';
  properties: {
    [key: string]: {
      type: string;
      description?: string;
      enum?: string[];
      items?: { // For array type
        type: string;
      };
    };
  };
  required?: string[];
}

export interface OpenAIFunction {
  name: string;
  description?: string;
  parameters: OpenAIFunctionParameters;
}

export interface OpenAITool {
  type: 'function';
  function: OpenAIFunction;
}

export interface ToolCallFunction {
  name?: string;
  arguments?: string; // JSON string
}

export interface ToolCall {
  id: string; // Tool call ID
  type: 'function';
  function: ToolCallFunction;
}


// Singleton instance management (optional, consider dependency injection)
let serviceInstance: UnifiedAIService | null = null;

export function getUnifiedAIService(): UnifiedAIService {
  if (!serviceInstance) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      // In a real app, you might have a mock/demo service here
      // or throw a more specific error to be caught at app startup.
      console.warn("OPENROUTER_API_KEY is not set. UnifiedAIService may not function correctly.");
      // For now, let's allow it to be created but it will likely fail on requests.
      // Or, throw: throw new Error("OPENROUTER_API_KEY is not configured for UnifiedAIService singleton.");
    }
    serviceInstance = new UnifiedAIService(apiKey || "DUMMY_KEY_FOR_INITIALIZATION_ALLOWANCE");
  }
  return serviceInstance;
}
