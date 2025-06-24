'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export default function OnboardingPage() {
  const router = useRouter()
  const { userId, isLoaded } = useAuth()

  useEffect(() => {
    // Redirect if user is not authenticated
    if (isLoaded && !userId) {
      router.push('/login?redirect=/onboarding')
    }
  }, [userId, isLoaded, router])

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!userId) {
    return null // Will redirect
  }

  return <OnboardingFlow />
}