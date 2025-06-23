import { NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth'
import { isDevAuthEnabled } from '@/lib/dev-auth'

export const runtime = 'edge'

export async function GET() {
	try {
		const user = await AuthService.getCurrentUser()

		if (!user) {
			return NextResponse.json({ user: null }, { status: 401 })
		}
		
		// Add dev auth headers if enabled
		const headers = new Headers()
		if (isDevAuthEnabled() && user.id === 'dev-user-123') {
			headers.set('X-Dev-Auth-Active', 'true')
			headers.set('X-Dev-Auth-Warning', 'Authentication bypassed for development')
		}

		// Transform the user object to match the expected format
		// Map from auth.ts User type to auth-context User type
		const transformedUser = {
			id: user.id,
			email: user.email,
			name: user.name || user.email.split('@')[0],
			avatar: null,
			plan: user.tier || 'free',
			usage: {
				policies: user.customWatchlists?.length || 0,
				alerts: user.emailAlerts ? 1 : 0,
				aiSummaries: user.usage?.analysisCount || 0
			},
			preferences: {
				notifications: true,
				theme: 'system' as const,
				language: 'en'
			}
		}

		return NextResponse.json({ user: transformedUser }, { headers })

	} catch (error) {
		console.error('Session check error:', error)
		return NextResponse.json({ user: null }, { status: 500 })
	}
}