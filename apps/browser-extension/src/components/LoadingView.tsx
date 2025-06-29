import React from 'react'

export function LoadingView() {
  return (
    <div className="flex items-center justify-center h-[400px]">
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading privacy information...</p>
      </div>
    </div>
  )
}