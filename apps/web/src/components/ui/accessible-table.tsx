import * as React from 'react'
import { cn } from '@/lib/utils'
import { focusRingStyles, ScreenReaderAnnouncer } from '@/lib/accessibility'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

interface Column<T> {
  id: string
  header: string
  accessorKey: keyof T
  cell?: (value: any, row: T) => React.ReactNode
  sortable?: boolean
  className?: string
}

interface AccessibleTableProps<T> {
  data: T[]
  columns: Column<T>[]
  caption?: string
  className?: string
  onRowClick?: (row: T, index: number) => void
  rowKeyAccessor: keyof T
  'aria-label'?: string
  sortable?: boolean
}

export function AccessibleTable<T extends Record<string, any>>({
  data,
  columns,
  caption,
  className,
  onRowClick,
  rowKeyAccessor,
  'aria-label': ariaLabel,
  sortable = false,
  ...props
}: AccessibleTableProps<T>) {
  const [sortConfig, setSortConfig] = React.useState<{
    key: keyof T | null
    direction: 'asc' | 'desc'
  }>({ key: null, direction: 'asc' })
  
  const [focusedCell, setFocusedCell] = React.useState<{
    row: number
    col: number
  }>({ row: -1, col: -1 })
  
  const handleSort = (key: keyof T) => {
    let direction: 'asc' | 'desc' = 'asc'
    
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    
    setSortConfig({ key, direction })
    
    ScreenReaderAnnouncer.announce(
      `Table sorted by ${String(key)} in ${direction === 'asc' ? 'ascending' : 'descending'} order`,
      'polite'
    )
  }
  
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return data
    
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key!]
      const bValue = b[sortConfig.key!]
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [data, sortConfig])
  
  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    let newRow = rowIndex
    let newCol = colIndex
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        newRow = Math.max(0, rowIndex - 1)
        break
        
      case 'ArrowDown':
        e.preventDefault()
        newRow = Math.min(sortedData.length - 1, rowIndex + 1)
        break
        
      case 'ArrowLeft':
        e.preventDefault()
        newCol = Math.max(0, colIndex - 1)
        break
        
      case 'ArrowRight':
        e.preventDefault()
        newCol = Math.min(columns.length - 1, colIndex + 1)
        break
        
      case 'Home':
        e.preventDefault()
        if (e.ctrlKey) {
          newRow = 0
          newCol = 0
        } else {
          newCol = 0
        }
        break
        
      case 'End':
        e.preventDefault()
        if (e.ctrlKey) {
          newRow = sortedData.length - 1
          newCol = columns.length - 1
        } else {
          newCol = columns.length - 1
        }
        break
        
      case 'Enter':
      case ' ':
        if (onRowClick && rowIndex >= 0 && sortedData[rowIndex]) {
          e.preventDefault()
          onRowClick(sortedData[rowIndex], rowIndex)
        }
        break
    }
    
    if (newRow !== rowIndex || newCol !== colIndex) {
      setFocusedCell({ row: newRow, col: newCol })
      const cellId = `cell-${newRow}-${newCol}`
      document.getElementById(cellId)?.focus()
    }
  }
  
  return (
    <div className={cn('w-full overflow-auto', className)} {...props}>
      <table
        className="w-full caption-bottom text-sm"
        role="table"
        aria-label={ariaLabel || 'Data table'}
        aria-rowcount={sortedData.length}
        aria-colcount={columns.length}
      >
        {caption && (
          <caption className="mt-4 text-sm text-muted-foreground">
            {caption}
          </caption>
        )}
        
        <thead className="[&_tr]:border-b">
          <tr className="border-b transition-colors hover:bg-muted/50">
            {columns.map((column, colIndex) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  'h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
                  column.className
                )}
                aria-sort={
                  sortConfig.key === column.accessorKey
                    ? sortConfig.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                {sortable && column.sortable !== false ? (
                  <button
                    className={cn(
                      'inline-flex items-center justify-start w-full text-left',
                      focusRingStyles.default,
                      'rounded px-1 -mx-1'
                    )}
                    onClick={() => handleSort(column.accessorKey)}
                    aria-label={`Sort by ${column.header}`}
                  >
                    {column.header}
                    <span className="ml-2" aria-hidden="true">
                      {sortConfig.key === column.accessorKey ? (
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : (
                          <ArrowDown className="h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </span>
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        
        <tbody className="[&_tr:last-child]:border-0">
          {sortedData.map((row, rowIndex) => (
            <tr
              key={String(row[rowKeyAccessor])}
              className={cn(
                'border-b transition-colors hover:bg-muted/50',
                onRowClick && 'cursor-pointer'
              )}
              onClick={() => onRowClick?.(row, rowIndex)}
              tabIndex={-1}
            >
              {columns.map((column, colIndex) => {
                const value = row[column.accessorKey]
                const cellContent = column.cell ? column.cell(value, row) : value
                const cellId = `cell-${rowIndex}-${colIndex}`
                const isFocused = focusedCell.row === rowIndex && focusedCell.col === colIndex
                
                return (
                  <td
                    key={column.id}
                    id={cellId}
                    className={cn(
                      'p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
                      column.className
                    )}
                    tabIndex={isFocused ? 0 : -1}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                    onFocus={() => setFocusedCell({ row: rowIndex, col: colIndex })}
                  >
                    {cellContent}
                  </td>
                )
              })}
            </tr>
          ))}
          
          {sortedData.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

interface SummaryItem {
  label: string
  value: string | number
}

interface AccessibleTableSummaryProps {
  items: SummaryItem[]
  className?: string
}

export function AccessibleTableSummary({
  items,
  className,
  ...props
}: AccessibleTableSummaryProps) {
  return (
    <div
      className={cn('flex items-center gap-4 text-sm text-muted-foreground', className)}
      role="status"
      aria-live="polite"
      {...props}
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <span>{item.label}:</span>
          <strong className="font-medium text-foreground">{item.value}</strong>
        </div>
      ))}
    </div>
  )
}