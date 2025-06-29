import { caches } from './redis-cache'
import { logger } from '@/lib/monitoring'

// Type definitions (should match your actual types)
interface Company {
  id?: string
  name: string
  slug: string
  url: string
  category?: string
  description?: string
  lastChecked?: string | null
  status?: string
}

interface Policy {
  id: string
  companyId: string
  name: string
  url: string
  content?: string
  lastUpdated?: string
}

const COMPANY_TTL = 3600 // 1 hour
const POLICY_TTL = 3600 // 1 hour
const SEARCH_TTL = 600 // 10 minutes

export class CompanyCache {
  /**
   * Cache a company by slug
   */
  static async setCompany(slug: string, company: Company): Promise<void> {
    await caches.data.set(
      `company:${slug}`,
      company,
      {
        ttl: COMPANY_TTL,
        tags: ['company', `company:${slug}`],
        staleWhileRevalidate: 300, // Serve stale for 5 minutes while revalidating
      }
    )
  }

  /**
   * Get a company by slug
   */
  static async getCompany(slug: string): Promise<Company | null> {
    return caches.data.get<Company>(`company:${slug}`)
  }

  /**
   * Cache company policies
   */
  static async setCompanyPolicies(slug: string, policies: Policy[]): Promise<void> {
    await caches.data.set(
      `company:${slug}:policies`,
      policies,
      {
        ttl: POLICY_TTL,
        tags: ['policies', `company:${slug}`],
        staleWhileRevalidate: 300,
      }
    )
  }

  /**
   * Get company policies
   */
  static async getCompanyPolicies(slug: string): Promise<Policy[] | null> {
    return caches.data.get<Policy[]>(`company:${slug}:policies`)
  }

  /**
   * Cache a specific policy
   */
  static async setPolicy(id: string, policy: Policy): Promise<void> {
    await caches.data.set(
      `policy:${id}`,
      policy,
      {
        ttl: POLICY_TTL,
        tags: ['policy', `policy:${id}`, `company:${policy.companyId}`],
        staleWhileRevalidate: 300,
      }
    )
  }

  /**
   * Get a specific policy
   */
  static async getPolicy(id: string): Promise<Policy | null> {
    return caches.data.get<Policy>(`policy:${id}`)
  }

  /**
   * Cache search results
   */
  static async setSearchResults(
    query: string,
    filters: Record<string, any>,
    results: Company[]
  ): Promise<void> {
    const key = this.getSearchKey(query, filters)
    await caches.search.set(
      key,
      results,
      {
        ttl: SEARCH_TTL,
        tags: ['search', 'companies'],
      }
    )
  }

  /**
   * Get search results
   */
  static async getSearchResults(
    query: string,
    filters: Record<string, any>
  ): Promise<Company[] | null> {
    const key = this.getSearchKey(query, filters)
    return caches.search.get<Company[]>(key)
  }

  /**
   * Invalidate company cache
   */
  static async invalidateCompany(slug: string): Promise<void> {
    await caches.data.invalidateByTags([`company:${slug}`])
    logger.info('Company cache invalidated', { slug })
  }

  /**
   * Invalidate all search results
   */
  static async invalidateSearchResults(): Promise<void> {
    await caches.search.invalidateByTags(['search'])
    logger.info('Search cache invalidated')
  }

  /**
   * Warm up cache for a company
   */
  static async warmupCompany(slug: string): Promise<void> {
    try {
      // This would fetch from database and cache
      // Implementation depends on your data layer
      logger.info('Company cache warmed up', { slug })
    } catch (error) {
      logger.error('Company cache warmup failed', { error, slug })
    }
  }

  /**
   * Generate cache key for search
   */
  private static getSearchKey(query: string, filters: Record<string, any>): string {
    const sortedFilters = Object.keys(filters)
      .sort()
      .reduce((acc, key) => {
        acc[key] = filters[key]
        return acc
      }, {} as Record<string, any>)

    return `search:${query}:${JSON.stringify(sortedFilters)}`
  }
}

// Export convenience functions
export const companyCache = {
  get: CompanyCache.getCompany,
  set: CompanyCache.setCompany,
  getPolicies: CompanyCache.getCompanyPolicies,
  setPolicies: CompanyCache.setCompanyPolicies,
  getPolicy: CompanyCache.getPolicy,
  setPolicy: CompanyCache.setPolicy,
  invalidate: CompanyCache.invalidateCompany,
  warmup: CompanyCache.warmupCompany,
}

export const searchCache = {
  get: CompanyCache.getSearchResults,
  set: CompanyCache.setSearchResults,
  invalidate: CompanyCache.invalidateSearchResults,
}