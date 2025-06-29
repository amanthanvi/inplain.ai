'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { HoverScale } from '@/components/ui/framer-animations'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  unreadCount: number
  onClick: () => void
  isConnected?: boolean
  className?: string
}

export function NotificationBell({ 
  unreadCount, 
  onClick, 
  isConnected = false,
  className 
}: NotificationBellProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <HoverScale>
      <Button
        variant="ghost"
        size="icon"
        className={cn("relative", className)}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className={cn(
          "h-5 w-5 transition-colors",
          isHovered && "text-primary"
        )} />
        
        <AnimatePresence mode="wait">
          {unreadCount > 0 && (
            <motion.div
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 500, 
                damping: 30 
              }}
              className="absolute -top-1 -right-1"
            >
              <Badge 
                className={cn(
                  "h-5 min-w-[20px] p-0 flex items-center justify-center text-xs font-bold",
                  "bg-red-500 hover:bg-red-600 text-white border-0",
                  unreadCount > 99 && "px-1"
                )}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Connection indicator */}
        {isConnected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute bottom-0 right-0"
          >
            <div className="h-2 w-2 bg-green-500 rounded-full border border-background" />
          </motion.div>
        )}
      </Button>
    </HoverScale>
  )
}