import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { kv } from '@vercel/kv'
import type { User } from '@/contexts/auth-context'

export const runtime = 'edge'

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

function generateUserId(): string {
	const array = new Uint8Array(16)
	crypto.getRandomValues(array)
	return Array.from(array)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json()
		const { email, password, name } = body

		if (!email || !password || !name) {
			return NextResponse.json(
				{ message: 'Email, password, and name are required' },
				{ status: 400 }
			)
		}

		// Check if email already exists
		const existingUserId = await kv.get<string>(`email:${email}`)
		if (existingUserId) {
			return NextResponse.json(
				{ message: 'Email already registered' },
				{ status: 409 }
			)
		}

		// Create new user
		const userId = generateUserId()
		const passwordHash = await hashPassword(password)
		
		const newUser: User & { passwordHash: string } = {
			id: userId,
			email,
			name,
			plan: 'free',
			preferences: {
				watchlist: [],
				notifications: {
					email: true,
					majorChanges: true,
					weeklyDigest: false
				},
				theme: 'system'
			},
			createdAt: new Date(),
			passwordHash
		}

		// Save user
		await kv.set(`user:${userId}`, newUser)
		await kv.set(`email:${email}`, userId)

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
		const { passwordHash: _, ...userWithoutPassword } = newUser

		return NextResponse.json({ user: userWithoutPassword })

	} catch (error) {
		console.error('Signup error:', error)
		return NextResponse.json(
			{ message: 'Signup failed' },
			{ status: 500 }
		)
	}
}