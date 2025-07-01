/**
 * Unified Hash Utility for Inplain.AI
 * 
 * Provides consistent hash functions across different runtime environments
 * with proper security considerations for different use cases.
 */

export class HashUtils {
  /**
   * Secure SHA-256 hash for cryptographic purposes
   * Uses Web Crypto API (Edge runtime compatible)
   */
  static async secureSHA256(data: string): Promise<string> {
    // Web Crypto API (Edge runtime compatible)
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('Web Crypto API not available')
    }
    
    try {
      const encoder = new TextEncoder()
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
      const hashArray = new Uint8Array(hashBuffer)
      return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
      console.error('HashUtils.secureSHA256 failed:', error)
      throw new Error('Failed to generate secure hash')
    }
  }

  /**
   * Fast non-cryptographic hash for performance-critical operations
   * Only use for cache keys and non-security critical fingerprinting
   */
  static fastHash(data: string): string {
    // djb2 hash algorithm - better distribution than simple bit shifting
    let hash = 5381
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) + hash) + data.charCodeAt(i)
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * Content hash for deduplication and integrity
   * Uses secure hash to prevent collision attacks
   */
  static async hashContent(content: string): Promise<string> {
    return this.secureSHA256(content)
  }

  /**
   * API key hashing for authentication
   */
  static async hashAPIKey(apiKey: string): Promise<string> {
    return this.secureSHA256(apiKey)
  }

  /**
   * Generate cache key with optional namespace
   * Uses fast hash for performance
   */
  static generateCacheKey(data: string, namespace?: string): string {
    const hash = this.fastHash(data)
    return namespace ? `${namespace}:${hash}` : hash
  }

  /**
   * Verify content integrity
   */
  static async verifyContentHash(content: string, expectedHash: string): Promise<boolean> {
    try {
      const actualHash = await this.hashContent(content)
      return actualHash === expectedHash
    } catch {
      return false
    }
  }

  /**
   * Generate secure random string for tokens
   */
  static async generateSecureToken(length: number = 32): Promise<string> {
    // Use Web Crypto API which is available in both browser and Edge runtime
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(length)
      crypto.getRandomValues(array)
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
    }
    
    // Fallback for environments without crypto
    // This should rarely happen in modern environments
    throw new Error('Crypto API not available. Cannot generate secure token.')
  }

  /**
   * Hash with salt for additional security
   */
  static async hashWithSalt(data: string, salt: string): Promise<string> {
    return this.secureSHA256(data + salt)
  }
}

// Legacy compatibility - to be deprecated
export async function createContentHash(content: string): Promise<string> {
  console.warn('createContentHash is deprecated. Use HashUtils.hashContent() instead.')
  return HashUtils.hashContent(content)
}

export function createSimpleHash(content: string): string {
  console.warn('createSimpleHash is deprecated and insecure. Use HashUtils.fastHash() for cache keys or HashUtils.hashContent() for security.')
  return HashUtils.fastHash(content)
}