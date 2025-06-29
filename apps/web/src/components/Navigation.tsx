'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  User, LogOut, Settings, ChevronDown, 
  Home, Info, FileText, Bell, Loader2,
  Building2, LayoutDashboard, MessageSquare, Sparkles
} from 'lucide-react'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  SignInButton, 
  SignUpButton, 
  UserButton, 
  SignedIn, 
  SignedOut, 
  useUser 
} from '@clerk/nextjs'

export function Navigation() {
  const pathname = usePathname()
  const { user, isLoaded } = useUser()
  
  // Use real-time notifications hook
  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
    preferences,
    updatePreferences
  } = useNotifications({
    enableSound: true,
    enableDesktop: true,
    enableToast: true,
    maxNotifications: 50
  })

  // Dynamic navigation items based on auth state
  const isAdmin = user?.publicMetadata?.role === 'admin';
  
  const navItems = user ? [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/companies', label: 'Companies', icon: Building2 },
    { href: '/watchlist', label: 'Watchlist', icon: Bell },
    { href: '/roadmap', label: 'Roadmap', icon: Sparkles },
    ...(isAdmin ? [{ href: '/feedback', label: 'Feedback', icon: MessageSquare }] : []),
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/about', label: 'About', icon: Info },
  ] : [
    { href: '/', label: 'Home', icon: Home },
    { href: '/companies', label: 'Companies', icon: Building2 },
    { href: '/roadmap', label: 'Roadmap', icon: Sparkles },
    { href: '/about', label: 'About', icon: Info },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link className="mr-6 flex items-center space-x-2" href="/" aria-label="Inplain.AI home">
            <span className="font-bold text-xl">Inplain.AI</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium" aria-label="Main navigation" id="main-navigation">
            {navItems.map((item) => {
              const isCurrentPage = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "transition-colors hover:text-foreground/80",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded px-2 py-1",
                    isCurrentPage 
                      ? "text-foreground" 
                      : "text-foreground/60"
                  )}
                  aria-current={isCurrentPage ? "page" : undefined}
                >
                  <span className="sr-only">{isCurrentPage ? "Current page: " : ""}</span>
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        
        <div className="ml-auto flex items-center space-x-4">
          {!isLoaded ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <SignedIn>
                <div className="flex items-center gap-2">
                  {isConnected && (
                    <Badge variant="outline" className="text-xs">
                      <div className="h-2 w-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                      Live
                    </Badge>
                  )}
                  <NotificationCenter 
                    notifications={notifications}
                    onNotificationRead={markAsRead}
                    onNotificationDismiss={dismiss}
                    onMarkAllRead={markAllAsRead}
                    onClearAll={dismissAll}
                    isConnected={isConnected}
                    enableSound={preferences?.enableSound ?? true}
                    onSoundToggle={(enabled) => updatePreferences({ enableSound: enabled })}
                  />
                  <UserButton 
                    appearance={{
                      elements: {
                        avatarBox: "w-8 h-8"
                      }
                    }}
                  />
                </div>
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button size="sm">
                    Get Started
                  </Button>
                </SignUpButton>
              </SignedOut>
            </>
          )}
        </div>
      </div>
    </header>
  )
}