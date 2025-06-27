'use client'

import React from 'react'

export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="absolute top-0 left-0 z-[100] bg-primary text-primary-foreground px-4 py-2 focus:underline"
      >
        Skip to main content
      </a>
      <a
        href="#main-navigation"
        className="absolute top-0 left-0 z-[100] bg-primary text-primary-foreground px-4 py-2 focus:underline"
      >
        Skip to navigation
      </a>
    </div>
  )
}