/**
 * Production-ready KV wrapper for Vercel Edge Runtime
 * This implementation follows Vercel's recommended patterns
 */

import { kv } from '@vercel/kv'
import { getKVConfig } from './get-kv-config'

// Check if KV is properly configured
export function isKVConfigured(): boolean {
  const { kvUrl, kvToken } = getKVConfig()
  return !!(kvUrl && kvToken)
}

// Export the kv instance directly
// Vercel automatically configures this when KV is added to the project
export { kv }

// For backward compatibility
export function getKV() {
  if (!isKVConfigured()) {
    console.warn('KV is not configured. Make sure KV_REST_API_URL and KV_REST_API_TOKEN are set.')
  }
  return kv
}

export function getKVConfigError(): string | null {
  if (!isKVConfigured()) {
    return 'KV_REST_API_URL and/or KV_REST_API_TOKEN environment variables are not set'
  }
  return null
}