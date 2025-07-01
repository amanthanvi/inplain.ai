import { logger } from '@/lib/logger'
import { retryFetch } from '@/lib/utils/retry'

export interface ScrapedContent {
  text: string
  title?: string
  lastModified?: string
  contentLength?: number
}

export class PolicyScraper {
  async scrapePolicy(url: string): Promise<ScrapedContent | null> {
    try {
      // Use retry logic for resilient scraping
      const { result: response } = await retryFetch(url, {
        headers: {
          'User-Agent': 'InPlain.AI Policy Monitor/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
        // Note: timeout is handled by retry logic
      }, {
        maxAttempts: 3,
        initialDelay: 2000,
        maxDelay: 10000,
        onRetry: (attempt, error, delay) => {
          logger.warn(`Policy scraping retry attempt ${attempt}`, { 
            url, 
            error: error.message, 
            delay 
          })
        }
      })
      
      const html = await response.text()
      
      // Validate minimum content length
      if (html.length < 100) {
        logger.warn('Policy content too short, might be invalid', { url, length: html.length })
        return null
      }
      
      // Extract text content with improved parsing
      const text = this.extractTextContent(html)
      
      // Validate extracted text
      if (text.length < 50) {
        logger.warn('Extracted text too short, might be invalid', { url, length: text.length })
        return null
      }
      
      // Extract title with fallback methods
      const title = this.extractTitle(html)
      
      return {
        text,
        title,
        contentLength: text.length,
        lastModified: response.headers.get('last-modified') || undefined
      }
    } catch (error) {
      logger.error('Policy scraping failed after retries', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        url 
      })
      return null
    }
  }

  /**
   * Extract clean text content from HTML with improved parsing
   */
  private extractTextContent(html: string): string {
    // Remove script and style elements completely
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    
    // Remove comments
    text = text.replace(/<!--[\s\S]*?-->/g, '')
    
    // Replace block elements with line breaks to preserve structure
    text = text.replace(/<\/(div|p|h[1-6]|li|section|article|header|footer|nav)\s*>/gi, '\n')
    text = text.replace(/<(br|hr)\s*\/?>/gi, '\n')
    
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ')
    
    // Decode HTML entities
    text = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&ldquo;/gi, '"')
      .replace(/&rdquo;/gi, '"')
      .replace(/&lsquo;/gi, "'")
      .replace(/&rsquo;/gi, "'")
    
    // Clean up whitespace
    text = text
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .replace(/[ \t]+/g, ' ') // Normalize spaces
      .replace(/\n /g, '\n') // Remove space at start of lines
      .trim()
    
    return text
  }

  /**
   * Extract title with multiple fallback methods
   */
  private extractTitle(html: string): string | undefined {
    // Try standard title tag first
    let titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim()
    }
    
    // Try og:title meta tag
    titleMatch = html.match(/<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i)
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim()
    }
    
    // Try twitter:title meta tag
    titleMatch = html.match(/<meta[^>]*name=["\']twitter:title["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i)
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim()
    }
    
    // Try h1 tag as fallback
    titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (titleMatch && titleMatch[1]) {
      const h1Text = titleMatch[1].replace(/<[^>]+>/g, '').trim()
      if (h1Text.length > 0 && h1Text.length < 200) {
        return h1Text
      }
    }
    
    return undefined
  }

  /**
   * Check if content appears to be a valid privacy policy
   */
  isValidPrivacyPolicy(content: string): boolean {
    const privacyKeywords = [
      'privacy', 'personal information', 'data collection', 
      'cookies', 'tracking', 'third party', 'sharing',
      'retention', 'security', 'rights', 'consent'
    ]
    
    const lowerContent = content.toLowerCase()
    const keywordMatches = privacyKeywords.filter(keyword => 
      lowerContent.includes(keyword)
    ).length
    
    // Should contain at least 4 privacy-related keywords
    return keywordMatches >= 4 && content.length >= 500
  }
}

export const policyScraper = new PolicyScraper()