import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { kv } from '@vercel/kv'
import type { User } from '@/contexts/auth-context'

export const runtime = 'edge'

// Simple password hashing using Web Crypto API
async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder()
	const data = encoder.encode(password)
	const hash = await crypto.subtle.digest('SHA-256', data)
	return Array.from(new Uint8Array(hash))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')
}

function generateSessionToken(): string {
	const array = new Uint8Array(32)
	crypto.getRandomValues(array)
	return Array.from(array)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json()
		const { email, password } = body

		if (!email || !password) {
			return NextResponse.json(
				{ message: 'Email and password are required' },
				{ status: 400 }
			)
		}

		// Get user by email
		const userId = await kv.get<string>(`email:${email}`)
		if (!userId) {
			return NextResponse.json(
				{ message: 'Invalid email or password' },
				{ status: 401 }
			)
		}

		// Get user data
		const user = await kv.get<User & { passwordHash: string }>(`user:${userId}`)
		if (!user) {
			return NextResponse.json(
				{ message: 'Invalid email or password' },
				{ status: 401 }
			)
		}

		// Verify password
		const passwordHash = await hashPassword(password)
		if (passwordHash !== user.passwordHash) {
			return NextResponse.json(
				{ message: 'Invalid email or password' },
				{ status: 401 }
			)
		}

		// Create session
		const sessionToken = generateSessionToken()
		const sessionExpiry = 60 * 60 * 24 * 7 // 7 days

		await kv.set(`session:${sessionToken}`, userId, { ex: sessionExpiry })

		// Set cookie
		const cookieStore = await cookies()
		cookieStore.set('session', sessionToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: sessionExpiry,
			path: '/'
		})

		// Remove password hash from response
		const { passwordHash: _, ...userWithoutPassword } = user

		return NextResponse.json({ user: userWithoutPassword })

	} catch (error) {
		console.error('Login error:', error)
		return NextResponse.json(
			{ message: 'Login failed' },
			{ status: 500 }
		)
	}
}