'use client'

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export default function VerifyPage() {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    if (!isLoaded) return
    
    // If user is already authenticated after verification, redirect them
    if (userId) {
      router.push('/onboarding')
    } else {
      // If not authenticated, redirect to signup
      // This handles cases where verification failed or expired
      router.push('/signup')
    }
  }, [isLoaded, userId, router])
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <LoadingSpinner className="mx-auto mb-4" />
        <h1 className="text-2xl font-semibold">Verifying your email...</h1>
        <p className="mt-2 text-muted-foreground">Please wait while we complete verification.</p>
      </div>
    </div>
  )
}