import React, { useState } from 'react'
import { Key, ExternalLink } from 'lucide-react'
import { StorageManager } from '../lib/storage'

interface SetupViewProps {
  onApiKeySaved: () => void
}

export function SetupView({ onApiKeySaved }: SetupViewProps) {
  const [apiKey, setApiKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const storage = new StorageManager()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!apiKey.trim()) {
      setError('Please enter an API key')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Save API key
      await storage.setAPIKey(apiKey.trim())
      
      // Test connection
      const isValid = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' })
      
      if (isValid) {
        onApiKeySaved()
      } else {
        setError('Invalid API key. Please check and try again.')
        await storage.setAPIKey('') // Clear invalid key
      }
    } catch (err) {
      setError('Failed to save API key. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Key className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Welcome to InPlain.AI</h2>
        <p className="text-sm text-muted-foreground">
          Enter your API key to start monitoring privacy policies
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium mb-2">
            API Key
          </label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Verifying...' : 'Save API Key'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t">
        <p className="text-sm text-muted-foreground mb-3">
          Don't have an API key?
        </p>
        <a
          href="https://inplain.ai/settings"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          Get your API key
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}