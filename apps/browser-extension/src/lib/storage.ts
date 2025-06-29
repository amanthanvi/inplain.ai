export interface CachedData<T> {
  data: T
  timestamp: number
  ttl: number
}

export class StorageManager {
  async getAPIKey(): Promise<string | null> {
    const result = await chrome.storage.sync.get('apiKey')
    return result.apiKey || null
  }

  async setAPIKey(apiKey: string): Promise<void> {
    await chrome.storage.sync.set({ apiKey })
  }

  async getCached<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key)
    const cached = result[key] as CachedData<T> | undefined
    
    if (!cached) {
      return null
    }

    // Check if cache is still valid
    const now = Date.now()
    if (now - cached.timestamp > cached.ttl) {
      // Cache expired, remove it
      await chrome.storage.local.remove(key)
      return null
    }

    return cached.data
  }

  async setCached<T>(key: string, data: T, ttl: number): Promise<void> {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    }
    
    await chrome.storage.local.set({ [key]: cached })
  }

  async clearCache(pattern?: string): Promise<void> {
    if (!pattern) {
      // Clear all cache
      await chrome.storage.local.clear()
      return
    }

    // Clear cache matching pattern
    const items = await chrome.storage.local.get()
    const keysToRemove = Object.keys(items).filter(key => {
      if (pattern.endsWith('*')) {
        return key.startsWith(pattern.slice(0, -1))
      }
      return key === pattern
    })

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove)
    }
  }

  async getSettings(): Promise<{
    notifications: boolean
    darkMode: boolean
    autoCheck: boolean
  }> {
    const defaults = {
      notifications: true,
      darkMode: false,
      autoCheck: true,
    }

    const result = await chrome.storage.sync.get('settings')
    return { ...defaults, ...(result.settings || {}) }
  }

  async updateSettings(settings: Partial<{
    notifications: boolean
    darkMode: boolean
    autoCheck: boolean
  }>): Promise<void> {
    const current = await this.getSettings()
    const updated = { ...current, ...settings }
    await chrome.storage.sync.set({ settings: updated })
  }

  async getRecentlyViewed(): Promise<Array<{
    domain: string
    timestamp: number
  }>> {
    const result = await chrome.storage.local.get('recentlyViewed')
    return result.recentlyViewed || []
  }

  async addRecentlyViewed(domain: string): Promise<void> {
    const recentlyViewed = await this.getRecentlyViewed()
    
    // Remove if already exists
    const filtered = recentlyViewed.filter(item => item.domain !== domain)
    
    // Add to beginning
    filtered.unshift({
      domain,
      timestamp: Date.now(),
    })

    // Keep only last 10
    const trimmed = filtered.slice(0, 10)
    
    await chrome.storage.local.set({ recentlyViewed: trimmed })
  }
}