'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PremiumCard, PremiumCardContent, PremiumCardHeader, PremiumCardTitle } from '@/components/ui/premium-card'
import { PremiumBadge } from '@/components/ui/premium-badge'
import { Alert, AlertDescription } from '@/components/ui/premium-alert'
import { Mail, Lock, User, Loader2, Check } from 'lucide-react'

interface SignupFormProps {
	onSuccess?: () => void
	onLoginClick?: () => void
}

export function SignupForm({ onSuccess, onLoginClick }: SignupFormProps) {
	const router = useRouter()
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [error, setError] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro'>('free')

	const passwordRequirements = [
		{ met: password.length >= 8, text: 'At least 8 characters' },
		{ met: /[A-Z]/.test(password), text: 'One uppercase letter' },
		{ met: /[a-z]/.test(password), text: 'One lowercase letter' },
		{ met: /[0-9]/.test(password), text: 'One number' },
	]

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')

		if (password !== confirmPassword) {
			setError('Passwords do not match')
			return
		}

		if (!passwordRequirements.every(req => req.met)) {
			setError('Password does not meet all requirements')
			return
		}

		setIsLoading(true)

		// Since Clerk handles signup through its own components,
		// redirect to the Clerk signup page with the form data
		setIsLoading(false)
		router.push('/signup')
	}

	return (
		<PremiumCard variant="glass" className="w-full max-w-md">
			<PremiumCardHeader>
				<PremiumCardTitle className="text-2xl text-center">Create Your Account</PremiumCardTitle>
			</PremiumCardHeader>
			<PremiumCardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{/* Plan Selection */}
					<div className="space-y-2">
						<label className="text-sm font-medium">Choose Your Plan</label>
						<div className="grid grid-cols-2 gap-3">
							<button
								type="button"
								onClick={() => setSelectedPlan('free')}
								className={`p-3 rounded-lg border-2 transition-all ${
									selectedPlan === 'free'
										? 'border-primary bg-primary/5'
										: 'border-border hover:border-primary/50'
								}`}
							>
								<div className="text-left">
									<h4 className="font-medium">Free</h4>
									<p className="text-xs text-muted-foreground">Track up to 5 companies</p>
								</div>
							</button>
							<button
								type="button"
								onClick={() => setSelectedPlan('pro')}
								className={`p-3 rounded-lg border-2 transition-all relative ${
									selectedPlan === 'pro'
										? 'border-primary bg-primary/5'
										: 'border-border hover:border-primary/50'
								}`}
							>
								<PremiumBadge variant="premium" size="sm" className="absolute -top-2 -right-2">
									Popular
								</PremiumBadge>
								<div className="text-left">
									<h4 className="font-medium">Pro</h4>
									<p className="text-xs text-muted-foreground">Unlimited + Analytics</p>
								</div>
							</button>
						</div>
					</div>

					<div className="space-y-2">
						<label htmlFor="name" className="text-sm font-medium">
							Full Name
						</label>
						<div className="relative">
							<User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
							<input
								id="name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="w-full pl-10 pr-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
								placeholder="John Doe"
								required
								disabled={isLoading}
							/>
						</div>
					</div>

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
						{password && (
							<div className="space-y-1 mt-2">
								{passwordRequirements.map((req, idx) => (
									<div key={idx} className="flex items-center gap-2 text-xs">
										<Check className={`h-3 w-3 ${req.met ? 'text-green-500' : 'text-muted-foreground'}`} />
										<span className={req.met ? 'text-green-500' : 'text-muted-foreground'}>
											{req.text}
										</span>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="space-y-2">
						<label htmlFor="confirmPassword" className="text-sm font-medium">
							Confirm Password
						</label>
						<div className="relative">
							<Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
							<input
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								className="w-full pl-10 pr-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
								placeholder="••••••••"
								required
								disabled={isLoading}
							/>
						</div>
					</div>

					<div className="space-y-3">
						<label className="flex items-start gap-2">
							<input type="checkbox" className="rounded border-input mt-0.5" required />
							<span className="text-xs text-muted-foreground">
								I agree to the Terms of Service and Privacy Policy
							</span>
						</label>
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
								Creating account...
							</>
						) : (
							`Create ${selectedPlan === 'pro' ? 'Pro' : 'Free'} Account`
						)}
					</Button>

					<div className="text-center text-sm">
						Already have an account?{' '}
						<button
							type="button"
							onClick={onLoginClick}
							className="text-primary hover:underline"
						>
							Sign in
						</button>
					</div>
				</form>
			</PremiumCardContent>
		</PremiumCard>
	)
}