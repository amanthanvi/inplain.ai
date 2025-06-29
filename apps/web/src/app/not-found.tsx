'use client'

import Link from 'next/link'
import { FileQuestion, Home, Search, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
// import { AnimatedContainer } from '@/components/ui/animations'
// import { useEffect, useState } from 'react'

// Opt out of static generation for this page
export const dynamic = 'force-dynamic'

export default function NotFound() {
  // const [mounted, setMounted] = useState(false)

  // useEffect(() => {
  //   setMounted(true)
  // }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
    <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <FileQuestion className="h-10 w-10 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl">404 - Page Not Found</CardTitle>
            <CardDescription className="text-base mt-2">
              The page you're looking for doesn't exist or has been moved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              <Button size="lg" asChild className="w-full">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Go to Homepage
                </Link>
              </Button>
              
              <Button variant="outline" size="lg" asChild className="w-full">
                <Link href="/companies">
                  <Search className="mr-2 h-4 w-4" />
                  Browse Companies
                </Link>
              </Button>

              <Button 
                variant="ghost" 
                size="lg" 
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    if (window.history.length > 1) {
                      window.history.back()
                    } else {
                      window.location.href = '/'
                    }
                  }
                }}
                className="w-full"
                suppressHydrationWarning
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Looking for a specific company? Try searching from our{' '}
                <Link href="/companies" className="text-primary hover:underline">
                  companies directory
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
    </div>
  )
}