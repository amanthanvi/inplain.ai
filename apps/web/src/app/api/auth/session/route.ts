import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { kv } from '@vercel/kv'
import type { User } from '@/contexts/auth-context'

export const runtime = 'edge'

export async function GET() {
	try {
		const cookieStore = await cookies()
		const sessionToken = cookieStore.get('session')?.value

		if (!sessionToken) {
			return NextResponse.json({ user: null }, { status: 401 })
		}

		// Get user from session
		const userId = await kv.get<string>(`session:${sessionToken}`)
		if (!userId) {
			return NextResponse.json({ user: null }, { status: 401 })
		}

		// Get user data
		const user = await kv.get<User>(`user:${userId}`)
		if (!user) {
			return NextResponse.json({ user: null }, { status: 401 })
		}

		return NextResponse.json({ user })

	} catch (error) {
		console.error('Session check error:', error)
		return NextResponse.json({ user: null }, { status: 500 })
	}
}