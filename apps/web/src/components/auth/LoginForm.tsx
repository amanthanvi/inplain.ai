'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PremiumCard, PremiumCardContent, PremiumCardHeader, PremiumCardTitle } from '@/components/ui/premium-card'
import { Alert, AlertDescription } from '@/components/ui/premium-alert'
import { Mail, Lock, Loader2 } from 'lucide-react'

interface LoginFormProps {
	onSuccess?: () => void
	onSignupClick?: () => void
}

export function LoginForm({ onSuccess, onSignupClick }: LoginFormProps) {
	const router = useRouter()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [isLoading, setIsLoading] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')
		setIsLoading(true)

		// Since Clerk handles login through its own components,
		// redirect to the Clerk login page
		setIsLoading(false)
		router.push('/login')
	}

	return (
		<PremiumCard variant="glass" className="w-full max-w-md">
			<PremiumCardHeader>
				<PremiumCardTitle className="text-2xl text-center">Welcome Back</PremiumCardTitle>
			</PremiumCardHeader>
			<PremiumCardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-2">
						<label htmlFor="email" className="text-sm font-medium">
							Email
						</label>
						<div className="relative">
							<Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full pl-10 pr-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
								placeholder="you@example.com"
								required
								disabled={isLoading}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<label htmlFor="password" className="text-sm font-medium">
							Password
						</label>
						<div className="relative">
							<Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full pl-10 pr-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
								placeholder="••••••••"
								required
								disabled={isLoading}
							/>
						</div>
					</div>

					<div className="flex items-center justify-between">
						<label className="flex items-center gap-2">
							<input type="checkbox" className="rounded border-input" />
							<span className="text-sm">Remember me</span>
						</label>
						<button
							type="button"
							className="text-sm text-primary hover:underline"
						>
							Forgot password?
						</button>
					</div>

					<Button
						type="submit"
						variant="premium"
						className="w-full"
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Signing in...
							</>
						) : (
							'Sign In'
						)}
					</Button>

					<div className="text-center text-sm">
						Don't have an account?{' '}
						<button
							type="button"
							onClick={onSignupClick}
							className="text-primary hover:underline"
						>
							Sign up
						</button>
					</div>
				</form>
			</PremiumCardContent>
		</PremiumCard>
	)
}