import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

export const runtime = 'edge'

export async function PATCH(request: NextRequest) {
	try {
		const { userId } = await auth()
		
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await request.json()
		const { watchlist, notifications, theme } = body

		// Update user metadata in Clerk
		const updateData: Record<string, any> = {}

		if (watchlist !== undefined) {
			updateData.watchlist = watchlist
		}

		if (notifications !== undefined) {
			if (notifications.email !== undefined) {
				updateData.emailNotifications = notifications.email
			}
			if (notifications.majorChanges !== undefined) {
				updateData.majorChangesOnly = notifications.majorChanges
			}
			if (notifications.weeklyDigest !== undefined) {
				updateData.weeklyDigest = notifications.weeklyDigest
			}
		}

		if (theme !== undefined) {
			updateData.theme = theme
		}

		// Update the user's public metadata
		const client = await clerkClient()
		await client.users.updateUserMetadata(userId, {
			publicMetadata: updateData
		})

		// Get the updated user
		const updatedUser = await client.users.getUser(userId)
		
		// Transform back to our format
		const transformedUser = {
			id: updatedUser.id,
			email: updatedUser.emailAddresses[0]?.emailAddress || '',
			name: updatedUser.firstName && updatedUser.lastName 
				? `${updatedUser.firstName} ${updatedUser.lastName}`
				: updatedUser.firstName || updatedUser.emailAddresses[0]?.emailAddress.split('@')[0] || 'User',
			avatar: updatedUser.imageUrl,
			plan: (updatedUser.publicMetadata?.plan as string) || 'free',
			preferences: {
				watchlist: (updatedUser.publicMetadata?.watchlist as string[]) || [],
				notifications: {
					email: (updatedUser.publicMetadata?.emailNotifications as boolean) ?? true,
					majorChanges: (updatedUser.publicMetadata?.majorChangesOnly as boolean) ?? true,
					weeklyDigest: (updatedUser.publicMetadata?.weeklyDigest as boolean) ?? false,
				},
				theme: (updatedUser.publicMetadata?.theme as 'light' | 'dark' | 'system') || 'system'
			},
			createdAt: new Date(updatedUser.createdAt)
		}

		return NextResponse.json(transformedUser)

	} catch (error) {
		console.error('Preferences update error:', error)
		return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
	}
}