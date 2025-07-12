import { kv } from '@vercel/kv'
import { StorageClient } from '../lib/storage'
import { SnapshotMetaSchema, CrawlJobSchema } from '@inplain.ai/shared'
import { formatTimestamp, hashContent } from '@inplain.ai/shared'
import { WatchlistService } from '@/lib/watchlist'
import { getUnifiedAIService } from '@/lib/ai/unified-ai-service'
import { notifyPolicyChange, notifyRiskAlert } from '@/lib/notifications/monitoring-integration'

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
    const fetchedContent = await fetchPolicyContent(company.url)
    console.log(`[Monitor] Fetch completed for ${company.name}, content: ${fetchedContent ? fetchedContent.length + ' chars' : 'null'}`)
    
    if (!fetchedContent) {
      throw new Error('Failed to fetch content - received null')
    }
    
    if (fetchedContent.length < 100) {
      throw new Error(`Content too short: ${fetchedContent.length} characters`)
    }
    
    const contentHash = await hashContent(fetchedContent)
    
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
    
    // Store content in KV with proper chunking for large content
    // KV has a 512KB limit per value, so we'll store large content in chunks
    const maxChunkSize = 400000 // Leave some buffer for metadata
    
    if (fetchedContent.length > maxChunkSize) {
      console.log(`[Monitor] Content size ${fetchedContent.length} bytes requires chunking`)
      
      // Split content into chunks
      const chunks: string[] = []
      let offset = 0
      let chunkIndex = 0
      
      while (offset < fetchedContent.length) {
        const chunkEnd = Math.min(offset + maxChunkSize, fetchedContent.length)
        const chunk = fetchedContent.substring(offset, chunkEnd)
        chunks.push(chunk)
        
        // Store each chunk with numbered key
        const chunkKey = `${contentKey}:chunk:${chunkIndex}`
        await kv.set(chunkKey, chunk, { ex: 30 * 24 * 60 * 60 }) // 30 days TTL
        
        offset = chunkEnd
        chunkIndex++
      }
      
      // Store metadata about chunks
      const chunkMetadata = {
        totalChunks: chunks.length,
        totalSize: fetchedContent.length,
        chunkSize: maxChunkSize,
        chunkedAt: timestamp
      }
      await kv.set(`${contentKey}:meta`, JSON.stringify(chunkMetadata), { ex: 30 * 24 * 60 * 60 })
      
      console.log(`[Monitor] Stored content in ${chunks.length} chunks for ${company.name}`)
    } else {
      // Store content normally for smaller content
      await kv.set(contentKey, fetchedContent, { ex: 30 * 24 * 60 * 60 }) // 30 days TTL
    }
    
    const snapshot = SnapshotMetaSchema.parse({
      id: snapshotId,
      slug: company.slug,
      url: company.url,
      capturedAt: timestamp,
      blobKey: contentKey, // Using KV key instead of blob key
      contentHash,
      contentLength: fetchedContent.length, // Always store the actual content length
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
      
      // Analyze the change and trigger watchlist alerts
      try {
        console.log(`[Monitor] Analyzing changes for watchlist alerts...`)
        const previousContent = await storage.getSnapshotContent(latestSnapshot.blobKey)
        
        if (previousContent && previousContent.length > 100) {
          // Quick analysis to determine change severity
          const changeType = await analyzeChangeSeverity(previousContent, fetchedContent)
          const summary = await generateChangeSummary(company.slug, previousContent, fetchedContent)
          
          // Process watchlist alerts
          await WatchlistService.processChangeForWatchlists(
            company.slug,
            changeType,
            summary,
            {
              previousSnapshotId: latestSnapshot.id,
              currentSnapshotId: snapshotId,
              timestamp: formatTimestamp(),
              contentLengthChange: fetchedContent.length - previousContent.length
            }
          )
          
          console.log(`[Monitor] Watchlist alerts processed for ${company.slug}`)
          
          // Send notifications for policy changes
          await notifyPolicyChange({
            companySlug: company.slug,
            companyName: company.name,
            policyType: 'privacy',
            changeType: changeType === 'critical' ? 'major' : changeType === 'significant' ? 'moderate' : 'minor',
            summary,
            riskLevel: changeType === 'critical' ? 'high' : changeType === 'significant' ? 'medium' : 'low',
            detectedAt: formatTimestamp(),
            diffUrl: `/${company.slug}`
          })
          
          // Send risk alert for critical changes
          if (changeType === 'critical') {
            await notifyRiskAlert({
              companySlug: company.slug,
              companyName: company.name,
              alertType: 'data-collection',
              severity: 'critical',
              description: `Critical privacy policy changes detected that may impact your data privacy`,
              affectedSections: [],
              detectedAt: formatTimestamp()
            })
          }
        }
      } catch (error) {
        console.error(`[Monitor] Error processing watchlist alerts:`, error)
        // Don't throw - we still want to save the snapshot even if alerts fail
      }
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

async function analyzeChangeSeverity(
  previousContent: string,
  currentContent: string
): Promise<'minor' | 'significant' | 'critical'> {
  // Simple heuristic based on content length change
  const lengthChange = Math.abs(currentContent.length - previousContent.length);
  const percentChange = lengthChange / previousContent.length;
  
  // Look for critical keywords
  const criticalKeywords = [
    'data breach', 'security incident', 'third party', 'sell', 'share',
    'advertising', 'tracking', 'cookies', 'personal information'
  ];
  
  const currentLower = currentContent.toLowerCase();
  const previousLower = previousContent.toLowerCase();
  
  let criticalChanges = 0;
  for (const keyword of criticalKeywords) {
    const prevCount = (previousLower.match(new RegExp(keyword, 'g')) || []).length;
    const currCount = (currentLower.match(new RegExp(keyword, 'g')) || []).length;
    if (currCount !== prevCount) criticalChanges++;
  }
  
  if (criticalChanges >= 3 || percentChange > 0.5) {
    return 'critical';
  } else if (criticalChanges >= 1 || percentChange > 0.2) {
    return 'significant';
  } else {
    return 'minor';
  }
}

async function generateChangeSummary(
  companySlug: string,
  previousContent: string,
  currentContent: string
): Promise<string> {
  try {
    // Use unified AI service for smarter summary
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) {
      const aiService = getUnifiedAIService();
      const diffContent = `Previous version (excerpt): ${previousContent.substring(0, 1000)}...
      
Current version (excerpt): ${currentContent.substring(0, 1000)}...`;

      const result = await aiService.analyze(diffContent, {
        task: 'differential',
        useTools: true,
        useThinking: true,
        maxTokens: 200,
        temperature: 0.3
      });
      
      // Extract summary from structured result
      if (result.content && typeof result.content === 'object' && 'summary' in result.content) {
        return result.content.summary || 'Privacy policy updated';
      } else if (typeof result.content === 'string') {
        return result.content;
      }
    }
  } catch (error) {
    console.error('Error generating AI summary:', error);
  }
  
  // Fallback to simple summary
  const lengthChange = currentContent.length - previousContent.length;
  if (lengthChange > 0) {
    return `Privacy policy expanded by ${Math.abs(lengthChange)} characters`;
  } else if (lengthChange < 0) {
    return `Privacy policy shortened by ${Math.abs(lengthChange)} characters`;
  } else {
    return `Privacy policy updated with structural changes`;
  }
}

async function fetchPolicyContent(url: string): Promise<string | null> {
  try {
    console.log(`[Monitor] Starting fetch with retry for ${url}`)
    
    const fetchOptions = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Inplain.AI/1.0; +https://inplain.ai)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      redirect: 'follow' as RequestRedirect
    }
    
    // Import retry utility dynamically to handle Edge runtime
    const { retryFetch } = await import('@/lib/utils/retry')
    
    const { result: response, attempts, totalTime } = await retryFetch(url, fetchOptions, {
      maxAttempts: 3,
      initialDelay: 2000,
      maxDelay: 15000,
      onRetry: (attempt, error, delay) => {
        console.warn(`[Monitor] Fetch retry attempt ${attempt} for ${url}`, {
          error: error.message,
          delay,
          url
        })
      }
    })
    
    console.log(`[Monitor] Fetch successful after ${attempts} attempts in ${totalTime}ms:`, {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      redirected: response.redirected,
      contentType: response.headers.get('content-type')
    })
    
    const text = await response.text()
    console.log(`[Monitor] Text received: ${text.length} characters`)
    
    if (text.length === 0) {
      throw new Error('Received empty response body')
    }
    
    // Validate content appears to be HTML/text
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) {
      console.warn(`[Monitor] Unexpected content type for ${url}: ${contentType}`)
    }
    
    // Log first 200 chars for debugging (reduced to avoid log spam)
    console.log(`[Monitor] Content preview: ${text.substring(0, 200)}...`)
    
    return text
  } catch (error) {
    // Enhanced error logging with retry context
    console.error(`[Monitor] Policy fetch failed after retries for ${url}:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      url,
      timestamp: new Date().toISOString()
    })
    return null
  }
}