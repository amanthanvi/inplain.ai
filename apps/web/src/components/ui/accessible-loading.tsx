import * as React from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { ScreenReaderAnnouncer } from '@/lib/accessibility'

interface AccessibleLoadingProps {
  loading: boolean
  loadingText?: string
  children: React.ReactNode
  className?: string
  showSpinner?: boolean
  overlay?: boolean
}

export function AccessibleLoading({
  loading,
  loadingText = 'Loading...',
  children,
  className,
  showSpinner = true,
  overlay = false
}: AccessibleLoadingProps) {
  React.useEffect(() => {
    if (loading) {
      ScreenReaderAnnouncer.announce(loadingText, 'polite')
    } else {
      ScreenReaderAnnouncer.announce('Loading complete', 'polite')
    }
  }, [loading, loadingText])

  if (!loading) {
    return <>{children}</>
  }

  if (overlay) {
    return (
      <div className={cn('relative', className)}>
        <div aria-hidden="true" className="opacity-50">
          {children}
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/80"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          {showSpinner && (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          )}
          <span className="sr-only">{loadingText}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('flex flex-col items-center justify-center py-8', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {showSpinner && (
        <Loader2 className="h-6 w-6 animate-spin mb-2" aria-hidden="true" />
      )}
      <p className="text-sm text-muted-foreground">{loadingText}</p>
    </div>
  )
}

interface AccessibleSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  'aria-label'?: string
}

export function AccessibleSkeleton({
  className,
  'aria-label': ariaLabel = 'Loading content',
  ...props
}: AccessibleSkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-primary/10', className)}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      {...props}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  )
}

interface ProgressIndicatorProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  className?: string
}

export function AccessibleProgressIndicator({
  value,
  max = 100,
  label = 'Progress',
  showValue = true,
  className
}: ProgressIndicatorProps) {
  const percentage = Math.round((value / max) * 100)

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showValue) && (
        <div className="flex justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showValue && <span className="font-medium">{percentage}%</span>}
        </div>
      )}
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${percentage}%`}
      >
        <div
          className="h-full bg-primary transition-all duration-300 ease-in-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface LoadingStepsProps {
  steps: Array<{
    id: string
    label: string
    status: 'pending' | 'loading' | 'complete' | 'error'
  }>
  currentStep?: string
  className?: string
}

export function AccessibleLoadingSteps({
  steps,
  currentStep,
  className
}: LoadingStepsProps) {
  const currentStepIndex = steps.findIndex(step => step.id === currentStep)
  const completedSteps = steps.filter(step => step.status === 'complete').length
  const totalSteps = steps.length

  React.useEffect(() => {
    const currentStepData = steps.find(step => step.id === currentStep)
    if (currentStepData?.status === 'loading') {
      ScreenReaderAnnouncer.announce(
        `Processing step ${currentStepIndex + 1} of ${totalSteps}: ${currentStepData.label}`,
        'polite'
      )
    }
  }, [currentStep, currentStepIndex, totalSteps, steps])

  return (
    <div className={cn('space-y-4', className)}>
      <AccessibleProgressIndicator
        value={completedSteps}
        max={totalSteps}
        label="Overall progress"
      />
      
      <ol className="space-y-2" role="list">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              'flex items-center gap-3 text-sm',
              step.status === 'complete' && 'text-muted-foreground',
              step.status === 'error' && 'text-destructive'
            )}
          >
            <div
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                step.status === 'pending' && 'border-muted-foreground/50',
                step.status === 'loading' && 'border-primary animate-pulse',
                step.status === 'complete' && 'border-primary bg-primary text-primary-foreground',
                step.status === 'error' && 'border-destructive bg-destructive text-destructive-foreground'
              )}
              aria-hidden="true"
            >
              {step.status === 'complete' && '✓'}
              {step.status === 'error' && '✗'}
              {step.status === 'loading' && (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
              {step.status === 'pending' && (index + 1)}
            </div>
            
            <span
              className={cn(
                step.status === 'loading' && 'font-medium'
              )}
            >
              {step.label}
              {step.status === 'loading' && (
                <span className="sr-only"> (Processing)</span>
              )}
              {step.status === 'complete' && (
                <span className="sr-only"> (Complete)</span>
              )}
              {step.status === 'error' && (
                <span className="sr-only"> (Error)</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}