import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorViewProps {
  message: string
  onRetry?: () => void
}

export function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <div className="flex items-center justify-center h-[400px]">
      <div className="text-center space-y-4 p-6">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <div>
          <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}