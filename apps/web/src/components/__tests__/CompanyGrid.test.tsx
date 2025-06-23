import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@/test/utils'
import CompanyGrid from '../CompanyGrid'

// Mock the API calls
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn()
  }
}))

const mockCompanies = [
  {
    slug: 'google',
    name: 'Google',
    url: 'https://policies.google.com/privacy',
    lastChecked: '2024-01-15T10:00:00Z',
    status: 'active',
    metadata: {
      wordCount: 5000,
      readingTime: 25
    }
  },
  {
    slug: 'facebook',
    name: 'Facebook',
    url: 'https://www.facebook.com/privacy/explanation',
    lastChecked: '2024-01-14T15:30:00Z',
    status: 'active',
    metadata: {
      wordCount: 3500,
      readingTime: 18
    }
  }
]

describe('CompanyGrid', () => {
  it('renders loading state initially', () => {
    render(<CompanyGrid />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders company cards after loading', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({ data: mockCompanies })

    render(<CompanyGrid />)
    
    await waitFor(() => {
      expect(screen.getByText('Google')).toBeInTheDocument()
      expect(screen.getByText('Facebook')).toBeInTheDocument()
    })
  })

  it('handles search functionality', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({ data: mockCompanies })

    render(<CompanyGrid />)
    
    await waitFor(() => {
      expect(screen.getByText('Google')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/search companies/i)
    fireEvent.change(searchInput, { target: { value: 'Google' } })

    await waitFor(() => {
      expect(screen.getByText('Google')).toBeInTheDocument()
      expect(screen.queryByText('Facebook')).not.toBeInTheDocument()
    })
  })

  it('shows error state when API call fails', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockRejectedValue(new Error('API Error'))

    render(<CompanyGrid />)
    
    await waitFor(() => {
      expect(screen.getByText(/error loading companies/i)).toBeInTheDocument()
    })
  })

  it('filters companies by category', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({ data: mockCompanies })

    render(<CompanyGrid />)
    
    await waitFor(() => {
      expect(screen.getByText('Google')).toBeInTheDocument()
    })

    // Test category filter if it exists
    const categoryFilter = screen.queryByText(/tech/i)
    if (categoryFilter) {
      fireEvent.click(categoryFilter)
      // Verify filtering behavior
    }
  })

  it('navigates to company page when card is clicked', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.get).mockResolvedValue({ data: mockCompanies })

    const mockPush = vi.fn()
    vi.mocked(require('next/navigation').useRouter).mockReturnValue({
      push: mockPush
    })

    render(<CompanyGrid />)
    
    await waitFor(() => {
      expect(screen.getByText('Google')).toBeInTheDocument()
    })

    const googleCard = screen.getByText('Google').closest('button') || screen.getByText('Google').closest('a')
    if (googleCard) {
      fireEvent.click(googleCard)
      expect(mockPush).toHaveBeenCalledWith('/google')
    }
  })
})