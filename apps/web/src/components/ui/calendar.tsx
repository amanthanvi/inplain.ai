'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface CalendarProps {
  mode?: 'single' | 'range'
  selected?: Date | { from?: Date; to?: Date } | undefined
  onSelect?: (date: Date | { from?: Date; to?: Date } | undefined) => void
  className?: string
  numberOfMonths?: number
  disabled?: (date: Date) => boolean
  initialFocus?: boolean
}

// Simple date range picker fallback
function Calendar({
  mode = 'single',
  selected,
  onSelect,
  className,
  numberOfMonths = 1,
  disabled,
  initialFocus,
  ...props
}: CalendarProps) {
  const handleDateChange = (type: 'from' | 'to', value: string) => {
    if (!onSelect) return
    
    const date = value ? new Date(value) : undefined
    
    if (mode === 'single') {
      onSelect(date)
    } else if (mode === 'range') {
      const currentRange = (selected as { from?: Date; to?: Date }) || {}
      onSelect({
        ...currentRange,
        [type]: date
      })
    }
  }

  const formatDateForInput = (date: Date | undefined) => {
    if (!date) return ''
    return date.toISOString().split('T')[0]
  }

  if (mode === 'range') {
    const rangeValue = selected as { from?: Date; to?: Date } | undefined
    return (
      <div className={cn('space-y-4 p-3', className)} {...props}>
        <div className="space-y-2">
          <Label htmlFor="date-from">From</Label>
          <Input
            id="date-from"
            type="date"
            value={formatDateForInput(rangeValue?.from)}
            onChange={(e) => handleDateChange('from', e.target.value)}
            autoFocus={initialFocus}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date-to">To</Label>
          <Input
            id="date-to"
            type="date"
            value={formatDateForInput(rangeValue?.to)}
            onChange={(e) => handleDateChange('to', e.target.value)}
            min={rangeValue?.from ? formatDateForInput(rangeValue.from) : undefined}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('p-3', className)} {...props}>
      <Input
        type="date"
        value={formatDateForInput(selected as Date | undefined)}
        onChange={(e) => handleDateChange('from', e.target.value)}
        autoFocus={initialFocus}
      />
    </div>
  )
}

Calendar.displayName = 'Calendar'

export { Calendar }