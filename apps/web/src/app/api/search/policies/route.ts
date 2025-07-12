import { NextRequest, NextResponse } from 'next/server'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'
import { auth } from '@clerk/nextjs/server'
import { storage } from '@/lib/storage/adapter'
import { logger } from '@/lib/logger'

interface PolicySearchResult {
  id: string
  type: 'policy' | 'section' | 'change'
  companySlug: string
  companyName: string
  policySlug: string
  policyName: string
  title: string
  excerpt: string
  matchedContent: string
  score: number
  metadata: {
    lastUpdated: string
    version?: string
    sectionId?: string
    changeType?: 'added' | 'removed' | 'modified'
    changeDate?: string
    wordCount?: number
    readingTime?: number
    riskLevel?: 'low' | 'medium' | 'high'
  }
}

// TODO: Remove mock data once search service is implemented

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.userId
    
    // Optional: require authentication for search
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const body = await request.json()
    const { 
      query, 
      companies = [], 
      policyTypes = [],
      dateRange,
      limit = 50,
      offset = 0 
    } = body

    if (!query || query.length < 2) {
      return NextResponse.json({ 
        error: 'Query must be at least 2 characters long' 
      }, { status: 400 })
    }

    const results: PolicySearchResult[] = []
    const searchTerms = query.toLowerCase().split(' ').filter(Boolean)

    // Check if storage is configured
    if (!storage) {
      return NextResponse.json(
        {
          error: 'Search service not configured',
          message: 'Policy search requires proper storage configuration',
          documentation: 'https://docs.inplain.ai/configuration'
        },
        { status: 503 }
      )
    }

    // Search through real company data
    const companyList = Object.values(WATCHED_COMPANIES)
    for (const company of companyList) {
      // Filter by company if specified
      if (companies.length > 0 && !companies.includes(company.slug)) {
        continue
      }

      try {
        // Get latest snapshot for this company
        const snapshots = await storage.snapshot.list({
          companySlug: company.slug,
          limit: 1
        })
        
        if (!snapshots || snapshots.length === 0) {
          continue
        }
        
        const snapshot = snapshots[0]
        const policyContent = await storage.getSnapshotContent(snapshot.blobKey)
        
        if (!policyContent) {
          continue
        }
        // Filter by date range if specified
        if (dateRange) {
          const policyDate = new Date(snapshot.capturedAt)
          const startDate = new Date(dateRange.start)
          const endDate = new Date(dateRange.end)
          
          if (policyDate < startDate || policyDate > endDate) {
            continue
          }
        }

        // Search in policy content
        const contentScore = calculateScore(policyContent, searchTerms)
        if (contentScore > 0) {
          const excerpt = extractExcerpt(policyContent, searchTerms[0], 150)
          results.push({
            id: `${company.slug}-privacy-policy`,
            type: 'policy',
            companySlug: company.slug,
            companyName: company.name,
            policySlug: 'privacy-policy',
            policyName: 'Privacy Policy',
            title: `${company.name} - Privacy Policy`,
            excerpt,
            matchedContent: highlightMatches(excerpt, searchTerms),
            score: contentScore,
            metadata: {
              lastUpdated: snapshot.capturedAt,
              version: snapshot.id,
              wordCount: policyContent.split(/\s+/).length,
              readingTime: Math.ceil(policyContent.split(/\s+/).length / 200)
            }
          })
        }

        // Get recent diffs for changes
        const diffs = await storage.diff.list({
          companySlug: company.slug,
          limit: 5
        })
        
        // Search in recent changes
        for (const diff of diffs || []) {
          try {
            const diffContent = await storage.getDiffContent(diff.diffBlobKey)
            if (!diffContent) continue
            
            // Search in additions
            const additions = diffContent.additions?.join(' ') || ''
            const changeScore = calculateScore(additions, searchTerms)
            if (changeScore > 0 && additions) {
              const excerpt = extractExcerpt(additions, searchTerms[0], 150)
              results.push({
                id: `${company.slug}-change-${diff.id}`,
                type: 'change',
                companySlug: company.slug,
                companyName: company.name,
                policySlug: 'privacy-policy',
                policyName: 'Privacy Policy',
                title: `Recent change in ${company.name} Privacy Policy`,
                excerpt,
                matchedContent: highlightMatches(excerpt, searchTerms),
                score: changeScore * 1.2, // Higher score for recent changes
                metadata: {
                  lastUpdated: diff.createdAt,
                  changeType: 'modified' as const,
                  changeDate: diff.createdAt,
                  riskLevel: diff.riskLevel || 'medium'
                }
              })
            }
          } catch (diffError) {
            logger.error('Error searching diff', { diffId: diff.id, error: diffError })
          }
        }
      } catch (error) {
        logger.error('Error searching company policies', { company: company.slug, error })
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score)

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit)

    // Log search for analytics
    console.log(`Policy search: "${query}" returned ${results.length} results`)

    return NextResponse.json({
      results: paginatedResults,
      total: results.length,
      offset,
      limit,
      query
    })
  } catch (error) {
    console.error('Policy search error:', error)
    return NextResponse.json(
      { error: 'Failed to search policies' },
      { status: 500 }
    )
  }
}

