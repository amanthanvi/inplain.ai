import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'

export const runtime = 'edge'

export async function GET() {
	try {
		const { userId } = await auth()
		
		if (!userId) {
			return NextResponse.json({ user: null }, { status: 401 })
		}

		const clerkUser = await currentUser()
		
		if (!clerkUser) {
			return NextResponse.json({ user: null }, { status: 401 })
		}

		// Transform Clerk user to our app's user format
		const transformedUser = {
			id: clerkUser.id,
			email: clerkUser.emailAddresses[0]?.emailAddress || '',
			name: clerkUser.firstName && clerkUser.lastName 
				? `${clerkUser.firstName} ${clerkUser.lastName}`
				: clerkUser.firstName || clerkUser.emailAddresses[0]?.emailAddress.split('@')[0] || 'User',
			avatar: clerkUser.imageUrl,
			plan: (clerkUser.publicMetadata?.plan as string) || 'free',
			preferences: {
				watchlist: (clerkUser.publicMetadata?.watchlist as string[]) || [],
				notifications: {
					email: (clerkUser.publicMetadata?.emailNotifications as boolean) ?? true,
					majorChanges: (clerkUser.publicMetadata?.majorChangesOnly as boolean) ?? true,
					weeklyDigest: (clerkUser.publicMetadata?.weeklyDigest as boolean) ?? false,
				},
				theme: (clerkUser.publicMetadata?.theme as 'light' | 'dark' | 'system') || 'system'
			},
			createdAt: new Date(clerkUser.createdAt)
		}

		return NextResponse.json({ user: transformedUser })

	} catch (error) {
		console.error('Session check error:', error)
		return NextResponse.json({ user: null }, { status: 500 })
	}
}