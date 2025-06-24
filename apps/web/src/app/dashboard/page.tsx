'use client'

export const dynamic = 'force-dynamic'

import { useAuth } from '@clerk/nextjs'
import { UserDashboard } from '@/components/UserDashboard'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export default function DashboardPage() {
	const { isLoaded, userId } = useAuth()
	const router = useRouter()

	useEffect(() => {
		if (isLoaded && !userId) {
			router.push('/login')
		}
	}, [isLoaded, userId, router])

	if (!isLoaded || !userId) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		)
	}

	return <UserDashboard />
}