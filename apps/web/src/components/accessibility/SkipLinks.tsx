'use client'

import React from 'react'
import { cn } from '@/lib/utils'

const skipLinks = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#navigation', label: 'Skip to navigation' },
  { href: '#search', label: 'Skip to search' },
  { href: '#footer', label: 'Skip to footer' },
]

export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:top-0 focus-within:left-0 focus-within:z-50 focus-within:p-2">
      <nav aria-label="Skip links" className="bg-background border rounded-md shadow-lg p-2">
        <ul className="space-y-1">
          {skipLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={cn(
                  "inline-block px-4 py-2 text-sm font-medium rounded-md",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
                  "transition-colors"
                )}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}