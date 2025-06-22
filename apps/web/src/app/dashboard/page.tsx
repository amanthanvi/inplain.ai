'use client'

export const dynamic = 'force-dynamic'

import { useAuth } from '@/contexts/auth-context'
import { UserDashboard } from '@/components/UserDashboard'
import { LoginForm } from '@/components/auth/LoginForm'
import { SignupForm } from '@/components/auth/SignupForm'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function DashboardPage() {
	const { isAuthenticated, isLoading } = useAuth()
	const [showSignup, setShowSignup] = useState(false)

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		)
	}

	if (!isAuthenticated) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
				{showSignup ? (
					<SignupForm
						onSuccess={() => window.location.reload()}
						onLoginClick={() => setShowSignup(false)}
					/>
				) : (
					<LoginForm
						onSuccess={() => window.location.reload()}
						onSignupClick={() => setShowSignup(true)}
					/>
				)}
			</div>
		)
	}

	return <UserDashboard />
}