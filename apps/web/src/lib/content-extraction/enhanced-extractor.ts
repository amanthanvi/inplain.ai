/**
 * Enhanced Content Extractor for Inplain.AI
 * Phase 2: Robust content extraction with fallback strategies
 */

import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'
import * as cheerio from 'cheerio'
import { decode } from 'html-entities'

export interface ExtractedContent {
  text: string
  markdown: string
  title: string
  metadata: {
    lastUpdated?: string
    effectiveDate?: string
    version?: string
    author?: string
    language: string
    wordCount: number
    readingTime: number // in minutes
    sections: Section[]
    links: Link[]
    dates: ExtractedDate[]
  }
  quality: {
    score: number // 0-100
    issues: string[]
    confidence: 'high' | 'medium' | 'low'
  }
}

export interface Section {
  title: string
  level: number // h1=1, h2=2, etc.
  content: string
  wordCount: number
  id: string
}

export interface Link {
  text: string
  href: string
  type: 'internal' | 'external' | 'email' | 'tel'
}

export interface ExtractedDate {
  text: string
  date: string // ISO format
  type: 'effective' | 'updated' | 'published' | 'unknown'
  confidence: number // 0-1
}

export class EnhancedContentExtractor {
  private static turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced'
  })

  // Selectors for finding main content, ordered by priority
  private static CONTENT_SELECTORS = [
    // Specific privacy/legal containers
    'main[role="main"]',
    'article[class*="privacy"]',
    'article[class*="policy"]',
    'article[class*="legal"]',
    'div[class*="privacy-policy"]',
    'div[class*="policy-content"]',
    'div[class*="legal-content"]',
    'div[id*="privacy"]',
    'div[id*="policy"]',
    'section[class*="privacy"]',
    'section[class*="policy"]',
    // Generic content containers
    'article',
    'main',
    '[role="main"]',
    '.main-content',
    '.content-wrapper',
    '#content',
    '.container > .content',
    // Fallback
    'body'
  ]

  // Elements to remove from content
  private static REMOVE_SELECTORS = [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    'iframe',
    '.nav',
    '.navigation',
    '.menu',
    '.sidebar',
    '.advertisement',
    '.ad',
    '.banner',
    '.popup',
    '.modal',
    '.cookie-notice',
    '.social-share',
    '.related-posts',
    '.comments',
    '#comments',
    '.breadcrumb',
    '.skip-link'
  ]

  // Date extraction patterns
  private static DATE_PATTERNS = [
    {
      pattern: /last\s+(?:updated|modified|revised)[\s:]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      type: 'updated' as const
    },
    {
      pattern: /effective\s+(?:date|as\s+of)[\s:]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      type: 'effective' as const
    },
    {
      pattern: /(?:updated|modified)[\s:]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      type: 'updated' as const
    },
    {
      pattern: /version\s+date[\s:]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      type: 'updated' as const
    },
    {
      pattern: /published[\s:]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      type: 'published' as const
    }
  ]

  // Privacy-related keywords for validation
  private static PRIVACY_KEYWORDS = [
    'privacy', 'policy', 'personal information', 'data protection',
    'personal data', 'information we collect', 'how we use',
    'third party', 'cookies', 'gdpr', 'ccpa', 'consent',
    'data retention', 'security', 'user rights', 'opt-out'
  ]

  /**
   * Extract content from HTML with multiple strategies
   */
  static extract(html: string, url?: string): ExtractedContent {
    const $ = cheerio.load(html)
    
    // Remove unwanted elements first
    this.removeUnwantedElements($)
    
    // Try multiple extraction strategies
    let content: ExtractedContent | null = null
    
    // Strategy 1: Use Readability for article extraction
    content = this.extractWithReadability(html, url)
    
    // Strategy 2: Selector-based extraction
    if (!content || content.quality.score < 50) {
      const selectorContent = this.extractWithSelectors($)
      if (!content || selectorContent.quality.score > content.quality.score) {
        content = selectorContent
      }
    }
    
    // Strategy 3: Full body extraction (last resort)
    if (!content || content.quality.score < 30) {
      const bodyContent = this.extractFullBody($)
      if (!content || bodyContent.quality.score > content.quality.score) {
        content = bodyContent
      }
    }
    
    // Enhance content with additional metadata
    content = this.enhanceContent(content, $)
    
    return content
  }

  /**
   * Extract content using Mozilla Readability
   */
  private static extractWithReadability(html: string, url?: string): ExtractedContent | null {
    try {
      const dom = new JSDOM(html, { url: url || 'https://example.com' })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()
      
      if (!article || !article.content) {
        return null
      }
      
      const text = this.htmlToText(article.content)
      const markdown = this.turndown.turndown(article.content)
      
      return {
        text,
        markdown,
        title: article.title || '',
        metadata: {
          language: article.lang || 'en',
          wordCount: text.split(/\s+/).length,
          readingTime: Math.ceil(text.split(/\s+/).length / 200),
          sections: this.extractSections(article.content),
          links: [],
          dates: []
        },
        quality: {
          score: this.calculateQualityScore(text, 'readability'),
          issues: [],
          confidence: 'high'
        }
      }
    } catch (error) {
      console.error('Readability extraction failed:', error)
      return null
    }
  }

  /**
   * Extract content using CSS selectors
   */
  private static extractWithSelectors($: cheerio.CheerioAPI): ExtractedContent {
    let bestContent = ''
    let bestSelector = ''
    let bestElement: cheerio.Cheerio<any> | null = null
    
    // Try each selector and find the best match
    for (const selector of this.CONTENT_SELECTORS) {
      try {
        const elements = $(selector)
        if (elements.length > 0) {
          // Find the element with the most text content
          elements.each((_, elem) => {
            const $elem = $(elem)
            const text = $elem.text().trim()
            
            if (text.length > bestContent.length) {
              bestContent = text
              bestSelector = selector
              bestElement = $elem
            }
          })
        }
      } catch (error) {
        // Invalid selector, skip
      }
    }
    
    if (!bestElement) {
      return this.createEmptyContent('No content found')
    }
    
    const html = bestElement.html() || ''
    const text = this.cleanText(bestContent)
    const markdown = this.turndown.turndown(html)
    
    return {
      text,
      markdown,
      title: this.extractTitle($),
      metadata: {
        language: 'en',
        wordCount: text.split(/\s+/).length,
        readingTime: Math.ceil(text.split(/\s+/).length / 200),
        sections: this.extractSectionsFromElement(bestElement),
        links: this.extractLinks(bestElement),
        dates: this.extractDates(text)
      },
      quality: {
        score: this.calculateQualityScore(text, bestSelector),
        issues: [],
        confidence: bestSelector === 'body' ? 'low' : 'medium'
      }
    }
  }

  /**
   * Extract full body content as fallback
   */
  private static extractFullBody($: cheerio.CheerioAPI): ExtractedContent {
    const body = $('body')
    const text = this.cleanText(body.text())
    const html = body.html() || ''
    const markdown = this.turndown.turndown(html)
    
    return {
      text,
      markdown,
      title: this.extractTitle($),
      metadata: {
        language: 'en',
        wordCount: text.split(/\s+/).length,
        readingTime: Math.ceil(text.split(/\s+/).length / 200),
        sections: this.extractSectionsFromElement(body),
        links: this.extractLinks(body),
        dates: this.extractDates(text)
      },
      quality: {
        score: this.calculateQualityScore(text, 'body'),
        issues: ['Extracted from full body - may contain noise'],
        confidence: 'low'
      }
    }
  }

  /**
   * Remove unwanted elements from the DOM
   */
  private static removeUnwantedElements($: cheerio.CheerioAPI): void {
    for (const selector of this.REMOVE_SELECTORS) {
      try {
        $(selector).remove()
      } catch (error) {
        // Invalid selector, skip
      }
    }
    
    // Remove hidden elements
    $('[style*="display:none"]').remove()
    $('[style*="display: none"]').remove()
    $('[hidden]').remove()
    $('.hidden').remove()
    
    // Remove empty elements
    $('p:empty, div:empty, span:empty').remove()
  }

  /**
   * Extract title from the page
   */
  private static extractTitle($: cheerio.CheerioAPI): string {
    // Try multiple sources for title
    const sources = [
      $('h1').first().text(),
      $('title').text(),
      $('meta[property="og:title"]').attr('content'),
      $('meta[name="twitter:title"]').attr('content'),
      $('[class*="title"]').first().text()
    ]
    
    for (const source of sources) {
      if (source && source.trim()) {
        return source.trim()
      }
    }
    
    return 'Privacy Policy'
  }

  /**
   * Extract sections from content
   */
  private static extractSections(html: string): Section[] {
    const $ = cheerio.load(html)
    const sections: Section[] = []
    let currentSection: Section | null = null
    
    $('h1, h2, h3, h4, h5, h6, p, ul, ol').each((_, elem) => {
      const $elem = $(elem)
      const tagName = elem.tagName.toLowerCase()
      
      if (tagName.startsWith('h')) {
        // New section
        const level = parseInt(tagName[1])
        const title = $elem.text().trim()
        
        if (title) {
          currentSection = {
            title,
            level,
            content: '',
            wordCount: 0,
            id: this.generateId(title)
          }
          sections.push(currentSection)
        }
      } else if (currentSection) {
        // Add content to current section
        const text = $elem.text().trim()
        if (text) {
          currentSection.content += (currentSection.content ? '\n' : '') + text
          currentSection.wordCount = currentSection.content.split(/\s+/).length
        }
      }
    })
    
    return sections
  }

  /**
   * Extract sections from a specific element
   */
  private static extractSectionsFromElement(element: cheerio.Cheerio<any>): Section[] {
    const sections: Section[] = []
    let currentSection: Section | null = null
    
    element.find('h1, h2, h3, h4, h5, h6, p, ul, ol').each((_, elem) => {
      const $elem = element.find(elem)
      const tagName = elem.tagName.toLowerCase()
      
      if (tagName.startsWith('h')) {
        const level = parseInt(tagName[1])
        const title = $elem.text().trim()
        
        if (title) {
          currentSection = {
            title,
            level,
            content: '',
            wordCount: 0,
            id: this.generateId(title)
          }
          sections.push(currentSection)
        }
      } else if (currentSection && $elem.text().trim()) {
        currentSection.content += (currentSection.content ? '\n' : '') + $elem.text().trim()
        currentSection.wordCount = currentSection.content.split(/\s+/).length
      }
    })
    
    return sections
  }

  /**
   * Extract links from content
   */
  private static extractLinks(element: cheerio.Cheerio<any>): Link[] {
    const links: Link[] = []
    const baseUrl = 'https://example.com' // This should be passed in ideally
    
    element.find('a').each((_, elem) => {
      const $elem = element.find(elem)
      const href = $elem.attr('href')
      const text = $elem.text().trim()
      
      if (href && text) {
        let type: Link['type'] = 'internal'
        
        if (href.startsWith('mailto:')) {
          type = 'email'
        } else if (href.startsWith('tel:')) {
          type = 'tel'
        } else if (href.startsWith('http://') || href.startsWith('https://')) {
          try {
            const url = new URL(href)
            const base = new URL(baseUrl)
            type = url.hostname === base.hostname ? 'internal' : 'external'
          } catch {
            type = 'external'
          }
        }
        
        links.push({ text, href, type })
      }
    })
    
    return links
  }

  /**
   * Extract dates from text
   */
  private static extractDates(text: string): ExtractedDate[] {
    const dates: ExtractedDate[] = []
    
    for (const { pattern, type } of this.DATE_PATTERNS) {
      const matches = text.matchAll(pattern)
      
      for (const match of matches) {
        if (match[1]) {
          try {
            const date = new Date(match[1])
            if (!isNaN(date.getTime())) {
              dates.push({
                text: match[0],
                date: date.toISOString(),
                type,
                confidence: 0.8
              })
            }
          } catch {
            // Invalid date
          }
        }
      }
    }
    
    // Sort by confidence and date
    return dates.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Calculate quality score for extracted content
   */
  private static calculateQualityScore(text: string, extractionMethod: string): number {
    let score = 0
    
    // Base score based on extraction method
    const methodScores: Record<string, number> = {
      'readability': 80,
      'main[role="main"]': 75,
      'article': 70,
      'main': 65,
      'div': 50,
      'body': 30
    }
    
    score = methodScores[extractionMethod] || 40
    
    // Adjust based on content length
    const wordCount = text.split(/\s+/).length
    if (wordCount < 100) {
      score -= 20
    } else if (wordCount < 500) {
      score -= 10
    } else if (wordCount > 5000) {
      score += 10
    }
    
    // Check for privacy keywords
    const lowerText = text.toLowerCase()
    const keywordCount = this.PRIVACY_KEYWORDS.filter(kw => lowerText.includes(kw)).length
    
    if (keywordCount === 0) {
      score -= 30
    } else if (keywordCount < 5) {
      score -= 10
    } else if (keywordCount > 10) {
      score += 10
    }
    
    // Check for structure (headings, lists, etc.)
    const hasHeadings = /#{1,6}\s+\w+/m.test(text) || /<h[1-6]>/i.test(text)
    const hasLists = /^[\s]*[-*+•]\s+/m.test(text) || /<[uo]l>/i.test(text)
    
    if (hasHeadings) score += 5
    if (hasLists) score += 5
    
    return Math.max(0, Math.min(100, score))
  }

  /**
   * Enhance content with additional processing
   */
  private static enhanceContent(content: ExtractedContent, $: cheerio.CheerioAPI): ExtractedContent {
    // Extract meta tags
    const metaTags: Record<string, string> = {}
    $('meta').each((_, elem) => {
      const $elem = $(elem)
      const name = $elem.attr('name') || $elem.attr('property')
      const content = $elem.attr('content')
      
      if (name && content) {
        metaTags[name] = content
      }
    })
    
    // Update metadata from meta tags
    if (metaTags['description']) {
      content.metadata.author = metaTags['author']
    }
    
    if (metaTags['language'] || metaTags['lang']) {
      content.metadata.language = metaTags['language'] || metaTags['lang']
    }
    
    // Validate content is actually a privacy policy
    const validationIssues = this.validatePrivacyContent(content.text)
    if (validationIssues.length > 0) {
      content.quality.issues.push(...validationIssues)
      content.quality.score -= validationIssues.length * 5
    }
    
    return content
  }

  /**
   * Validate that content is actually a privacy policy
   */
  private static validatePrivacyContent(text: string): string[] {
    const issues: string[] = []
    const lowerText = text.toLowerCase()
    
    // Check for minimum privacy keywords
    const keywordCount = this.PRIVACY_KEYWORDS.filter(kw => lowerText.includes(kw)).length
    if (keywordCount < 3) {
      issues.push('Content may not be a privacy policy - few privacy-related keywords found')
    }
    
    // Check for common non-privacy content indicators
    const nonPrivacyIndicators = [
      'shopping cart', 'add to cart', 'buy now', 'sale price',
      'product description', 'customer reviews', 'shipping information'
    ]
    
    const nonPrivacyCount = nonPrivacyIndicators.filter(indicator => lowerText.includes(indicator)).length
    if (nonPrivacyCount > 3) {
      issues.push('Content appears to be from a non-privacy page')
    }
    
    // Check content length
    if (text.length < 500) {
      issues.push('Content is unusually short for a privacy policy')
    }
    
    return issues
  }

  /**
   * Clean text content
   */
  private static cleanText(text: string): string {
    // Decode HTML entities
    text = decode(text)
    
    // Remove extra whitespace
    text = text.replace(/\s+/g, ' ')
    
    // Fix line breaks
    text = text.replace(/\n{3,}/g, '\n\n')
    
    // Remove leading/trailing whitespace
    text = text.trim()
    
    return text
  }

  /**
   * Convert HTML to clean text
   */
  private static htmlToText(html: string): string {
    const $ = cheerio.load(html)
    
    // Replace specific elements with text equivalents
    $('br').replaceWith('\n')
    $('p').append('\n\n')
    $('h1, h2, h3, h4, h5, h6').prepend('\n\n').append('\n\n')
    $('li').prepend('• ')
    
    return this.cleanText($.text())
  }

  /**
   * Generate a URL-safe ID from text
   */
  private static generateId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)
  }

  /**
   * Create empty content with error message
   */
  private static createEmptyContent(error: string): ExtractedContent {
    return {
      text: '',
      markdown: '',
      title: '',
      metadata: {
        language: 'en',
        wordCount: 0,
        readingTime: 0,
        sections: [],
        links: [],
        dates: []
      },
      quality: {
        score: 0,
        issues: [error],
        confidence: 'low'
      }
    }
  }

  /**
   * Check if content is likely a privacy policy
   */
  static isPrivacyPolicy(text: string): boolean {
    const lowerText = text.toLowerCase()
    const keywordCount = this.PRIVACY_KEYWORDS.filter(kw => lowerText.includes(kw)).length
    
    // Need at least 5 privacy keywords and minimum length
    return keywordCount >= 5 && text.length >= 500
  }
}