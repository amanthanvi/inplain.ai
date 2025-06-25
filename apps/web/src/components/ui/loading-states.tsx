'use client'

import { Loader2, FileText, Brain, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

export function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
      {label && (
        <p className="text-sm text-muted-foreground animate-pulse">{label}</p>
      )}
    </div>
  )
}

export function PolicyLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-5/6" />
      <div className="h-4 bg-muted rounded w-4/5" />
      <div className="space-y-2 mt-6">
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-11/12" />
        <div className="h-3 bg-muted rounded w-10/12" />
      </div>
    </div>
  )
}

export function CompanyCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2 flex-1">
          <div className="h-6 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
        <div className="h-6 w-16 bg-muted rounded-full" />
      </div>
      <div className="h-8 bg-muted rounded w-24" />
    </div>
  )
}

export function AnalysisLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative">
        <Brain className="h-12 w-12 text-muted-foreground" />
        <Sparkles className="h-6 w-6 text-primary absolute -top-1 -right-1 animate-pulse" />
      </div>
      <div className="space-y-2 text-center">
        <p className="text-lg font-medium">Analyzing policy changes...</p>
        <p className="text-sm text-muted-foreground">This may take a few moments</p>
      </div>
      <div className="flex gap-2">
        <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
      </div>
    </div>
  )
}

export function TableLoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-4 p-4 border-b">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-4 bg-muted rounded animate-pulse" />
        ))}
      </div>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="grid grid-cols-4 gap-4 p-4 border-b">
          {[...Array(4)].map((_, j) => (
            <div 
              key={j} 
              className="h-4 bg-muted rounded animate-pulse"
              style={{ 
                animationDelay: `${(i * 4 + j) * 50}ms`,
                width: `${Math.random() * 40 + 60}%` 
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ContentPlaceholder({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(lines)].map((_, i) => (
        <div
          key={i}
          className="h-4 bg-muted rounded animate-pulse"
          style={{ 
            animationDelay: `${i * 100}ms`,
            width: `${Math.random() * 20 + 80}%` 
          }}
        />
      ))}
    </div>
  )
}

interface LoadingOverlayProps {
  isLoading: boolean
  children: React.ReactNode
  label?: string
}

export function LoadingOverlay({ isLoading, children, label }: LoadingOverlayProps) {
  if (!isLoading) return <>{children}</>
  
  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <LoadingSpinner label={label} />
      </div>
    </div>
  )
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {children}
    </div>
  )
}

export function StaggeredList({ 
  children, 
  delay = 100 
}: { 
  children: React.ReactNode[]
  delay?: number 
}) {
  return (
    <>
      {children.map((child, i) => (
        <div
          key={i}
          className="animate-in fade-in-0 slide-in-from-left-4"
          style={{ animationDelay: `${i * delay}ms` }}
        >
          {child}
        </div>
      ))}
    </>
  )
}