import { NextRequest, NextResponse } from 'next/server'
import { StorageClient } from '../lib/storage'
import { OptimizedStorageClient } from '../lib/storage-optimized'
// Removed unused PolicyAnalysisService import
import { RiskScorer } from '@/lib/analytics/risk-scorer'
import { formatTimestamp } from '@inplain.ai/shared'

// Initialize storage clients
const storage = new StorageClient()
const optimizedStorage = new OptimizedStorageClient()

// Static companies data - in production this would come from database
const getCompanies = () => Promise.resolve([
  { slug: 'google', name: 'Google', url: 'https://policies.google.com/privacy', active: true, checkInterval: 86400 },
  { slug: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/privacy/policy', active: true, checkInterval: 86400 },
  { slug: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496', active: true, checkInterval: 86400 },
  { slug: 'microsoft', name: 'Microsoft', url: 'https://privacy.microsoft.com/en-us/privacystatement', active: true, checkInterval: 86400 },
  { slug: 'apple', name: 'Apple', url: 'https://www.apple.com/legal/privacy/', active: true, checkInterval: 86400 }
])

interface ActivityItem {
  id: string
  type: 'policy-update' | 'user-analysis' | 'risk-alert' | 'new-monitoring' | 'system'
  timestamp: string
  title: string
  description: string
  icon?: string
  color?: string
  metadata?: {
    company?: string
    user?: {
      name: string
      avatar?: string
    }
    changeType?: string
    riskLevel?: string
    location?: string
    slug?: string
    aiSummary?: string
    riskScore?: number
    highlights?: string[]
    categories?: string[]
    diffId?: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const page = parseInt(searchParams.get('page') || '1')
    const includeAI = searchParams.get('includeAI') !== 'false'
    const includeRisk = searchParams.get('includeRisk') !== 'false'
    
    // Get all companies and fetch their latest diffs
    const companies = await getCompanies()
    const activities: ActivityItem[] = []
    
    // Fetch recent diffs for all companies
    const diffPromises = companies.map(async (company) => {
      try {
        const diffs = await storage.getLatestDiffs(company.slug, 3) // Get last 3 diffs per company
        return { company, diffs }
      } catch (error) {
        console.warn(`Failed to fetch diffs for ${company.slug}:`, error)
        return { company, diffs: [] }
      }
    })
    
    const companyDiffs = await Promise.all(diffPromises)
    
    // Process each diff into activity items
    for (const { company, diffs } of companyDiffs) {
      for (const diff of diffs) {
        if (!diff || !diff.createdAt) continue
        
        const baseActivity: ActivityItem = {
          id: `diff-${company.slug}-${diff.id}`,
          type: 'policy-update',
          timestamp: diff.createdAt,
          title: `${company.name} updated their privacy policy`,
          description: `${diff.changeType || 'Changes'} detected with ${diff.additions || 0} additions and ${diff.deletions || 0} deletions`,
          color: 'text-blue-600',
          metadata: {
            company: company.name,
            slug: company.slug,
            changeType: diff.changeType,
            diffId: diff.id
          }
        }
        
        // Enrich with AI analysis if available and requested
        if (includeAI && diff.summaryId) {
          try {
            const summary = await storage.getSummary(diff.summaryId)
            if (summary) {
              baseActivity.metadata!.aiSummary = summary.summary
              baseActivity.metadata!.highlights = summary.highlights
              baseActivity.metadata!.categories = summary.categories
              
              // Update description with AI insights
              baseActivity.description = summary.summary.substring(0, 150) + '...'
            }
          } catch (e) {
            console.warn('Failed to fetch AI summary:', e)
          }
        }
        
        // Calculate risk score if requested
        if (includeRisk && diff.diffBlobKey) {
          try {
            // Get diff content for risk scoring
            const diffContent = await optimizedStorage.getDiffContent(diff.diffBlobKey)
            if (diffContent) {
              // Extract the diff result data
              const diffResult = {
                additions: diffContent.additions || '',
                removals: diffContent.deletions || diffContent.removals || '',
                modifications: diffContent.modifications || '',
                changeCount: diffContent.changeCount || diff.changeCount,
                changeType: diffContent.changeType || diff.changeType
              }
              
              const riskScore = await RiskScorer.scoreChanges(diffResult)
              
              baseActivity.metadata!.riskScore = riskScore.overall
              baseActivity.metadata!.riskLevel = riskScore.recommendation
              
              // Add risk alert activity if high risk
              if (riskScore.recommendation === 'high' || riskScore.recommendation === 'critical') {
                activities.push({
                  id: `risk-${company.slug}-${diff.id}`,
                  type: 'risk-alert',
                  timestamp: diff.createdAt,
                  title: `High risk changes detected for ${company.name}`,
                  description: `Risk score: ${riskScore.overall}/100. ${riskScore.factors[0]?.description || 'Review recommended.'}`,
                  color: 'text-red-600',
                  metadata: {
                    company: company.name,
                    slug: company.slug,
                    riskLevel: riskScore.recommendation,
                    riskScore: riskScore.overall,
                    diffId: diff.id
                  }
                })
              }
              
              // Update activity color based on risk
              if (riskScore.recommendation === 'critical') {
                baseActivity.color = 'text-red-600'
              } else if (riskScore.recommendation === 'high') {
                baseActivity.color = 'text-orange-600'
              } else if (riskScore.recommendation === 'medium') {
                baseActivity.color = 'text-yellow-600'
              }
            }
          } catch (e) {
            console.warn('Failed to calculate risk score:', e)
          }
        }
        
        activities.push(baseActivity)
      }
    }
    
    // Add some system activities (e.g., new companies being monitored)
    const recentlyAdded = companies.filter(c => {
      // In production, check actual creation date
      // For demo, randomly include some companies
      return Math.random() > 0.8
    })
    
    for (const company of recentlyAdded) {
      activities.push({
        id: `new-monitoring-${company.slug}`,
        type: 'new-monitoring',
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(), // Random time in last 24h
        title: `Started monitoring ${company.name}`,
        description: 'Privacy policy tracking activated',
        color: 'text-green-600',
        metadata: {
          company: company.name,
          slug: company.slug
        }
      })
    }
    
    // Sort by timestamp (most recent first)
    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    
    // Implement pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedActivities = activities.slice(startIndex, endIndex)
    
    // Add simulated user activity if enabled
    if (searchParams.get('includeUsers') === 'true') {
      const userActivities = generateUserActivities(paginatedActivities.length > 0 ? 3 : 0)
      paginatedActivities.push(...userActivities)
      
      // Re-sort after adding user activities
      paginatedActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    }
    
    return NextResponse.json({
      activities: paginatedActivities,
      pagination: {
        page,
        limit,
        totalItems: activities.length,
        totalPages: Math.ceil(activities.length / limit),
        hasMore: endIndex < activities.length
      },
      stats: {
        last24h: activities.filter(a => {
          const hoursDiff = (Date.now() - new Date(a.timestamp).getTime()) / (1000 * 60 * 60)
          return hoursDiff <= 24
        }).length,
        byType: {
          'policy-update': activities.filter(a => a.type === 'policy-update').length,
          'risk-alert': activities.filter(a => a.type === 'risk-alert').length,
          'new-monitoring': activities.filter(a => a.type === 'new-monitoring').length,
          'user-analysis': activities.filter(a => a.type === 'user-analysis').length
        }
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Activity feed error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to generate simulated user activities
function generateUserActivities(count: number): ActivityItem[] {
  const activities: ActivityItem[] = []
  const sampleUsers = [
    { name: 'Alex Chen', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex' },
    { name: 'Sarah Johnson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah' },
    { name: 'Mike Rodriguez', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mike' },
    { name: 'Emma Wilson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma' }
  ]
  
  const companies = ['Google', 'Facebook', 'Amazon', 'Microsoft', 'Apple']
  const locations = ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'Chicago, IL']
  
  for (let i = 0; i < count; i++) {
    const userIndex = Math.floor(Math.random() * sampleUsers.length)
    const user = sampleUsers[userIndex]!
    const company = companies[Math.floor(Math.random() * companies.length)]!
    const location = locations[Math.floor(Math.random() * locations.length)]!
    
    activities.push({
      id: `user-analysis-${Date.now()}-${i}`,
      type: 'user-analysis',
      timestamp: new Date(Date.now() - Math.random() * 3600000 * 4).toISOString(), // Random time in last 4 hours
      title: `${user.name} analyzed ${company}'s policy changes`,
      description: 'Generated detailed privacy impact report',
      color: 'text-purple-600',
      metadata: {
        user,
        company,
        location,
        slug: company.toLowerCase()
      }
    })
  }
  
  return activities
}

// POST endpoint for creating manual activities (e.g., from user actions)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.type || !body.title) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title' },
        { status: 400 }
      )
    }
    
    const activity: ActivityItem = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: body.type,
      timestamp: body.timestamp || new Date().toISOString(),
      title: body.title,
      description: body.description || '',
      color: body.color,
      metadata: body.metadata
    }
    
    // In production, save to database
    // For now, just return the created activity
    return NextResponse.json({
      activity,
      message: 'Activity created successfully'
    }, {
      status: 201
    })
  } catch (error) {
    console.error('Create activity error:', error)
    
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    )
  }
}