import { caches } from './redis-cache'
import { logger } from '@/lib/logger'
import { HashUtils } from '@/lib/utils/hash'

const AI_RESPONSE_TTL = 86400 // 24 hours
const EMBEDDING_TTL = 604800 // 7 days

interface AIResponse {
  model: string
  prompt: string
  response: string
  metadata?: Record<string, any>
  timestamp: number
}

interface Embedding {
  text: string
  vector: number[]
  model: string
  dimensions: number
}

export class AICache {
  /**
   * Generate cache key for AI responses
   */
  private static getResponseKey(
    model: string,
    prompt: string,
    params?: Record<string, any>
  ): string {
    return HashUtils.generateCacheKey(`${model}:${prompt}:${JSON.stringify(params || {})}`, 'ai:response')
  }

  /**
   * Generate cache key for embeddings
   */
  private static getEmbeddingKey(text: string, model: string): string {
    return HashUtils.generateCacheKey(`${model}:${text}`, 'ai:embedding')
  }

  /**
   * Cache an AI response
   */
  static async setResponse(
    model: string,
    prompt: string,
    response: string,
    params?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    const key = this.getResponseKey(model, prompt, params)
    const data: AIResponse = {
      model,
      prompt,
      response,
      metadata,
      timestamp: Date.now(),
    }

    await caches.data.set(key, data, {
      ttl: AI_RESPONSE_TTL,
      tags: ['ai', 'ai:response', `ai:model:${model}`],
    })

    logger.info('AI response cached', { model, promptLength: prompt.length })
  }

  /**
   * Get a cached AI response
   */
  static async getResponse(
    model: string,
    prompt: string,
    params?: Record<string, any>
  ): Promise<string | null> {
    const key = this.getResponseKey(model, prompt, params)
    const cached = await caches.data.get<AIResponse>(key)

    if (cached) {
      logger.info('AI response cache hit', { model, promptLength: prompt.length })
      return cached.response
    }

    return null
  }

  /**
   * Cache an embedding
   */
  static async setEmbedding(
    text: string,
    vector: number[],
    model: string
  ): Promise<void> {
    const key = this.getEmbeddingKey(text, model)
    const data: Embedding = {
      text,
      vector,
      model,
      dimensions: vector.length,
    }

    await caches.data.set(key, data, {
      ttl: EMBEDDING_TTL,
      tags: ['ai', 'ai:embedding', `ai:model:${model}`],
    })
  }

  /**
   * Get a cached embedding
   */
  static async getEmbedding(
    text: string,
    model: string
  ): Promise<number[] | null> {
    const key = this.getEmbeddingKey(text, model)
    const cached = await caches.data.get<Embedding>(key)

    if (cached) {
      logger.info('Embedding cache hit', { model, textLength: text.length })
      return cached.vector
    }

    return null
  }

  /**
   * Batch get embeddings
   */
  static async getEmbeddings(
    texts: string[],
    model: string
  ): Promise<(number[] | null)[]> {
    const keys = texts.map(text => this.getEmbeddingKey(text, model))
    const cached = await caches.data.mget<Embedding>(keys)

    return cached.map(item => item?.vector || null)
  }

  /**
   * Cache with automatic retry and fallback
   */
  static async withCache<T>(
    key: string,
    generator: () => Promise<T>,
    options: {
      ttl?: number
      tags?: string[]
      forceRefresh?: boolean
    } = {}
  ): Promise<T> {
    if (!options.forceRefresh) {
      const cached = await caches.data.get<T>(key)
      if (cached !== null) {
        return cached
      }
    }

    try {
      const result = await generator()
      await caches.data.set(key, result, {
        ttl: options.ttl || AI_RESPONSE_TTL,
        tags: options.tags || ['ai'],
        staleWhileRevalidate: 300, // 5 minutes
      })
      return result
    } catch (error) {
      // Try to return stale data if available
      const stale = await caches.data.get<T>(key)
      if (stale !== null) {
        logger.warn('Returning stale AI cache due to error', { key, error })
        return stale
      }
      throw error
    }
  }

  /**
   * Invalidate all AI caches for a specific model
   */
  static async invalidateModel(model: string): Promise<void> {
    await caches.data.invalidateByTags([`ai:model:${model}`])
    logger.info('AI model cache invalidated', { model })
  }

  /**
   * Get cache statistics
   */
  static async getStats(): Promise<{
    responseCount: number
    embeddingCount: number
    totalSize: number
  }> {
    // This would need Redis SCAN implementation
    // Simplified version for now
    return {
      responseCount: 0,
      embeddingCount: 0,
      totalSize: 0,
    }
  }
}

// Convenience exports
export const aiCache = {
  getResponse: AICache.getResponse,
  setResponse: AICache.setResponse,
  getEmbedding: AICache.getEmbedding,
  setEmbedding: AICache.setEmbedding,
  withCache: AICache.withCache,
  invalidateModel: AICache.invalidateModel,
}