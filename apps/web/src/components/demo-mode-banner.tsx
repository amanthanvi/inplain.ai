'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DemoModeBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkStatus() {
      try {
        // Fetch the actual app status from the server
        const response = await fetch('/api/status')
        if (response.ok) {
          const data = await response.json()
          const isDemo = data.mode === 'demo'
          
          // Check if user has dismissed the banner
          const dismissed = localStorage.getItem('demo-banner-dismissed')
          
          setIsVisible(isDemo && !dismissed)
        }
      } catch (error) {
        console.error('Failed to check app status:', error)
        // Default to not showing the banner on error
        setIsVisible(false)
      } finally {
        setIsLoading(false)
      }
    }
    
    checkStatus()
  }, [])

  const handleDismiss = () => {
    setIsDismissed(true)
    localStorage.setItem('demo-banner-dismissed', 'true')
    setTimeout(() => setIsVisible(false), 300)
  }

  if (isLoading || !isVisible) return null

  return (
    <div 
      className={`fixed bottom-4 right-4 max-w-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg shadow-lg p-4 transition-all duration-300 ${
        isDismissed ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
            Demo Mode Active
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
            You're viewing Inplain.AI in demo mode. AI analysis features are simulated. 
            To enable full functionality, configure your OpenRouter API key.
          </p>
          <div className="flex items-center gap-2">
            <a 
              href="https://github.com/yourusername/policydiff#setup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-yellow-700 dark:text-yellow-400 hover:underline"
            >
              Setup Guide →
            </a>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}