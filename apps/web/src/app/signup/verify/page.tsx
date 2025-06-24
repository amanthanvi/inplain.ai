'use client'

import { useEffect } from 'react'
import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export default function VerifyPage() {
  const { handleMagicLinkVerification } = useClerk()
  const router = useRouter()
  
  useEffect(() => {
    async function verify() {
      try {
        // Clerk automatically handles the magic link verification
        // The handleMagicLinkVerification will process the URL params
        const result = await handleMagicLinkVerification({
          redirectUrl: '/onboarding',
          redirectUrlComplete: '/onboarding'
        })
        
        // If verification is successful, Clerk will handle the redirect
        if (result.status === 'complete') {
          router.push('/onboarding')
        }
      } catch (error) {
        console.error('Verification error:', error)
        // On error, redirect to signup
        router.push('/signup?error=verification_failed')
      }
    }
    
    verify()
  }, [handleMagicLinkVerification, router])
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <LoadingSpinner className="mx-auto mb-4" />
        <h1 className="text-2xl font-semibold">Verifying your email...</h1>
        <p className="mt-2 text-muted-foreground">Please wait while we verify your account.</p>
      </div>
    </div>
  )
}