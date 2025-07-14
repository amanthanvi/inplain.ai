import { auth, currentUser } from '@clerk/nextjs/server'
import { isDevAuthEnabled, DEV_USER, isDevAuthRequest } from './dev-auth'
import { NextRequest } from 'next/server'

export interface AuthUser {
  id: string
  email: string
  name: string
  avatar?: string
  plan: string
  preferences: {
    watchlist: string[]
    notifications: {
      email: boolean
      majorChanges: boolean
      weeklyDigest: boolean
    }
    theme: 'light' | 'dark' | 'system'
  }
  createdAt: Date
}

export async function getAuthUser(request?: NextRequest): Promise<AuthUser | null> {
  try {
    // Check for dev auth bypass
    if (isDevAuthEnabled() && (!request || isDevAuthRequest(request.headers))) {
      // Return dev user in auth format
      return {
        id: DEV_USER.id,
        email: DEV_USER.email,
        name: DEV_USER.name || 'Dev User',
        avatar: undefined,
        plan: DEV_USER.tier,
        preferences: {
          watchlist: DEV_USER.customWatchlists || [],
          notifications: {
            email: DEV_USER.emailAlerts,
            majorChanges: true,
            weeklyDigest: false
          },
          theme: 'system'
        },
        createdAt: DEV_USER.createdAt
      }
    }

    // Use Clerk authentication
    const { userId } = await auth()
    
    if (!userId) {
      return null
    }

    const clerkUser = await currentUser()
    
    if (!clerkUser) {
      return null
    }

    // Transform Clerk user to our app's user format
    return {
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
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

export async function requireAuth(request?: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(request)
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  return user
}