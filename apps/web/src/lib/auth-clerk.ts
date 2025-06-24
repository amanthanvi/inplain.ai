import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function getClerkAuth() {
  const { userId, sessionId } = await auth()
  return { userId, sessionId }
}

export async function requireClerkAuth() {
  const { userId } = await auth()
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }
  
  return null // No error, authentication successful
}

export async function getClerkUser() {
  return await currentUser()
}

// Helper to check if a request is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const { userId } = await auth()
  return !!userId
}

// Helper for API routes that returns user ID or error response
export async function withAuth<T>(
  handler: (userId: string) => Promise<NextResponse<T>>
): Promise<NextResponse<T | { error: string }>> {
  const { userId } = await auth()
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }
  
  return handler(userId)
}