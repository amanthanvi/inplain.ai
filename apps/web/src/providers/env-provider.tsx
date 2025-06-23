'use client'

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react'
import { getPublicConfig } from '@/lib/env'

type AppMode = 'production' | 'demo' | 'development'

interface EnvContextType {
  mode: AppMode
  apiUrl: string
  appUrl: string
  isDevelopment: boolean
  isProduction: boolean
  isDemo: boolean
  isVercel: boolean
  isLoading: boolean
}

const EnvContext = createContext<EnvContextType | undefined>(undefined)

export function EnvProvider({ children }: { children: ReactNode }) {
  const config = getPublicConfig()
  const [mode, setMode] = useState<AppMode>(config.mode)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    // Fetch the actual mode from the server
    async function fetchMode() {
      try {
        const response = await fetch('/api/status')
        if (response.ok) {
          const data = await response.json()
          setMode(data.mode)
        }
      } catch (error) {
        console.error('Failed to fetch app mode:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchMode()
  }, [])
  
  const value: EnvContextType = {
    ...config,
    mode,
    isDemo: mode === 'demo',
    isProduction: mode === 'production',
    isDevelopment: mode === 'development',
    isLoading
  }
  
  return (
    <EnvContext.Provider value={value}>
      {children}
    </EnvContext.Provider>
  )
}

export function useEnvironment() {
  const context = useContext(EnvContext)
  if (context === undefined) {
    throw new Error('useEnvironment must be used within an EnvProvider')
  }
  return context
}

/**
 * Component to display environment mode in development
 */
export function EnvIndicator() {
  const env = useEnvironment()
  
  if (!env.isDevelopment) return null
  
  return (
    <div className="fixed bottom-4 left-4 z-50 bg-gray-900 text-white px-3 py-1 rounded-md text-xs font-mono">
      {env.mode} mode
    </div>
  )
}