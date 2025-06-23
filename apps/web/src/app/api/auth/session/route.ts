import { NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth'

export const runtime = 'edge'

export async function GET() {
	try {
		const user = await AuthService.getCurrentUser()

		if (!user) {
			return NextResponse.json({ user: null }, { status: 401 })
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
				policies: user.usage?.policies || 0,
				alerts: user.usage?.alerts || 0,
				aiSummaries: user.usage?.aiSummaries || 0
			},
			preferences: {
				notifications: true,
				theme: 'system' as const,
				language: 'en'
			}
		}

		return NextResponse.json({ user: transformedUser })

	} catch (error) {
		console.error('Session check error:', error)
		return NextResponse.json({ user: null }, { status: 500 })
	}
}