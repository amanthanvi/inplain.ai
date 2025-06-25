'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Menu, X, Home, Building2, Bell, Settings, 
  LogIn, User, Search, ChevronRight, Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs'
import { AnimatedContainer } from '@/components/ui/animations'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Companies', href: '/companies', icon: Building2 },
  { name: 'Search', href: '/search', icon: Search },
]

const authenticatedNavigation = [
  { name: 'My Watchlist', href: '/watchlist', icon: Bell },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function MobileNavigation() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { user, isLoaded } = useUser()
  const [hasNotifications, setHasNotifications] = useState(false)

  // Close menu on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Simulate notification check
  useEffect(() => {
    if (user) {
      const checkNotifications = () => {
        setHasNotifications(Math.random() > 0.7)
      }
      checkNotifications()
      const interval = setInterval(checkNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  return (
    <div className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:hidden">
      <Link href="/" className="flex items-center space-x-2">
        <span className="font-bold text-lg">Inplain.AI</span>
        {hasNotifications && (
          <Badge variant="destructive" className="h-2 w-2 p-0 rounded-full animate-pulse" />
        )}
      </Link>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Menu className="h-5 w-5" />
            {hasNotifications && (
              <span className="absolute top-0 right-0 h-2 w-2 bg-destructive rounded-full" />
            )}
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Menu</span>
              {hasNotifications && (
                <Badge variant="secondary" className="ml-2">
                  <Activity className="h-3 w-3 mr-1" />
                  New Updates
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 flex flex-col space-y-6">
            {/* User section */}
            <SignedIn>
              <div className="flex items-center space-x-3 px-2">
                <UserButton 
                  appearance={{
                    elements: {
                      avatarBox: "w-10 h-10"
                    }
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{user?.firstName || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
                </div>
              </div>
              <Separator />
            </SignedIn>

            {/* Main Navigation */}
            <nav className="flex flex-col space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={cn(
                        "h-5 w-5",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span>{item.name}</span>
                    </div>
                    {item.name === 'Companies' && (
                      <Badge variant="secondary" className="text-xs">60+</Badge>
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Authenticated Navigation */}
            <SignedIn>
              <Separator />
              <nav className="flex flex-col space-y-1">
                {authenticatedNavigation.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive 
                          ? "bg-primary/10 text-primary" 
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={cn(
                          "h-5 w-5",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )} />
                        <span>{item.name}</span>
                      </div>
                      {item.name === 'My Watchlist' && hasNotifications && (
                        <Badge variant="destructive" className="text-xs">New</Badge>
                      )}
                    </Link>
                  )
                })}
              </nav>
            </SignedIn>

            {/* Auth Buttons */}
            <SignedOut>
              <Separator />
              <div className="space-y-2">
                <Button asChild className="w-full justify-start">
                  <Link href="/signup">
                    <User className="mr-2 h-4 w-4" />
                    Get Started Free
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </Link>
                </Button>
              </div>
            </SignedOut>

            {/* Footer */}
            <Separator />
            <div className="space-y-2 text-xs text-muted-foreground">
              <Link href="/about" className="block hover:text-foreground transition-colors">
                About Inplain.AI
              </Link>
              <Link href="/privacy" className="block hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="block hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// Mobile Bottom Navigation
export function MobileBottomNav() {
  const pathname = usePathname()
  const { user } = useUser()

  const bottomNavItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Companies', href: '/companies', icon: Building2 },
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Alerts', href: user ? '/watchlist' : '/login', icon: Bell },
    { name: 'Profile', href: user ? '/settings' : '/login', icon: User },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-2 md:hidden">
      {bottomNavItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 py-2 text-xs transition-colors",
              isActive 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn(
              "h-5 w-5 mb-1",
              isActive && "animate-in zoom-in-50 duration-200"
            )} />
            <span className="truncate">{item.name}</span>
          </Link>
        )
      })}
    </div>
  )
}