// Calculate relevance score based on search terms
function calculateScore(text: string, searchTerms: string[]): number {
  const lowerText = text.toLowerCase()
  let score = 0

  for (const term of searchTerms) {
    // Exact match
    const exactMatches = (lowerText.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length
    score += exactMatches * 10

    // Partial match
    const partialMatches = (lowerText.match(new RegExp(term, 'g')) || []).length
    score += partialMatches * 5

    // Title/header boost (if text starts with capital letter after newline)
    if (text.match(new RegExp(`^.*${term}.*$`, 'mi'))) {
      score += 15
    }
  }

  // Boost for multiple terms appearing together
  const allTermsRegex = new RegExp(searchTerms.join('.*'), 'i')
  if (allTermsRegex.test(text)) {
    score += 20
  }

  return score
}

// Extract excerpt around the first match
function extractExcerpt(text: string, searchTerm: string, maxLength: number): string {
  const lowerText = text.toLowerCase()
  const index = lowerText.indexOf(searchTerm.toLowerCase())
  
  if (index === -1) {
    return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '')
  }

  const start = Math.max(0, index - Math.floor(maxLength / 2))
  const end = Math.min(text.length, start + maxLength)
  
  let excerpt = text.slice(start, end)
  
  // Add ellipsis if needed
  if (start > 0) excerpt = '...' + excerpt
  if (end < text.length) excerpt = excerpt + '...'
  
  return excerpt
}

// Highlight matched terms in text
function highlightMatches(text: string, searchTerms: string[]): string {
  let highlighted = text
  
  // Sort terms by length (longest first) to avoid partial replacements
  const sortedTerms = [...searchTerms].sort((a, b) => b.length - a.length)
  
  for (const term of sortedTerms) {
    const regex = new RegExp(`(${term})`, 'gi')
    highlighted = highlighted.replace(regex, '<mark>$1</mark>')
  }
  
  return highlighted
}

export async function GET(request: NextRequest) {
  // GET endpoint for search suggestions
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    
    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    // Generate suggestions based on policy data
    const suggestions = new Set<string>()
    const lowerQuery = query.toLowerCase()

    // Add company names from real data
    const companies = Object.values(WATCHED_COMPANIES)
    for (const company of companies) {
      if (company.name.toLowerCase().includes(lowerQuery)) {
        suggestions.add(company.name)
      }
    }

    // Add common policy terms
    const commonTerms = [
      'privacy policy', 'terms of service', 'data collection', 'user rights',
      'cookies', 'data retention', 'third party', 'security', 'compliance',
      'gdpr', 'ccpa', 'data protection', 'personal information'
    ]

    for (const term of commonTerms) {
      if (term.includes(lowerQuery)) {
        suggestions.add(term)
      }
    }

    return NextResponse.json({
      suggestions: Array.from(suggestions).slice(0, 10)
    })
  } catch (error) {
    console.error('Search suggestions error:', error)
    return NextResponse.json({ suggestions: [] })
  }
}