import * as React from 'react'
import { cn } from '@/lib/utils'
import { focusRingStyles, AriaHelpers } from '@/lib/accessibility'
import { AlertCircle, CheckCircle, Info } from 'lucide-react'

interface FormFieldProps {
  label: string
  error?: string
  success?: string
  info?: string
  required?: boolean
  children: React.ReactElement
  className?: string
}

export function FormField({
  label,
  error,
  success,
  info,
  required = false,
  children,
  className
}: FormFieldProps) {
  const id = AriaHelpers.generateId('form-field')
  const errorId = error ? `${id}-error` : undefined
  const successId = success ? `${id}-success` : undefined
  const infoId = info ? `${id}-info` : undefined
  
  const ariaDescribedBy = [errorId, successId, infoId]
    .filter(Boolean)
    .join(' ') || undefined
  
  const childWithProps = React.cloneElement(children, {
    id,
    'aria-invalid': !!error,
    'aria-describedby': ariaDescribedBy,
    'aria-required': required,
    className: cn(
      children.props.className,
      focusRingStyles.default,
      error && 'border-destructive focus-visible:ring-destructive'
    )
  })
  
  return (
    <div className={cn('space-y-2', className)}>
      <label
        htmlFor={id}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      
      {childWithProps}
      
      {error && (
        <p id={errorId} className="text-sm text-destructive flex items-center gap-1" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {error}
        </p>
      )}
      
      {success && (
        <p id={successId} className="text-sm text-green-600 flex items-center gap-1">
          <CheckCircle className="h-4 w-4" aria-hidden="true" />
          {success}
        </p>
      )}
      
      {info && (
        <p id={infoId} className="text-sm text-muted-foreground flex items-center gap-1">
          <Info className="h-4 w-4" aria-hidden="true" />
          {info}
        </p>
      )}
    </div>
  )
}

interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  success?: string
  info?: string
}

export const AccessibleInput = React.forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({ label, error, success, info, required, className, ...props }, ref) => {
    if (label) {
      return (
        <FormField
          label={label}
          error={error}
          success={success}
          info={info}
          required={required}
        >
          <input
            ref={ref}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            {...props}
          />
        </FormField>
      )
    }
    
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          focusRingStyles.default,
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        aria-invalid={!!error}
        aria-required={required}
        {...props}
      />
    )
  }
)
AccessibleInput.displayName = 'AccessibleInput'

interface AccessibleTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  success?: string
  info?: string
}

export const AccessibleTextarea = React.forwardRef<HTMLTextAreaElement, AccessibleTextareaProps>(
  ({ label, error, success, info, required, className, ...props }, ref) => {
    if (label) {
      return (
        <FormField
          label={label}
          error={error}
          success={success}
          info={info}
          required={required}
        >
          <textarea
            ref={ref}
            className={cn(
              "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            {...props}
          />
        </FormField>
      )
    }
    
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          focusRingStyles.default,
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        aria-invalid={!!error}
        aria-required={required}
        {...props}
      />
    )
  }
)
AccessibleTextarea.displayName = 'AccessibleTextarea'

interface AccessibleSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  success?: string
  info?: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
}

export const AccessibleSelect = React.forwardRef<HTMLSelectElement, AccessibleSelectProps>(
  ({ label, error, success, info, required, className, options, ...props }, ref) => {
    const selectElement = (
      <select
        ref={ref}
        className={cn(
          "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
          focusRingStyles.default,
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        aria-invalid={!!error}
        aria-required={required}
        {...props}
      >
        {options.map(option => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    )
    
    if (label) {
      return (
        <FormField
          label={label}
          error={error}
          success={success}
          info={info}
          required={required}
        >
          {selectElement}
        </FormField>
      )
    }
    
    return selectElement
  }
)
AccessibleSelect.displayName = 'AccessibleSelect'

interface AccessibleCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  info?: string
}

export const AccessibleCheckbox = React.forwardRef<HTMLInputElement, AccessibleCheckboxProps>(
  ({ label, error, info, className, ...props }, ref) => {
    const id = AriaHelpers.generateId('checkbox')
    const errorId = error ? `${id}-error` : undefined
    const infoId = info ? `${id}-info` : undefined
    const ariaDescribedBy = [errorId, infoId].filter(Boolean).join(' ') || undefined
    
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center space-x-2">
          <input
            ref={ref}
            type="checkbox"
            id={id}
            className={cn(
              "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow transition-colors",
              focusRingStyles.default,
              "disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
              error && 'border-destructive focus-visible:ring-destructive'
            )}
            aria-invalid={!!error}
            aria-describedby={ariaDescribedBy}
            {...props}
          />
          <label
            htmlFor={id}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        </div>
        
        {error && (
          <p id={errorId} className="text-sm text-destructive flex items-center gap-1" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {error}
          </p>
        )}
        
        {info && (
          <p id={infoId} className="text-sm text-muted-foreground flex items-center gap-1">
            <Info className="h-4 w-4" aria-hidden="true" />
            {info}
          </p>
        )}
      </div>
    )
  }
)
AccessibleCheckbox.displayName = 'AccessibleCheckbox'