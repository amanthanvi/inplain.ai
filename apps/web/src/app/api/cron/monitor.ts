import { kv } from '@vercel/kv'
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
    
    // Log detailed results
    results.forEach((result, index) => {
      const company = companies[index]
      if (!company) return
      
      if (result.status === 'rejected') {
        console.error(`[Monitor] Failed to check ${company.name}:`, result.reason)
      } else {
        console.log(`[Monitor] Successfully checked ${company.name}`)
      }
    })
    
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    
    console.log(`[Monitor] Completed: ${successful} successful, ${failed} failed`)
    
    return {
      success: true,
      checked: companies.length,
      successful,
      failed,
      timestamp: formatTimestamp(),
      // Include first error for debugging
      firstError: results.find(r => r.status === 'rejected')?.reason?.toString()
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
    console.log(`[Monitor] About to fetch content for ${company.name}`)
    const content = await fetchPolicyContent(company.url)
    console.log(`[Monitor] Fetch completed for ${company.name}, content: ${content ? content.length + ' chars' : 'null'}`)
    
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
    const timestamp = formatTimestamp()
    const contentKey = `content:${company.slug}:${snapshotId}`
    
    // Store content in KV instead of blob for now
    // KV has a 512KB limit per value, so we'll store large content in chunks if needed
    if (content.length > 400000) {
      console.warn(`[Monitor] Content too large for single KV entry (${content.length} bytes), truncating...`)
      content = content.substring(0, 400000)
    }
    
    await kv.set(contentKey, content, { ex: 30 * 24 * 60 * 60 }) // 30 days TTL
    
    const snapshot = SnapshotMetaSchema.parse({
      id: snapshotId,
      slug: company.slug,
      url: company.url,
      capturedAt: timestamp,
      blobKey: contentKey, // Using KV key instead of blob key
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
    console.log(`[Monitor] Starting fetch for ${url}`)
    
    // Log the fetch attempt details
    const fetchOptions = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PolicyDiff/1.0; +https://policydiff.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      redirect: 'follow' as RequestRedirect,
      // Remove compression to avoid potential Edge Runtime issues
      // 'Accept-Encoding': 'gzip, deflate, br' removed
    }
    
    console.log(`[Monitor] Fetch options:`, JSON.stringify(fetchOptions, null, 2))
    
    const response = await fetch(url, fetchOptions)
    
    console.log(`[Monitor] Response received:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      url: response.url,
      redirected: response.redirected
    })
    
    if (!response.ok) {
      console.error(`[Monitor] HTTP error for ${url}: ${response.status} ${response.statusText}`)
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const contentType = response.headers.get('content-type') || ''
    console.log(`[Monitor] Content-Type: ${contentType}`)
    
    const text = await response.text()
    console.log(`[Monitor] Text received: ${text.length} characters`)
    
    if (text.length === 0) {
      throw new Error('Received empty response body')
    }
    
    // Log first 500 chars for debugging
    console.log(`[Monitor] Content preview: ${text.substring(0, 500)}...`)
    
    return text
  } catch (error) {
    // More detailed error logging
    console.error(`[Monitor] Detailed fetch error for ${url}:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    })
    return null
  }
}