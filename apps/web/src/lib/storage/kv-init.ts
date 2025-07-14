/**
 * KV Initialization Helper
 * Ensures proper loading of KV credentials in all environments
 */

import { createClient } from '@vercel/kv'

export function getKVClient() {
  // Try multiple ways to get KV credentials for better compatibility
  const kvUrl = process.env.KV_REST_API_URL || process.env.KV_URL
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN
  
  if (!kvUrl || !kvToken) {
    console.warn('KV not configured - missing credentials', {
      hasUrl: !!kvUrl,
      hasToken: !!kvToken,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV
    })
    return null
  }
  
  try {
    // Use the Vercel KV client with explicit configuration
    const client = createClient({
      url: kvUrl,
      token: kvToken
    })
    
    console.log('KV client initialized successfully')
    return client
  } catch (error) {
    console.error('Failed to initialize KV client:', error)
    return null
  }
}

// Export singleton instance
let kvInstance: ReturnType<typeof createClient> | null = null

export function getKV() {
  if (!kvInstance) {
    kvInstance = getKVClient()
  }
  return kvInstance
}