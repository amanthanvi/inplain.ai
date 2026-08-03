import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth-helpers'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
	try {
		// Check if Clerk is properly configured
		if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
			console.error('Clerk environment variables not configured')
			return NextResponse.json({ 
				user: null, 
				error: 'Authentication service not configured' 
			}, { status: 503 })
		}

		const user = await getAuthUser(request)
		
		if (!user) {
			// Return empty session for unauthenticated users instead of 401
			return NextResponse.json({ 
				user: null,
				isAuthenticated: false 
			})
		}

		return NextResponse.json({ user })

	} catch (error) {
		console.error('Session check error:', error)
		return NextResponse.json({ user: null }, { status: 500 })
	}
}