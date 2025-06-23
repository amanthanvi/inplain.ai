'use client'

import { useEffect, useState } from 'react'
import { getPublicConfig } from '@/lib/env'

/**
 * Hook to access environment configuration in React components
 * Only exposes client-safe environment information
 */
export function useEnv() {
  const [config, setConfig] = useState(getPublicConfig())
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    // Fetch the actual mode from the server
    async function fetchMode() {
      try {
        const response = await fetch('/api/status')
        if (response.ok) {
          const data = await response.json()
          setConfig(prev => ({ ...prev, mode: data.mode }))
        }
      } catch (error) {
        console.error('Failed to fetch app mode:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchMode()
  }, [])
  
  return {
    ...config,
    isDemo: config.mode === 'demo',
    isProduction: config.mode === 'production',
    isDevelopment: config.mode === 'development',
    isLoading
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