import { NextRequest, NextResponse } from 'next/server'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'
import { auth } from '@clerk/nextjs/server'

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

// Mock policy data - in production this would come from a database
const mockPolicyData = [
  {
    companySlug: 'google',
    companyName: 'Google',
    policies: [
      {
        slug: 'privacy-policy',
        name: 'Privacy Policy',
        lastUpdated: '2024-01-15',
        version: '2.3',
        content: `Google Privacy Policy. Information we collect. How we use information. 
        We collect information to provide better services to all our users. 
        Data protection and security. User rights and choices.`,
        sections: [
          {
            id: 'intro',
            title: 'Introduction',
            content: 'This Privacy Policy describes how Google collects and uses data.'
          },
          {
            id: 'data-collection',
            title: 'Data Collection',
            content: 'We collect information you provide, usage data, and device information.'
          }
        ],
        changes: [
          {
            type: 'modified',
            date: '2024-01-15',
            content: 'Updated data retention policy to comply with new regulations.'
          }
        ]
      },
      {
        slug: 'terms-of-service',
        name: 'Terms of Service',
        lastUpdated: '2024-01-10',
        version: '3.0',
        content: `Google Terms of Service. Using our services. Your content in our services.
        Privacy and copyright protection. Software in our services.`,
        sections: [],
        changes: []
      }
    ]
  },
  {
    companySlug: 'facebook',
    companyName: 'Facebook',
    policies: [
      {
        slug: 'privacy-policy',
        name: 'Privacy Policy',
        lastUpdated: '2024-01-20',
        version: '5.1',
        content: `Facebook Privacy Policy. What information do we collect? 
        How do we use this information? How is this information shared?
        Data retention and deletion. Privacy controls.`,
        sections: [
          {
            id: 'info-collect',
            title: 'Information We Collect',
            content: 'We collect the content, communications and other information you provide.'
          }
        ],
        changes: [
          {
            type: 'added',
            date: '2024-01-20',
            content: 'Added section on AI training data usage.'
          }
        ]
      }
    ]
  }
]

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

    // Search through mock data
    for (const company of mockPolicyData) {
      // Filter by company if specified
      if (companies.length > 0 && !companies.includes(company.companySlug)) {
        continue
      }

      for (const policy of company.policies) {
        // Filter by policy type if specified
        if (policyTypes.length > 0 && !policyTypes.some((type: string) => policy.slug.includes(type))) {
          continue
        }

        // Filter by date range if specified
        if (dateRange) {
          const policyDate = new Date(policy.lastUpdated)
          const startDate = new Date(dateRange.start)
          const endDate = new Date(dateRange.end)
          
          if (policyDate < startDate || policyDate > endDate) {
            continue
          }
        }

        // Search in policy content
        const contentScore = calculateScore(policy.content, searchTerms)
        if (contentScore > 0) {
          const excerpt = extractExcerpt(policy.content, searchTerms[0], 150)
          results.push({
            id: `${company.companySlug}-${policy.slug}`,
            type: 'policy',
            companySlug: company.companySlug,
            companyName: company.companyName,
            policySlug: policy.slug,
            policyName: policy.name,
            title: `${company.companyName} - ${policy.name}`,
            excerpt,
            matchedContent: highlightMatches(excerpt, searchTerms),
            score: contentScore,
            metadata: {
              lastUpdated: policy.lastUpdated,
              version: policy.version,
              wordCount: policy.content.split(/\s+/).length,
              readingTime: Math.ceil(policy.content.split(/\s+/).length / 200)
            }
          })
        }

        // Search in sections
        for (const section of policy.sections) {
          const sectionScore = calculateScore(section.content, searchTerms)
          if (sectionScore > 0) {
            const excerpt = extractExcerpt(section.content, searchTerms[0], 150)
            results.push({
              id: `${company.companySlug}-${policy.slug}-${section.id}`,
              type: 'section',
              companySlug: company.companySlug,
              companyName: company.companyName,
              policySlug: policy.slug,
              policyName: policy.name,
              title: section.title,
              excerpt,
              matchedContent: highlightMatches(excerpt, searchTerms),
              score: sectionScore * 0.8, // Slightly lower score for sections
              metadata: {
                lastUpdated: policy.lastUpdated,
                version: policy.version,
                sectionId: section.id
              }
            })
          }
        }

        // Search in changes
        for (const change of policy.changes) {
          const changeScore = calculateScore(change.content, searchTerms)
          if (changeScore > 0) {
            results.push({
              id: `${company.companySlug}-${policy.slug}-change-${change.date}`,
              type: 'change',
              companySlug: company.companySlug,
              companyName: company.companyName,
              policySlug: policy.slug,
              policyName: policy.name,
              title: `Change in ${policy.name}`,
              excerpt: change.content,
              matchedContent: highlightMatches(change.content, searchTerms),
              score: changeScore * 1.2, // Higher score for recent changes
              metadata: {
                lastUpdated: policy.lastUpdated,
                changeType: change.type as 'added' | 'removed' | 'modified',
                changeDate: change.date
              }
            })
          }
        }
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

    // Add company names
    for (const company of mockPolicyData) {
      if (company.companyName.toLowerCase().includes(lowerQuery)) {
        suggestions.add(company.companyName)
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