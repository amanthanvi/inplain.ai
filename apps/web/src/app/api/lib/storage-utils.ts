import { StorageClient } from './storage'
import { UnifiedStorageClient, unifiedStorageClient } from './unified-storage-client'
import { getEnvVar } from '@/lib/env'

let storage: StorageClient | null = null
let unifiedStorage: UnifiedStorageClient | null = null

/**
 * Get storage client (legacy - will be deprecated)
 * @deprecated Use getUnifiedStorage() instead
 */
export function getStorage(): StorageClient | null {
  if (storage) return storage
  
  // Check if KV is configured
  const kvUrl = getEnvVar('KV_REST_API_URL')
  const kvToken = getEnvVar('KV_REST_API_TOKEN')
  
  if (!kvUrl || !kvToken) {
    console.warn('KV storage not configured')
    return null
  }
  
  try {
    storage = new StorageClient()
    return storage
  } catch (error) {
    console.error('Failed to initialize storage client:', error)
    return null
  }
}

/**
 * Get unified storage client (recommended)
 */
export function getUnifiedStorage(): UnifiedStorageClient | null {
  if (unifiedStorage) return unifiedStorage
  
  // Check if KV is configured
  const kvUrl = getEnvVar('KV_REST_API_URL')
  const kvToken = getEnvVar('KV_REST_API_TOKEN')
  
  if (!kvUrl || !kvToken) {
    console.warn('KV storage not configured - using in-memory fallback')
    // The unified storage client will use the KV wrapper which has in-memory fallback
  }
  
  unifiedStorage = unifiedStorageClient
  return unifiedStorage
}