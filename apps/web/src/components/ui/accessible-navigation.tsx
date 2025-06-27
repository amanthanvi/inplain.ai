'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { focusRingStyles, useKeyboardNavigation } from '@/lib/accessibility'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavigationItem {
  label: string
  href: string
  icon?: React.ReactNode
  badge?: string | number
  disabled?: boolean
}

interface AccessibleNavigationProps {
  items: NavigationItem[]
  orientation?: 'horizontal' | 'vertical'
  className?: string
  'aria-label'?: string
}

export function AccessibleNavigation({
  items,
  orientation = 'horizontal',
  className,
  'aria-label': ariaLabel = 'Main navigation',
  ...props
}: AccessibleNavigationProps) {
  const pathname = usePathname()
  const [focusedIndex, setFocusedIndex] = React.useState(-1)
  
  const handleSelect = React.useCallback((item: NavigationItem) => {
    if (!item.disabled && item.href) {
      // Navigate to the item
      window.location.href = item.href
    }
  }, [])
  
  const selectedIndex = useKeyboardNavigation(
    items.filter(item => !item.disabled),
    handleSelect,
    {
      vertical: orientation === 'vertical',
      wrap: true
    }
  )
  
  return (
    <nav
      role="navigation"
      aria-label={ariaLabel}
      className={cn(
        'relative',
        orientation === 'horizontal' ? 'flex items-center space-x-1' : 'flex flex-col space-y-1',
        className
      )}
      {...props}
    >
      <ul
        role="list"
        className={cn(
          'flex',
          orientation === 'horizontal' ? 'flex-row items-center space-x-1' : 'flex-col space-y-1'
        )}
      >
        {items.map((item, index) => {
          const isActive = pathname === item.href
          const isFocused = focusedIndex === index
          const isKeyboardSelected = selectedIndex === index
          
          return (
            <li key={item.href} role="none">
              <Link
                href={item.href}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  focusRingStyles.default,
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground',
                  item.disabled && 'pointer-events-none opacity-50',
                  isKeyboardSelected && 'ring-2 ring-primary ring-offset-2'
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={item.disabled}
                tabIndex={item.disabled ? -1 : 0}
                onFocus={() => setFocusedIndex(index)}
                onBlur={() => setFocusedIndex(-1)}
              >
                {item.icon && (
                  <span className="mr-2" aria-hidden="true">
                    {item.icon}
                  </span>
                )}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
                    aria-label={`${item.badge} items`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

interface BreadcrumbItem {
  label: string
  href?: string
}

interface AccessibleBreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function AccessibleBreadcrumbs({
  items,
  className,
  ...props
}: AccessibleBreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center text-sm', className)}
      {...props}
    >
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          
          return (
            <li key={index} className="flex items-center">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className={cn(
                    'text-muted-foreground hover:text-foreground transition-colors',
                    focusRingStyles.default,
                    'rounded px-1'
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="text-foreground px-1"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              
              {!isLast && (
                <span
                  className="mx-2 text-muted-foreground"
                  aria-hidden="true"
                >
                  /
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

interface TabItem {
  id: string
  label: string
  content: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
}

interface AccessibleTabsProps {
  items: TabItem[]
  defaultTab?: string
  className?: string
  onChange?: (tabId: string) => void
}

export function AccessibleTabs({
  items,
  defaultTab,
  className,
  onChange,
  ...props
}: AccessibleTabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultTab || items[0]?.id || '')
  
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    onChange?.(tabId)
  }
  
  const activeItem = items.find(item => item.id === activeTab)
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = items.findIndex(item => item.id === activeTab)
    let newIndex = currentIndex
    
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        newIndex = currentIndex - 1
        if (newIndex < 0) newIndex = items.length - 1
        break
        
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        newIndex = currentIndex + 1
        if (newIndex >= items.length) newIndex = 0
        break
        
      case 'Home':
        e.preventDefault()
        newIndex = 0
        break
        
      case 'End':
        e.preventDefault()
        newIndex = items.length - 1
        break
    }
    
    if (newIndex !== currentIndex && !items[newIndex]?.disabled) {
      handleTabChange(items[newIndex]!.id)
    }
  }
  
  return (
    <div className={cn('w-full', className)} {...props}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground"
        onKeyDown={handleKeyDown}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={activeTab === item.id}
            aria-controls={`tabpanel-${item.id}`}
            aria-disabled={item.disabled}
            tabIndex={activeTab === item.id ? 0 : -1}
            disabled={item.disabled}
            onClick={() => handleTabChange(item.id)}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all',
              focusRingStyles.default,
              'disabled:pointer-events-none disabled:opacity-50',
              activeTab === item.id
                ? 'bg-background text-foreground shadow'
                : 'hover:bg-background/50'
            )}
          >
            {item.icon && (
              <span className="mr-2" aria-hidden="true">
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        ))}
      </div>
      
      <div className="mt-4">
        {items.map(item => (
          <div
            key={item.id}
            role="tabpanel"
            id={`tabpanel-${item.id}`}
            aria-labelledby={`tab-${item.id}`}
            hidden={activeTab !== item.id}
            tabIndex={0}
            className={focusRingStyles.default}
          >
            {activeTab === item.id && item.content}
          </div>
        ))}
      </div>
    </div>
  )
}