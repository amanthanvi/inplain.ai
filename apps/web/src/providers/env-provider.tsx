'use client'

import React, { createContext, useContext, ReactNode } from 'react'
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
}

const EnvContext = createContext<EnvContextType | undefined>(undefined)

export function EnvProvider({ children }: { children: ReactNode }) {
  const config = getPublicConfig()
  
  const value: EnvContextType = {
    ...config,
    isDemo: config.mode === 'demo',
    isProduction: config.mode === 'production',
    isDevelopment: config.mode === 'development'
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