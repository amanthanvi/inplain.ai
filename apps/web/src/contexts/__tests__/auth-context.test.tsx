import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../auth-context'
import { createMockUser } from '@/test/utils'

// Mock the API
vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn()
  }
}))

// Wrapper component for hooks
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.clearAllTimers()
  })

  it('provides initial auth state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    expect(result.current.user).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(typeof result.current.signIn).toBe('function')
    expect(typeof result.current.signUp).toBe('function')
    expect(typeof result.current.signOut).toBe('function')
    expect(typeof result.current.updatePreferences).toBe('function')
  })

  it('handles successful sign in', async () => {
    const mockUser = createMockUser()
    const { api } = await import('@/lib/api')
    vi.mocked(api.post).mockResolvedValue({
      user: mockUser,
      token: 'test-token'
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await act(async () => {
      await result.current.signIn({
        email: 'test@example.com',
        password: 'password123'
      })
    })

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.loading).toBe(false)
    })

    expect(localStorage.getItem('auth-token')).toBe('test-token')
    expect(api.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    })
  })

  it('handles sign in error', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.post).mockRejectedValue(new Error('Invalid credentials'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await act(async () => {
      try {
        await result.current.signIn({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }
    })

    expect(result.current.user).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(localStorage.getItem('auth-token')).toBeNull()
  })

  it('handles successful sign up', async () => {
    const mockUser = createMockUser()
    const { api } = await import('@/lib/api')
    vi.mocked(api.post).mockResolvedValue({
      user: mockUser,
      token: 'test-token'
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await act(async () => {
      await result.current.signUp({
        email: 'test@example.com',
        password: 'password123'
      })
    })

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    expect(localStorage.getItem('auth-token')).toBe('test-token')
  })

  it('handles sign out', async () => {
    const mockUser = createMockUser()
    localStorage.setItem('auth-token', 'test-token')
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    // Set initial user state
    act(() => {
      // Simulate being logged in
      result.current.user = mockUser
    })

    await act(async () => {
      result.current.signOut()
    })

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('auth-token')).toBeNull()
  })

  it('updates user preferences', async () => {
    const mockUser = createMockUser()
    const updatedPreferences = {
      watchlist: ['google', 'facebook', 'amazon'],
      notifications: {
        email: false,
        majorChanges: true,
        weeklyDigest: true
      }
    }

    const { api } = await import('@/lib/api')
    vi.mocked(api.put).mockResolvedValue({
      user: { ...mockUser, preferences: updatedPreferences }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    
    // Set initial user state
    act(() => {
      result.current.user = mockUser
    })

    await act(async () => {
      await result.current.updatePreferences(updatedPreferences)
    })

    await waitFor(() => {
      expect(result.current.user?.preferences).toEqual(updatedPreferences)
    })

    expect(api.put).toHaveBeenCalledWith('/api/user/settings', {
      preferences: updatedPreferences
    })
  })

  it('restores session from localStorage on mount', async () => {
    const mockUser = createMockUser()
    localStorage.setItem('auth-token', 'test-token')
    
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({ user: mockUser })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    expect(api.get).toHaveBeenCalledWith('/api/auth/session')
  })

  it('handles invalid session restoration', async () => {
    localStorage.setItem('auth-token', 'invalid-token')
    
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockRejectedValue(new Error('Invalid token'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.user).toBeNull()
      expect(result.current.loading).toBe(false)
    })

    expect(localStorage.getItem('auth-token')).toBeNull()
  })

  it('shows loading state during authentication', async () => {
    const { api } = await import('@/lib/api')
    let resolvePromise: (value: any) => void
    const slowPromise = new Promise(resolve => {
      resolvePromise = resolve
    })
    vi.mocked(api.post).mockReturnValue(slowPromise)

    const { result } = renderHook(() => useAuth(), { wrapper })
    
    act(() => {
      result.current.signIn({
        email: 'test@example.com',
        password: 'password123'
      })
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolvePromise!({ user: createMockUser(), token: 'test-token' })
      await slowPromise
    })

    expect(result.current.loading).toBe(false)
  })
})