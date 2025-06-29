import { StorageManager } from './storage'

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000/api/v1'
  : 'https://inplain.ai/api/v1'

export interface Company {
  slug: string
  name: string
  description: string
  category: string
  website: string
  privacyPolicyUrl: string
  lastChecked: string
  metadata: {
    headquarters?: string
    founded?: string
    employees?: string
  }
}

export interface PrivacyScore {
  score: number
  breakdown: {
    dataCollection: number
    dataSharing: number
    userRights: number
    security: number
    retention: number
  }
  lastUpdated: string
}

export interface PolicyChange {
  id: string
  type: 'addition' | 'deletion' | 'modification'
  section: string
  summary: string
  severity: 'low' | 'medium' | 'high'
  date: string
}

export interface PolicySummary {
  summary: string
  keyPoints: string[]
  concerns: string[]
  lastAnalyzed: string
}

class APIClient {
  private storage = new StorageManager()

  private async getHeaders(): Promise<HeadersInit> {
    const apiKey = await this.storage.getAPIKey()
    if (!apiKey) {
      throw new Error('API key not configured')
    }

    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    }
  }

  private async fetchWithCache<T>(
    url: string,
    cacheKey: string,
    ttl: number = 3600000 // 1 hour default
  ): Promise<T> {
    // Check cache first
    const cached = await this.storage.getCached<T>(cacheKey)
    if (cached) {
      return cached
    }

    // Fetch from API
    const headers = await this.getHeaders()
    const response = await fetch(`${API_BASE_URL}${url}`, { headers })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // Cache the result
    await this.storage.setCached(cacheKey, data.data || data, ttl)
    
    return data.data || data
  }

  async getCompanyByDomain(domain: string): Promise<Company | null> {
    try {
      // Extract main domain from URL
      const mainDomain = this.extractMainDomain(domain)
      const cacheKey = `company:${mainDomain}`
      
      return await this.fetchWithCache<Company>(
        `/companies/${mainDomain}`,
        cacheKey,
        86400000 // 24 hours
      )
    } catch (error) {
      console.error('Failed to fetch company:', error)
      return null
    }
  }

  async getPrivacyScore(slug: string): Promise<PrivacyScore | null> {
    try {
      const cacheKey = `score:${slug}`
      return await this.fetchWithCache<PrivacyScore>(
        `/companies/${slug}/score`,
        cacheKey,
        3600000 // 1 hour
      )
    } catch (error) {
      console.error('Failed to fetch privacy score:', error)
      return null
    }
  }

  async getRecentChanges(slug: string, limit: number = 5): Promise<PolicyChange[]> {
    try {
      const cacheKey = `changes:${slug}:${limit}`
      return await this.fetchWithCache<PolicyChange[]>(
        `/companies/${slug}/changes?limit=${limit}`,
        cacheKey,
        1800000 // 30 minutes
      )
    } catch (error) {
      console.error('Failed to fetch recent changes:', error)
      return []
    }
  }

  async getPolicySummary(slug: string): Promise<PolicySummary | null> {
    try {
      const cacheKey = `summary:${slug}`
      return await this.fetchWithCache<PolicySummary>(
        `/summary/${slug}`,
        cacheKey,
        86400000 // 24 hours
      )
    } catch (error) {
      console.error('Failed to fetch policy summary:', error)
      return null
    }
  }

  async addToWatchlist(slug: string): Promise<boolean> {
    try {
      const headers = await this.getHeaders()
      const response = await fetch(`${API_BASE_URL}/user/watchlist`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ companySlug: slug }),
      })

      if (!response.ok) {
        throw new Error(`Failed to add to watchlist: ${response.status}`)
      }

      // Clear watchlist cache
      await this.storage.clearCache('watchlist:*')
      
      return true
    } catch (error) {
      console.error('Failed to add to watchlist:', error)
      return false
    }
  }

  async removeFromWatchlist(slug: string): Promise<boolean> {
    try {
      const headers = await this.getHeaders()
      const response = await fetch(`${API_BASE_URL}/user/watchlist`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ companySlug: slug }),
      })

      if (!response.ok) {
        throw new Error(`Failed to remove from watchlist: ${response.status}`)
      }

      // Clear watchlist cache
      await this.storage.clearCache('watchlist:*')
      
      return true
    } catch (error) {
      console.error('Failed to remove from watchlist:', error)
      return false
    }
  }

  async getWatchlist(): Promise<string[]> {
    try {
      const cacheKey = 'watchlist:items'
      const cached = await this.storage.getCached<string[]>(cacheKey)
      if (cached) {
        return cached
      }

      const headers = await this.getHeaders()
      const response = await fetch(`${API_BASE_URL}/user/watchlist`, { headers })

      if (!response.ok) {
        throw new Error(`Failed to fetch watchlist: ${response.status}`)
      }

      const data = await response.json()
      const watchlist = data.data || []
      
      await this.storage.setCached(cacheKey, watchlist, 300000) // 5 minutes
      
      return watchlist
    } catch (error) {
      console.error('Failed to fetch watchlist:', error)
      return []
    }
  }

  private extractMainDomain(url: string): string {
    try {
      // Handle cases where we already have just a domain
      if (!url.includes('://')) {
        url = 'https://' + url
      }
      
      const urlObj = new URL(url)
      const hostname = urlObj.hostname
      
      // Remove www. prefix
      const domain = hostname.replace(/^www\./, '')
      
      // Extract the main part of the domain (e.g., 'google' from 'google.com')
      const parts = domain.split('.')
      if (parts.length >= 2) {
        // Handle common TLDs and subdomains
        return parts[parts.length - 2]
      }
      
      return domain
    } catch (error) {
      console.error('Failed to extract domain:', error)
      return url
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const headers = await this.getHeaders()
      const response = await fetch(`${API_BASE_URL}/health`, { headers })
      return response.ok
    } catch (error) {
      console.error('API connection test failed:', error)
      return false
    }
  }
}

export const apiClient = new APIClient()