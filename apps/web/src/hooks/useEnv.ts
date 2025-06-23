'use client'

import { useEffect, useState } from 'react'
import { getPublicConfig } from '@/lib/env'

/**
 * Hook to access environment configuration in React components
 * Only exposes client-safe environment information
 */
export function useEnv() {
  const [config, setConfig] = useState(getPublicConfig())
  
  useEffect(() => {
    // Re-read config in case it changes (shouldn't happen in practice)
    setConfig(getPublicConfig())
  }, [])
  
  return {
    ...config,
    isDemo: config.mode === 'demo',
    isProduction: config.mode === 'production',
    isDevelopment: config.mode === 'development'
  }
}

/**
 * Hook to check environment status from server
 * Useful for admin panels and debugging
 */
export function useEnvStatus() {
  const [status, setStatus] = useState<{
    loading: boolean
    error: string | null
    data: any | null
  }>({
    loading: true,
    error: null,
    data: null
  })
  
  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch('/api/debug')
        if (!response.ok) {
          if (response.status === 401) {
            setStatus({
              loading: false,
              error: null,
              data: { protected: true }
            })
          } else {
            throw new Error(`HTTP ${response.status}`)
          }
        } else {
          const data = await response.json()
          setStatus({
            loading: false,
            error: null,
            data
          })
        }
      } catch (error) {
        setStatus({
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: null
        })
      }
    }
    
    checkStatus()
  }, [])
  
  return status
}