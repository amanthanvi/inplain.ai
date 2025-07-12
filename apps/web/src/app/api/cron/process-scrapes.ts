/**
 * Process Scraped Data Cron Job
 * 
 * Processes data from the scraper's Redis queue and stores it in our storage system
 */

import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@/app/api/lib/kv-wrapper'
import { storage } from '@/lib/storage/adapter'
import { logger } from '@/lib/logger'
import { getUnifiedAIService } from '@/lib/ai/unified-ai-service'
import { HashUtils } from '@/lib/utils/hash'
import { formatTimestamp } from '@inplain.ai/shared'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting scrape processing job')

    // Get all snapshots from Redis
    const processedCount = await processSnapshots()
    
    // Process diff queue
    const diffsProcessed = await processDiffs()

    logger.info('Scrape processing completed', {
      snapshots: processedCount,
      diffs: diffsProcessed
    })

    return NextResponse.json({
      success: true,
      processed: {
        snapshots: processedCount,
        diffs: diffsProcessed
      }
    })
  } catch (error) {
    logger.error('Scrape processing error:', error)
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    )
  }
}

async function processSnapshots(): Promise<number> {
  let processed = 0
  
  try {
    // Get all company slugs
    const companies = await storage.company.list()
    
    for (const company of companies) {
      // Check for new snapshots in Redis
      const redisSnapshots = await kv.zrange(
        `snapshots:${company.slug}`,
        -10,
        -1 // Process last 10 snapshots
      )
      
      for (const snapshotKey of redisSnapshots || []) {
        if (typeof snapshotKey !== 'string') continue
        
        const snapshotData = await kv.get(snapshotKey)
        if (!snapshotData) continue
        
        const snapshot = JSON.parse(snapshotData as string)
        
        // Check if we already have this snapshot
        const existingSnapshot = await storage.snapshot.get(company.slug, snapshot.id)
        if (existingSnapshot) continue
        
        // Fetch content from blob storage if available
        let content = ''
        if (snapshot.blob_key) {
          try {
            const blobUrl = process.env.BLOB_STORAGE_URL || ''
            const response = await fetch(`${blobUrl}/${snapshot.blob_key}`)
            if (response.ok) {
              content = await response.text()
            }
          } catch (error) {
            logger.error('Failed to fetch blob content', { 
              blob_key: snapshot.blob_key,
              error 
            })
          }
        }
        
        // Store snapshot in our system
        await storage.snapshot.set(company.slug, {
          id: snapshot.id,
          slug: company.slug,
          url: snapshot.url,
          capturedAt: snapshot.captured_at,
          blobKey: snapshot.blob_key,
          contentHash: snapshot.content_hash,
          contentLength: snapshot.content_length,
          contentType: snapshot.content_type,
          headers: snapshot.headers,
          status: 'processed'
        })
        
        // Store content separately
        if (content) {
          await storage.setSnapshotContent(company.slug, snapshot.id, content)
        }
        
        processed++
        logger.info('Processed snapshot', {
          company: company.slug,
          snapshot_id: snapshot.id
        })
      }
    }
  } catch (error) {
    logger.error('Error processing snapshots:', error)
  }
  
  return processed
}

async function processDiffs(): Promise<number> {
  let processed = 0
  const aiService = getUnifiedAIService()
  
  try {
    // Process diff queue
    for (let i = 0; i < 100; i++) { // Process up to 100 diffs
      const diffJob = await kv.lrange('diff:queue', -1, -1)
      if (!diffJob || diffJob.length === 0) break
      
      // Remove from queue
      await kv.ltrim('diff:queue', 0, -2)
      
      const job = JSON.parse(diffJob[0] as string)
      
      // Get snapshots
      const fromSnapshot = await kv.get(job.from_snapshot)
      const toSnapshot = await kv.get(job.to_snapshot)
      
      if (!fromSnapshot || !toSnapshot) continue
      
      const from = JSON.parse(fromSnapshot as string)
      const to = JSON.parse(toSnapshot as string)
      
      // Get content for both snapshots
      const fromContent = await storage.getSnapshotContent(job.slug, from.id)
      const toContent = await storage.getSnapshotContent(job.slug, to.id)
      
      if (!fromContent || !toContent) continue
      
      // Calculate diff
      const { additions, deletions, htmlDiff } = calculateDiff(fromContent, toContent)
      
      // Determine change type
      const changeCount = additions + deletions
      let changeType: 'minor' | 'moderate' | 'major' = 'minor'
      if (changeCount > 1000) changeType = 'major'
      else if (changeCount > 100) changeType = 'moderate'
      
      // Store diff
      const diffId = uuidv4()
      const diff = {
        id: diffId,
        slug: job.slug,
        fromSnapshotId: from.id,
        toSnapshotId: to.id,
        createdAt: formatTimestamp(),
        changeCount,
        changeType,
        additions,
        deletions,
        diffBlobKey: `diffs/${job.slug}/${diffId}.html`
      }
      
      await storage.diff.set(job.slug, diff)
      await storage.setDiffContent(job.slug, diffId, { htmlDiff })
      
      // Generate AI summary
      try {
        const summaryResult = await aiService.analyze(
          `Analyze this privacy policy change:
          Additions: ${additions}
          Deletions: ${deletions}
          Change Type: ${changeType}
          
          Provide a clear summary of what changed and its impact on users.`,
          {
            task: 'differential',
            maxTokens: 500
          }
        )
        
        // Store summary
        const summary = {
          id: uuidv4(),
          diffId,
          createdAt: formatTimestamp(),
          model: summaryResult.model,
          prompt: 'AI-generated change analysis',
          summary: summaryResult.content,
          highlights: [],
          riskLevel: changeType === 'major' ? 'high' : changeType === 'moderate' ? 'medium' : 'low',
          categories: [],
          tokensUsed: summaryResult.tokensUsed.total
        }
        
        await kv.set(`summary:${diffId}`, JSON.stringify(summary), {
          ex: 86400 * 30 // 30 days
        })
      } catch (error) {
        logger.error('Failed to generate AI summary', { diffId, error })
      }
      
      processed++
      logger.info('Processed diff', {
        company: job.slug,
        diff_id: diffId,
        changes: changeCount
      })
    }
  } catch (error) {
    logger.error('Error processing diffs:', error)
  }
  
  return processed
}

function calculateDiff(fromContent: string, toContent: string): {
  additions: number
  deletions: number
  htmlDiff: string
} {
  // Simple diff calculation - in production, use a proper diff library
  const fromLines = fromContent.split('\n')
  const toLines = toContent.split('\n')
  
  let additions = 0
  let deletions = 0
  let htmlDiff = '<div class="diff">'
  
  // Count new lines
  const fromSet = new Set(fromLines)
  const toSet = new Set(toLines)
  
  for (const line of toLines) {
    if (!fromSet.has(line)) {
      additions++
      htmlDiff += `<div class="addition">+ ${escapeHtml(line)}</div>`
    }
  }
  
  for (const line of fromLines) {
    if (!toSet.has(line)) {
      deletions++
      htmlDiff += `<div class="deletion">- ${escapeHtml(line)}</div>`
    }
  }
  
  htmlDiff += '</div>'
  
  return { additions, deletions, htmlDiff }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}