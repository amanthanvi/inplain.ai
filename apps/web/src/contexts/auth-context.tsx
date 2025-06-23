'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

export interface User {
	id: string
	email: string
	name: string
	avatar?: string
	plan: 'free' | 'pro' | 'enterprise'
	preferences: {
		watchlist: string[] // Company slugs to watch
		notifications: {
			email: boolean
			majorChanges: boolean
			weeklyDigest: boolean
		}
		theme: 'light' | 'dark' | 'system'
	}
	createdAt: Date
}

interface AuthContextType {
	user: User | null
	isLoading: boolean
	isAuthenticated: boolean
	login: (email: string, password: string) => Promise<void>
	signup: (email: string, password: string, name: string) => Promise<void>
	logout: () => Promise<void>
	updatePreferences: (preferences: Partial<User['preferences']>) => Promise<void>
	addToWatchlist: (companySlug: string) => Promise<void>
	removeFromWatchlist: (companySlug: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const router = useRouter()

	// Check for existing session on mount
	useEffect(() => {
		checkSession()
	}, [])

	const checkSession = async () => {
		try {
			const response = await fetch('/api/auth/session')
			
			// Check for dev auth warning
			if (response.headers.get('X-Dev-Auth-Active') === 'true') {
				console.warn('🔓 Using development authentication bypass');
			}
			
			if (response.ok) {
				const data = await response.json()
				setUser(data.user)
			}
		} catch (error) {
			console.error('Session check failed:', error)
		} finally {
			setIsLoading(false)
		}
	}

	const login = async (email: string, password: string) => {
		const response = await fetch('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		})

		if (!response.ok) {
			const error = await response.json()
			throw new Error(error.message || 'Login failed')
		}

		const data = await response.json()
		setUser(data.user)
		router.push('/dashboard')
	}

	const signup = async (email: string, password: string, name: string) => {
		const response = await fetch('/api/auth/signup', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password, name })
		})

		if (!response.ok) {
			const error = await response.json()
			throw new Error(error.message || 'Signup failed')
		}

		const data = await response.json()
		setUser(data.user)
		// Redirect new users to onboarding
		router.push('/onboarding')
	}

	const logout = async () => {
		await fetch('/api/auth/logout', { method: 'POST' })
		setUser(null)
		router.push('/')
	}

	const updatePreferences = async (preferences: Partial<User['preferences']>) => {
		if (!user) throw new Error('Not authenticated')

		const response = await fetch('/api/auth/preferences', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(preferences)
		})

		if (!response.ok) {
			throw new Error('Failed to update preferences')
		}

		const updatedUser = await response.json()
		setUser(updatedUser)
	}

	const addToWatchlist = async (companySlug: string) => {
		if (!user) throw new Error('Not authenticated')

		const newWatchlist = [...user.preferences.watchlist, companySlug]
		await updatePreferences({ watchlist: newWatchlist })
	}

	const removeFromWatchlist = async (companySlug: string) => {
		if (!user) throw new Error('Not authenticated')

		const newWatchlist = user.preferences.watchlist.filter(slug => slug !== companySlug)
		await updatePreferences({ watchlist: newWatchlist })
	}

	return (
		<AuthContext.Provider
			value={{
				user,
				isLoading,
				isAuthenticated: !!user,
				login,
				signup,
				logout,
				updatePreferences,
				addToWatchlist,
				removeFromWatchlist
			}}
		>
			{children}
		</AuthContext.Provider>
	)
}

export function useAuth() {
	const context = useContext(AuthContext)
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider')
	}
	return context
}