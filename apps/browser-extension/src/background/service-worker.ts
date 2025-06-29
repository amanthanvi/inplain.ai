import { apiClient } from '../lib/api'
import { StorageManager } from '../lib/storage'

const storage = new StorageManager()

// Set up alarm for periodic checks
chrome.runtime.onInstalled.addListener(() => {
  // Create alarm for checking policy updates every 6 hours
  chrome.alarms.create('checkPolicyUpdates', {
    periodInMinutes: 360
  })
})

// Handle alarm events
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkPolicyUpdates') {
    await checkWatchlistUpdates()
  }
})

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender).then(sendResponse)
  return true // Keep the message channel open for async response
})

async function handleMessage(request: any, sender: chrome.runtime.MessageSender) {
  switch (request.type) {
    case 'GET_CURRENT_DOMAIN':
      const tab = sender.tab || (await getCurrentTab())
      if (tab?.url) {
        const url = new URL(tab.url)
        return { domain: url.hostname }
      }
      return { domain: null }

    case 'CHECK_PRIVACY_POLICY':
      return await checkPrivacyPolicy(request.domain)

    case 'GET_PRIVACY_SCORE':
      return await apiClient.getPrivacyScore(request.slug)

    case 'GET_RECENT_CHANGES':
      return await apiClient.getRecentChanges(request.slug, request.limit)

    case 'GET_POLICY_SUMMARY':
      return await apiClient.getPolicySummary(request.slug)

    case 'ADD_TO_WATCHLIST':
      return await apiClient.addToWatchlist(request.slug)

    case 'REMOVE_FROM_WATCHLIST':
      return await apiClient.removeFromWatchlist(request.slug)

    case 'GET_WATCHLIST':
      return await apiClient.getWatchlist()

    case 'OPEN_OPTIONS':
      chrome.runtime.openOptionsPage()
      return { success: true }

    case 'TEST_CONNECTION':
      return await apiClient.testConnection()

    default:
      return { error: 'Unknown message type' }
  }
}

async function getCurrentTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function checkPrivacyPolicy(domain: string) {
  try {
    const company = await apiClient.getCompanyByDomain(domain)
    if (company) {
      // Track recently viewed
      await storage.addRecentlyViewed(domain)
      
      return {
        success: true,
        company,
      }
    }
    
    return {
      success: false,
      message: 'Company not found in our database',
    }
  } catch (error) {
    console.error('Failed to check privacy policy:', error)
    return {
      success: false,
      message: 'Failed to fetch privacy information',
    }
  }
}

async function checkWatchlistUpdates() {
  const settings = await storage.getSettings()
  if (!settings.notifications) {
    return
  }

  try {
    const watchlist = await apiClient.getWatchlist()
    
    for (const slug of watchlist) {
      const changes = await apiClient.getRecentChanges(slug, 1)
      
      if (changes.length > 0) {
        const latestChange = changes[0]
        const lastCheck = await storage.getCached<string>(`lastCheck:${slug}`)
        
        if (!lastCheck || new Date(latestChange.date) > new Date(lastCheck)) {
          // New change detected
          const company = await apiClient.getCompanyByDomain(slug)
          
          if (company) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: '/public/icons/icon-128.png',
              title: 'Privacy Policy Update',
              message: `${company.name} has updated their privacy policy`,
              priority: 2,
            })
            
            // Update last check time
            await storage.setCached(`lastCheck:${slug}`, latestChange.date, Infinity)
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to check watchlist updates:', error)
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  // The popup will handle this, but we can add badge updates here
  if (tab.url) {
    const url = new URL(tab.url)
    const company = await apiClient.getCompanyByDomain(url.hostname)
    
    if (company) {
      // Update badge to show we have info
      chrome.action.setBadgeText({ text: '✓', tabId: tab.id })
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId: tab.id })
    }
  }
})

// Listen for tab updates to clear badges
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId })
  }
})

// Handle notifications click
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.tabs.create({ url: 'https://inplain.ai/watchlist' })
})