import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronRight } from 'lucide-react'

interface MobileCardProps {
  title: string
  description?: string
  icon?: React.ReactNode
  onClick?: () => void
  href?: string
  children?: React.ReactNode
  className?: string
  interactive?: boolean
}

export function MobileCard({
  title,
  description,
  icon,
  onClick,
  href,
  children,
  className,
  interactive = true
}: MobileCardProps) {
  const Component = href ? 'a' : onClick ? 'button' : 'div'
  
  const content = (
    <Card className={cn(
      "overflow-hidden",
      interactive && "active:scale-[0.98] transition-transform",
      className
    )}>
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {icon && (
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base line-clamp-1">{title}</CardTitle>
              {description && (
                <CardDescription className="text-sm line-clamp-2 mt-0.5">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          {(onClick || href) && (
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          )}
        </div>
      </CardHeader>
      {children && (
        <CardContent className="p-4 pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    )
  }

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="block w-full text-left"
      >
        {content}
      </button>
    )
  }

  return content
}

// Swipeable card variant
interface SwipeableCardProps extends MobileCardProps {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  leftAction?: { label: string; icon: React.ReactNode; color: string }
  rightAction?: { label: string; icon: React.ReactNode; color: string }
}

export function SwipeableCard({
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  ...props
}: SwipeableCardProps) {
  const [dragX, setDragX] = React.useState(0)

  return (
    <div className="relative overflow-hidden">
      {/* Background actions */}
      {leftAction && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center px-4",
            leftAction.color
          )}
          style={{
            opacity: Math.min(Math.abs(dragX) / 100, 1),
            width: Math.abs(dragX)
          }}
        >
          {leftAction.icon}
          <span className="ml-2 text-sm font-medium whitespace-nowrap">
            {leftAction.label}
          </span>
        </div>
      )}
      
      {rightAction && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end px-4",
            rightAction.color
          )}
          style={{
            opacity: Math.min(Math.abs(dragX) / 100, 1),
            width: Math.abs(dragX)
          }}
        >
          <span className="mr-2 text-sm font-medium whitespace-nowrap">
            {rightAction.label}
          </span>
          {rightAction.icon}
        </div>
      )}

      {/* Draggable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.2}
        onDrag={(e, info) => setDragX(info.offset.x)}
        onDragEnd={(e, info) => {
          if (info.offset.x > 80 && onSwipeRight) {
            onSwipeRight()
          } else if (info.offset.x < -80 && onSwipeLeft) {
            onSwipeLeft()
          }
          setDragX(0)
        }}
        animate={{ x: 0 }}
        style={{ x: dragX }}
      >
        <MobileCard {...props} />
      </motion.div>
    </div>
  )
}