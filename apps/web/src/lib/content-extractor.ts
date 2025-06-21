import * as cheerio from 'cheerio'

export interface ExtractedContent {
  text: string
  title?: string
  sections: Section[]
  metadata: {
    lastUpdated?: string
    effectiveDate?: string
    wordCount: number
    characterCount: number
  }
}

export interface Section {
  title: string
  content: string
  level: number
}

export class ContentExtractor {
  private static readonly NOISE_SELECTORS = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'path',
    'nav',
    'header nav',
    'footer',
    '.footer',
    '.header',
    '.navigation',
    '.nav',
    '.menu',
    '.sidebar',
    '.advertisement',
    '.ads',
    '.cookie-banner',
    '.popup',
    '.modal',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[aria-hidden="true"]'
  ]

  private static readonly CONTENT_SELECTORS = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.policy-content',
    '.privacy-policy',
    '.legal-content',
    '#content',
    '.main-content',
    '.page-content',
    '.entry-content',
    '.post-content',
    '[itemtype*="Policy"]',
    'div[class*="policy"]',
    'div[class*="privacy"]',
    'div[class*="content"]'
  ]

  private static readonly DATE_PATTERNS = [
    /last\s+(?:updated|modified|revised)[\s:]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /effective\s+date[\s:]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(?:updated|modified|revised)\s+on[\s:]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /date[\s:]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
    /([A-Za-z]+\s+\d{4})/i
  ]

  static extract(html: string): ExtractedContent {
    const $ = cheerio.load(html)
    
    // Remove noise elements
    this.NOISE_SELECTORS.forEach(selector => {
      $(selector).remove()
    })

    // Find main content area
    let mainContent = ''
    for (const selector of this.CONTENT_SELECTORS) {
      const element = $(selector).first()
      if (element.length && element.text().trim().length > 500) {
        mainContent = element.html() || ''
        break
      }
    }

    // If no main content area found, use body
    if (!mainContent) {
      mainContent = $('body').html() || html
    }

    // Re-parse the main content
    const $content = cheerio.load(mainContent)

    // Extract title
    const title = this.extractTitle($, $content)

    // Extract sections
    const sections = this.extractSections($content)

    // Extract text content
    const text = this.extractCleanText($content)

    // Extract metadata
    const metadata = this.extractMetadata($, $content, text)

    return {
      text,
      title,
      sections,
      metadata
    }
  }

  private static extractTitle($: cheerio.CheerioAPI, $content: cheerio.CheerioAPI): string | undefined {
    // Try to find title in various places
    const titleCandidates = [
      $('h1').first().text(),
      $('title').text(),
      $content('h1').first().text(),
      $('meta[property="og:title"]').attr('content'),
      $('meta[name="title"]').attr('content')
    ]

    for (const candidate of titleCandidates) {
      if (candidate && candidate.trim().length > 0) {
        return candidate.trim()
      }
    }

    return undefined
  }

  private static extractSections($content: cheerio.CheerioAPI): Section[] {
    const sections: Section[] = []
    const headingSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
    
    headingSelectors.forEach((selector, level) => {
      $content(selector).each((_, element) => {
        const $heading = $content(element)
        const title = $heading.text().trim()
        
        if (title) {
          // Get content until next heading of same or higher level
          const content = this.getContentUntilNextHeading($content, $heading, level + 1)
          
          if (content.trim()) {
            sections.push({
              title,
              content: content.trim(),
              level: level + 1
            })
          }
        }
      })
    })

    // Sort sections by their appearance order
    return sections
  }

  private static getContentUntilNextHeading(
    $content: cheerio.CheerioAPI,
    $heading: cheerio.Cheerio<any>,
    level: number
  ): string {
    const higherLevelSelectors = Array.from({ length: level }, (_, i) => `h${i + 1}`).join(', ')
    let content = ''
    let $current = $heading.next()

    while ($current.length && !$current.is(higherLevelSelectors)) {
      content += $current.text() + ' '
      $current = $current.next()
    }

    return content
  }

  private static extractCleanText($content: cheerio.CheerioAPI): string {
    // Get text content
    let text = $content.text()

    // Clean up whitespace
    text = text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n\n') // Replace multiple newlines with double newline
      .trim()

    // Remove common boilerplate phrases
    const boilerplatePhrases = [
      /^Skip to main content/i,
      /^Cookie Settings/i,
      /^Accept All Cookies/i,
      /^Reject All/i,
      /^Privacy Settings/i,
      /^Menu$/i,
      /^Close$/i,
      /^Search$/i,
      /^Sign In$/i,
      /^Sign Up$/i
    ]

    boilerplatePhrases.forEach(phrase => {
      text = text.replace(phrase, '')
    })

    return text.trim()
  }

  private static extractMetadata(
    $: cheerio.CheerioAPI,
    $content: cheerio.CheerioAPI,
    text: string
  ): ExtractedContent['metadata'] {
    // Extract dates
    let lastUpdated: string | undefined
    let effectiveDate: string | undefined

    const fullText = $.text() + ' ' + $content.text()
    
    for (const pattern of this.DATE_PATTERNS) {
      const match = fullText.match(pattern)
      if (match && match[1]) {
        const dateStr = match[1].trim()
        if (pattern.toString().includes('effective')) {
          effectiveDate = dateStr
        } else {
          lastUpdated = dateStr
        }
        if (lastUpdated && effectiveDate) break
      }
    }

    // Calculate word and character counts
    const words = text.split(/\s+/).filter(word => word.length > 0)
    const wordCount = words.length
    const characterCount = text.length

    return {
      lastUpdated,
      effectiveDate,
      wordCount,
      characterCount
    }
  }

  static isPrivacyPolicy(text: string): boolean {
    const privacyKeywords = [
      'privacy policy',
      'privacy statement',
      'data protection',
      'personal information',
      'personal data',
      'data collection',
      'cookies',
      'gdpr',
      'ccpa',
      'data privacy',
      'information we collect',
      'how we use',
      'data retention',
      'your rights',
      'opt-out',
      'third parties'
    ]

    const lowerText = text.toLowerCase()
    const keywordCount = privacyKeywords.filter(keyword => 
      lowerText.includes(keyword)
    ).length

    // Consider it a privacy policy if it contains at least 3 privacy-related keywords
    return keywordCount >= 3
  }
}