'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  User, LogOut, Settings, ChevronDown, 
  Home, Info, FileText, Bell, Loader2,
  Building2, LayoutDashboard
} from 'lucide-react'
import { NotificationCenter, type Notification } from '@/components/realtime/NotificationCenter'
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
  const [notifications, setNotifications] = useState<Notification[]>([])
  
  // Simulate real-time notifications (in production, this would connect to WebSocket or SSE)
  useEffect(() => {
    if (!user) return
    
    // Check for new policy changes every 30 seconds
    const checkForUpdates = async () => {
      try {
        // In production, this would be a real API call
        const mockNewNotification: Notification = {
          id: `notif-${Date.now()}`,
          type: 'policy-change',
          severity: Math.random() > 0.7 ? 'critical' : 'warning',
          title: 'Privacy Policy Updated',
          message: 'Meta has updated their privacy policy with changes to data retention.',
          timestamp: new Date().toISOString(),
          read: false,
          action: {
            label: 'View Changes',
            href: '/meta'
          },
          metadata: {
            company: 'Meta',
            changeType: 'major',
            riskLevel: 'high'
          }
        }
        
        // Only add notification 10% of the time to simulate realistic frequency
        if (Math.random() < 0.1) {
          setNotifications(prev => [mockNewNotification, ...prev].slice(0, 20))
        }
      } catch (error) {
        console.error('Failed to check for updates:', error)
      }
    }
    
    // Initial check
    checkForUpdates()
    
    // Set up interval
    const interval = setInterval(checkForUpdates, 30000)
    
    return () => clearInterval(interval)
  }, [user])

  // Dynamic navigation items based on auth state
  const navItems = user ? [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/companies', label: 'Companies', icon: Building2 },
    { href: '/watchlist', label: 'My Watchlist', icon: Bell },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/about', label: 'About', icon: Info },
  ] : [
    { href: '/', label: 'Home', icon: Home },
    { href: '/companies', label: 'Companies', icon: Building2 },
    { href: '/about', label: 'About', icon: Info },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link className="mr-6 flex items-center space-x-2" href="/">
            <span className="font-bold text-xl">Inplain.AI</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname === item.href 
                    ? "text-foreground" 
                    : "text-foreground/60"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="ml-auto flex items-center space-x-4">
          {!isLoaded ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <SignedIn>
                <NotificationCenter 
                  notifications={notifications}
                  onNotificationRead={(id) => {
                    setNotifications(prev => 
                      prev.map(n => n.id === id ? { ...n, read: true } : n)
                    )
                  }}
                  onNotificationDismiss={(id) => {
                    setNotifications(prev => prev.filter(n => n.id !== id))
                  }}
                />
                <UserButton 
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8"
                    }
                  }}
                />
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