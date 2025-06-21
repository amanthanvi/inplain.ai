import { kv } from '@vercel/kv'
import { put } from '@vercel/blob'
import { StorageClient } from '../lib/storage'
import { SnapshotMetaSchema, CrawlJobSchema } from '@policydiff/shared'
import { formatTimestamp, hashContent } from '@policydiff/shared'

const storage = new StorageClient()

interface CompanyRecord {
  slug: string
  name: string
  url: string
  checkInterval: number
  lastChecked?: string
  active: boolean
}

export async function monitorPolicies() {
  console.log('[Monitor] Starting policy monitoring job')
  
  try {
    const companies = await getActiveCompanies()
    console.log(`[Monitor] Found ${companies.length} active companies to check`)
    
    const results = await Promise.allSettled(
      companies.map(company => checkCompany(company))
    )
    
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    
    console.log(`[Monitor] Completed: ${successful} successful, ${failed} failed`)
    
    return {
      success: true,
      checked: companies.length,
      successful,
      failed,
      timestamp: formatTimestamp()
    }
  } catch (error) {
    console.error('[Monitor] Fatal error:', error)
    throw error
  }
}

async function getActiveCompanies(): Promise<CompanyRecord[]> {
  const companiesData = await kv.get<CompanyRecord[]>('companies:active')
  
  if (!companiesData || companiesData.length === 0) {
    const defaultCompanies: CompanyRecord[] = [
      { slug: 'google', name: 'Google', url: 'https://policies.google.com/privacy', checkInterval: 86400, active: true },
      { slug: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/privacy/policy', checkInterval: 86400, active: true },
      { slug: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496', checkInterval: 86400, active: true },
      { slug: 'microsoft', name: 'Microsoft', url: 'https://privacy.microsoft.com/en-us/privacystatement', checkInterval: 86400, active: true },
      { slug: 'apple', name: 'Apple', url: 'https://www.apple.com/legal/privacy/', checkInterval: 86400, active: true }
    ]
    
    await kv.set('companies:active', defaultCompanies)
    return defaultCompanies
  }
  
  return companiesData.filter(c => c.active && shouldCheck(c))
}

function shouldCheck(company: CompanyRecord): boolean {
  if (!company.lastChecked) return true
  
  const lastCheckedTime = new Date(company.lastChecked).getTime()
  const now = Date.now()
  const timeSinceCheck = now - lastCheckedTime
  
  return timeSinceCheck >= company.checkInterval * 1000
}

async function checkCompany(company: CompanyRecord): Promise<void> {
  console.log(`[Monitor] Checking ${company.name} at ${company.url}`)
  
  const jobId = crypto.randomUUID()
  const job = CrawlJobSchema.parse({
    id: jobId,
    slug: company.slug,
    url: company.url,
    status: 'running',
    createdAt: formatTimestamp(),
    startedAt: formatTimestamp(),
    retries: 0
  })
  
  await kv.set(`job:${jobId}`, job, { ex: 3600 })
  
  try {
    const content = await fetchPolicyContent(company.url)
    
    if (!content) {
      throw new Error('Failed to fetch content - received null')
    }
    
    if (content.length < 100) {
      throw new Error(`Content too short: ${content.length} characters`)
    }
    
    const contentHash = await hashContent(content)
    
    const latestSnapshots = await storage.getLatestSnapshots(company.slug, 1)
    const latestSnapshot = latestSnapshots[0]
    
    if (latestSnapshot && latestSnapshot.contentHash === contentHash) {
      console.log(`[Monitor] No changes detected for ${company.name}`)
      job.status = 'completed'
      job.completedAt = formatTimestamp()
      await kv.set(`job:${jobId}`, job, { ex: 3600 })
      return
    }
    
    console.log(`[Monitor] Changes detected for ${company.name}, saving snapshot`)
    
    const snapshotId = crypto.randomUUID()
    const blobKey = `snapshots/${company.slug}/${formatTimestamp()}.html`
    
    await put(blobKey, content, {
      access: 'public',
      contentType: 'text/html',
      addRandomSuffix: false
    })
    
    const snapshot = SnapshotMetaSchema.parse({
      id: snapshotId,
      slug: company.slug,
      url: company.url,
      capturedAt: formatTimestamp(),
      blobKey,
      contentHash,
      contentLength: content.length,
      contentType: 'html',
      headers: {},
      status: 'processed'
    })
    
    await storage.saveSnapshot(snapshot)
    
    if (latestSnapshot) {
      await kv.lpush('diff:queue', {
        slug: company.slug,
        fromSnapshotId: latestSnapshot.id,
        toSnapshotId: snapshotId,
        timestamp: formatTimestamp()
      })
    }
    
    company.lastChecked = formatTimestamp()
    const companies = await kv.get<CompanyRecord[]>('companies:active') || []
    const updatedCompanies = companies.map(c => 
      c.slug === company.slug ? company : c
    )
    await kv.set('companies:active', updatedCompanies)
    
    job.status = 'completed'
    job.completedAt = formatTimestamp()
    await kv.set(`job:${jobId}`, job, { ex: 3600 })
    
  } catch (error) {
    console.error(`[Monitor] Error checking ${company.name}:`, error)
    job.status = 'failed'
    job.error = error instanceof Error ? error.message : 'Unknown error'
    job.completedAt = formatTimestamp()
    await kv.set(`job:${jobId}`, job, { ex: 3600 })
    throw error
  }
}

async function fetchPolicyContent(url: string): Promise<string | null> {
  try {
    // Create a manual timeout using Promise.race for Edge Runtime compatibility
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    const response = await Promise.race([
      fetch(url, {
        headers: {
          'User-Agent': 'PolicyDiff/1.0 (https://policydiff.com; contact@policydiff.com)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      )
    ])
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error(`Unsupported content type: ${contentType}`)
    }
    
    const text = await response.text()
    console.log(`[Monitor] Successfully fetched ${url} - ${text.length} characters`)
    return text
  } catch (error) {
    console.error(`[Monitor] Fetch error for ${url}:`, error)
    return null
  }
}