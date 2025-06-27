import { NextRequest, NextResponse } from 'next/server'
import { getClerkAuth, getClerkUser } from '@/lib/auth-clerk'
import { APIKeyManager } from '@/lib/middleware/api-key'
import { middleware } from '@/lib/middleware'

const apiKeyManager = new APIKeyManager()

// GET /api/user/api-keys - List user's API keys
export const GET = middleware.protectedAPI(async (request: NextRequest) => {
  try {
    const { userId } = await getClerkAuth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const apiKeys = await apiKeyManager.getUserAPIKeys(userId)
    
    // Get usage stats for each key
    const keysWithUsage = await Promise.all(
      apiKeys.map(async (key) => {
        const usage = await apiKeyManager.getUsageStats(key.id)
        return {
          ...key,
          usage: usage ? {
            totalRequests: usage.requests,
            lastUsed: usage.lastRequest
          } : null
        }
      })
    )

    return NextResponse.json({ apiKeys: keysWithUsage })
  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
})

// POST /api/user/api-keys - Create a new API key
export const POST = middleware.protectedAPI(async (request: NextRequest) => {
  try {
    const { userId } = await getClerkAuth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, permissions = ['read'], expiresInDays } = body

    if (!name) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      )
    }

    // Validate permissions
    const validPermissions = ['read', 'write', 'delete', 'analytics', 'export', 'webhook']
    const invalidPermissions = permissions.filter((p: string) => !validPermissions.includes(p))
    
    if (invalidPermissions.length > 0) {
      return NextResponse.json(
        { error: `Invalid permissions: ${invalidPermissions.join(', ')}` },
        { status: 400 }
      )
    }

    // Create the API key
    const { apiKey, plainKey } = await apiKeyManager.createAPIKey(
      userId,
      name,
      permissions,
      expiresInDays
    )

    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key: plainKey, // Only returned once during creation
        permissions: apiKey.permissions,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt
      },
      message: 'Save this API key securely. It will not be shown again.'
    })
  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    )
  }
})

// DELETE /api/user/api-keys - Revoke an API key
export const DELETE = middleware.protectedAPI(async (request: NextRequest) => {
  try {
    const { userId } = await getClerkAuth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('keyId')

    if (!keyId) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      )
    }

    // Verify the key belongs to the user
    const userKeys = await apiKeyManager.getUserAPIKeys(userId)
    const keyExists = userKeys.some(k => k.id === keyId)

    if (!keyExists) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      )
    }

    // Revoke the key
    const success = await apiKeyManager.revokeAPIKey(keyId)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to revoke API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error revoking API key:', error)
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    )
  }
})

// PUT /api/user/api-keys - Rotate an API key
export const PUT = middleware.protectedAPI(async (request: NextRequest) => {
  try {
    const { userId } = await getClerkAuth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { keyId } = body

    if (!keyId) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      )
    }

    // Verify the key belongs to the user
    const userKeys = await apiKeyManager.getUserAPIKeys(userId)
    const keyExists = userKeys.some(k => k.id === keyId)

    if (!keyExists) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      )
    }

    // Rotate the key
    const result = await apiKeyManager.rotateAPIKey(keyId)

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to rotate API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      apiKey: {
        id: result.apiKey.id,
        name: result.apiKey.name,
        key: result.plainKey, // Only returned once during rotation
        permissions: result.apiKey.permissions,
        createdAt: result.apiKey.createdAt,
        expiresAt: result.apiKey.expiresAt
      },
      message: 'API key rotated successfully. Save the new key securely.'
    })
  } catch (error) {
    console.error('Error rotating API key:', error)
    return NextResponse.json(
      { error: 'Failed to rotate API key' },
      { status: 500 }
    )
  }
})