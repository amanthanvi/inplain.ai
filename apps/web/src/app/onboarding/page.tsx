'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    // Redirect if user is not authenticated
    if (!isLoading && !user) {
      router.push('/login?redirect=/onboarding')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user) {
    return null // Will redirect
  }

  return <OnboardingFlow />
}