import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '@/lib/api'

// Mock fetch globally
global.fetch = vi.fn()

describe('API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetch).mockClear()
  })

  describe('companies endpoint', () => {
    it('should fetch companies list', async () => {
      const mockCompanies = [
        { slug: 'google', name: 'Google', status: 'active' },
        { slug: 'facebook', name: 'Facebook', status: 'active' }
      ]

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockCompanies })
      } as Response)

      const response = await api.get('/api/companies')
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/companies'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      )
      
      expect(response.data).toEqual(mockCompanies)
    })

    it('should handle API errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' })
      } as Response)

      await expect(api.get('/api/companies')).rejects.toThrow('Internal Server Error')
    })

    it('should include auth headers when authenticated', async () => {
      // Mock authenticated state
      const mockToken = 'test-auth-token'
      localStorage.setItem('auth-token', mockToken)

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] })
      } as Response)

      await api.get('/api/companies')
      
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`
          })
        })
      )

      localStorage.removeItem('auth-token')
    })
  })

  describe('analysis endpoint', () => {
    it('should trigger AI analysis', async () => {
      const mockAnalysis = {
        analysis: 'Test analysis result',
        riskScore: 75,
        summary: 'Test summary'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAnalysis
      } as Response)

      const response = await api.post('/api/analyze/google', {
        type: 'comprehensive'
      })
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analyze/google'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ type: 'comprehensive' })
        })
      )
      
      expect(response).toEqual(mockAnalysis)
    })

    it('should handle streaming analysis', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('chunk1\n'))
          controller.enqueue(new TextEncoder().encode('chunk2\n'))
          controller.close()
        }
      })

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: mockStream
      } as Response)

      const response = await fetch('/api/analyze-stream/google', {
        method: 'POST',
        body: JSON.stringify({ type: 'comprehensive' })
      })
      
      expect(response.ok).toBe(true)
      expect(response.body).toBeDefined()
    })
  })

  describe('search endpoint', () => {
    it('should search companies and policies', async () => {
      const mockResults = [
        { id: '1', type: 'company', name: 'Google', slug: 'google' },
        { id: '2', type: 'policy', name: 'Privacy Policy', slug: 'google' }
      ]

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockResults })
      } as Response)

      const response = await api.get('/api/search', {
        params: { q: 'google', limit: 10 }
      })
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search?q=google&limit=10'),
        expect.any(Object)
      )
      
      expect(response.data).toEqual(mockResults)
    })
  })

  describe('diff endpoint', () => {
    it('should fetch policy diffs', async () => {
      const mockDiffs = [
        {
          id: 'diff-1',
          version: 2,
          changes: [{ type: 'addition', text: 'New clause', position: 100 }],
          timestamp: '2024-01-15T10:00:00Z'
        }
      ]

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockDiffs })
      } as Response)

      const response = await api.get('/api/diff/google')
      
      expect(response.data).toEqual(mockDiffs)
    })
  })

  describe('auth endpoints', () => {
    it('should handle login', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        token: 'auth-token'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUser
      } as Response)

      const response = await api.post('/api/auth/login', {
        email: 'test@example.com',
        password: 'password123'
      })
      
      expect(response).toEqual(mockUser)
    })

    it('should handle signup', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        token: 'auth-token'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockUser
      } as Response)

      const response = await api.post('/api/auth/signup', {
        email: 'test@example.com',
        password: 'password123'
      })
      
      expect(response).toEqual(mockUser)
    })
  })

  describe('error handling', () => {
    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(api.get('/api/companies')).rejects.toThrow('Network error')
    })

    it('should handle rate limiting', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' })
      } as Response)

      await expect(api.get('/api/companies')).rejects.toThrow('Rate limit exceeded')
    })

    it('should handle server errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' })
      } as Response)

      await expect(api.get('/api/companies')).rejects.toThrow('Internal Server Error')
    })
  })
})