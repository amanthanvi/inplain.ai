import { NextRequest, NextResponse } from 'next/server'
import { StorageClient } from '../../lib/storage'

const storage = new StorageClient()

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }
      
      sendEvent({ type: 'connected', timestamp: new Date().toISOString() })
      
      const interval = setInterval(async () => {
        try {
          const companies = ['google', 'facebook', 'amazon', 'microsoft', 'apple']
          
          for (const slug of companies) {
            const diffs = await storage.getLatestDiffs(slug, 1)
            
            if (diffs.length > 0) {
              const diff = diffs[0]
              // Type guard to ensure diff is defined
              if (!diff) continue
              
              const summary = diff.summaryId ? await storage.getSummary(diff.summaryId) : null
              
              sendEvent({
                type: 'diff',
                slug,
                diff: {
                  id: diff.id,
                  createdAt: diff.createdAt,
                  changeType: diff.changeType,
                  additions: diff.additions,
                  deletions: diff.deletions
                },
                summary: summary ? {
                  summary: summary.summary,
                  riskLevel: summary.riskLevel
                } : null
              })
            }
          }
        } catch (error) {
          console.error('Feed error:', error)
          sendEvent({ type: 'error', message: 'Failed to fetch updates' })
        }
      }, 30000)
      
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })
  
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}