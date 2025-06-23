import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSearch } from '../useSearch'

// Mock the API
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn()
  }
}))

const mockSearchResults = [
  {
    id: '1',
    type: 'company',
    slug: 'google',
    name: 'Google',
    description: 'Search engine and tech company',
    url: 'https://policies.google.com/privacy'
  },
  {
    id: '2',
    type: 'policy',
    slug: 'facebook',
    name: 'Facebook Privacy Policy',
    description: 'Privacy policy for Facebook platform',
    url: 'https://www.facebook.com/privacy/explanation'
  }
]

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns initial state correctly', () => {
    const { result } = renderHook(() => useSearch())
    
    expect(result.current.results).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.query).toBe('')
  })

  it('performs search and returns results', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({ data: mockSearchResults })

    const { result } = renderHook(() => useSearch())
    
    result.current.search('google')

    expect(result.current.loading).toBe(true)
    expect(result.current.query).toBe('google')

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.results).toEqual(mockSearchResults)
      expect(result.current.error).toBeNull()
    })

    expect(api.get).toHaveBeenCalledWith('/api/search', {
      params: { q: 'google', limit: 10 }
    })
  })

  it('handles search errors', async () => {
    const { api } = await import('@/lib/api')
    const errorMessage = 'Search failed'
    vi.mocked(api.get).mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useSearch())
    
    result.current.search('test')

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.results).toEqual([])
      expect(result.current.error).toBe(errorMessage)
    })
  })

  it('debounces search requests', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({ data: mockSearchResults })

    const { result } = renderHook(() => useSearch({ debounceMs: 100 }))
    
    // Trigger multiple searches quickly
    result.current.search('g')
    result.current.search('go')
    result.current.search('goo')
    result.current.search('google')

    // Wait for debounce
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    }, { timeout: 200 })

    // Should only make one API call for the final search term
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.get).toHaveBeenCalledWith('/api/search', {
      params: { q: 'google', limit: 10 }
    })
  })

  it('clears results when query is empty', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({ data: mockSearchResults })

    const { result } = renderHook(() => useSearch())
    
    // First search
    result.current.search('google')
    await waitFor(() => {
      expect(result.current.results).toEqual(mockSearchResults)
    })

    // Clear search
    result.current.search('')
    
    expect(result.current.results).toEqual([])
    expect(result.current.query).toBe('')
    expect(result.current.loading).toBe(false)
  })

  it('respects custom limit parameter', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({ data: mockSearchResults })

    const { result } = renderHook(() => useSearch({ limit: 5 }))
    
    result.current.search('test')

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(api.get).toHaveBeenCalledWith('/api/search', {
      params: { q: 'test', limit: 5 }
    })
  })

  it('filters results by type', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({ data: mockSearchResults })

    const { result } = renderHook(() => useSearch({ types: ['company'] }))
    
    result.current.search('test')

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(api.get).toHaveBeenCalledWith('/api/search', {
      params: { q: 'test', limit: 10, types: ['company'] }
    })
  })

  it('cancels previous request when new search is initiated', async () => {
    const { api } = await import('@/lib/api')
    
    // Mock a slow first request
    const slowPromise = new Promise(resolve => setTimeout(() => resolve({ data: [] }), 1000))
    const fastPromise = Promise.resolve({ data: mockSearchResults })
    
    vi.mocked(api.get)
      .mockReturnValueOnce(slowPromise)
      .mockReturnValueOnce(fastPromise)

    const { result } = renderHook(() => useSearch())
    
    // Start first search
    result.current.search('first')
    expect(result.current.loading).toBe(true)
    
    // Start second search immediately
    result.current.search('second')
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.results).toEqual(mockSearchResults)
      expect(result.current.query).toBe('second')
    })
  })
})