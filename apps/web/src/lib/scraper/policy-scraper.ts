import { logger } from '@/lib/monitoring'

export interface ScrapedContent {
  text: string
  title?: string
  lastModified?: string
  contentLength?: number
}

export class PolicyScraper {
  async scrapePolicy(url: string): Promise<ScrapedContent | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'InPlain.AI Policy Monitor/1.0'
        }
      })
      
      if (!response.ok) {
        logger.error('Failed to fetch policy', { url, status: response.status })
        return null
      }
      
      const html = await response.text()
      
      // Extract text content (simple implementation)
      // In production, this would use a proper HTML parser
      const text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const title = titleMatch ? titleMatch[1]!.trim() : undefined
      
      return {
        text,
        title,
        contentLength: text.length,
        lastModified: response.headers.get('last-modified') || undefined
      }
    } catch (error) {
      logger.error('Policy scraping error', { error, url })
      return null
    }
  }
}

export const policyScraper = new PolicyScraper()