import type { Company, DiffMeta, Summary } from '@inplain.ai/shared'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

export async function getCompanies(options?: {
  category?: string
  search?: string
  limit?: number
  active?: boolean
}): Promise<Company[]> {
  try {
    const params = new URLSearchParams()
    if (options?.category) params.append('category', options.category)
    if (options?.search) params.append('search', options.search)
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.active !== undefined) params.append('active', options.active.toString())
    
    const response = await fetch(`${API_BASE_URL}/companies?${params}`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch companies')
    }
    
    const data = await response.json()
    return data.companies || []
  } catch (error) {
    console.error('Error fetching companies:', error)
    // Fallback to basic companies if API fails
    return [
      { slug: 'google', name: 'Google', url: 'https://policies.google.com/privacy', active: true, checkInterval: 86400 },
      { slug: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/privacy/policy', active: true, checkInterval: 86400 },
      { slug: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496', active: true, checkInterval: 86400 },
      { slug: 'microsoft', name: 'Microsoft', url: 'https://privacy.microsoft.com/en-us/privacystatement', active: true, checkInterval: 86400 },
      { slug: 'apple', name: 'Apple', url: 'https://www.apple.com/legal/privacy/', active: true, checkInterval: 86400 }
    ]
  }
}

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/companies/${slug}`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch company')
    }
    
    const company = await response.json()
    return company
  } catch (error) {
    console.error('Error fetching company:', error)
    // Fallback to searching in the basic companies list
    const companies = await getCompanies()
    return companies.find(c => c.slug === slug) || null
  }
}

export async function getDiff(slug: string): Promise<{
  diff: DiffMeta
  htmlDiff: string
  fromSnapshot: { id: string; capturedAt: string }
  toSnapshot: { id: string; capturedAt: string }
} | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/diff/${slug}`, {
      next: { revalidate: 300 } // Cache for 5 minutes
    })
    
    if (!response.ok) {
      return null
    }
    
    return response.json()
  } catch (error) {
    console.error('Error fetching diff:', error)
    return null
  }
}

export async function getLatestDiffs(slug: string, limit = 10): Promise<DiffMeta[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/diff/${slug}/history?limit=${limit}`, {
      next: { revalidate: 300 } // Cache for 5 minutes
    })
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    return data.diffs || []
  } catch (error) {
    console.error('Error fetching diff history:', error)
    return []
  }
}

export async function getRecentDiffs(limit = 10): Promise<{
  diff: DiffMeta
  company: Company
}[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/diffs?limit=${limit}`, {
      next: { revalidate: 60 } // Cache for 1 minute
    })
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    return data.diffs
  } catch (error) {
    console.error('Error fetching recent diffs:', error)
    return []
  }
}

export async function getSummary(slug: string, diffId: string): Promise<Summary | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/summary/${slug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ diffId }),
      next: { revalidate: 3600 } // Cache for 1 hour
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.summary
  } catch (error) {
    console.error('Error fetching summary:', error)
    return null
  }
}