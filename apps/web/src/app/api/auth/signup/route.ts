import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { kv } from '@vercel/kv'
import crypto from 'crypto'
import type { User } from '@/contexts/auth-context'

export const runtime = 'edge'

function hashPassword(password: string): string {
	return crypto.createHash('sha256').update(password).digest('hex')
}

function generateSessionToken(): string {
	return crypto.randomBytes(32).toString('hex')
}

function generateUserId(): string {
	return crypto.randomBytes(16).toString('hex')
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
		const passwordHash = hashPassword(password)
		
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