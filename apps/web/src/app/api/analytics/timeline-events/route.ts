import { NextResponse } from 'next/server'
import { storage } from '@/lib/storage/adapter'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

export const runtime = 'edge'

interface TimelineEvent {
  id: string
  date: string
  company: string
  type: 'policy-update' | 'risk-change' | 'new-monitoring' | 'alert'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  changes?: {
    added: string[]
    removed: string[]
    modified: string[]
  }
  riskImpact?: {
    before: number
    after: number
  }
  tags: string[]
}

export async function GET() {
  try {
    const events: TimelineEvent[] = []
    
    // Get recent diffs across all companies
    const companies = Object.values(WATCHED_COMPANIES)
    
    for (const company of companies.slice(0, 10)) { // Limit to 10 companies for performance
      try {
        // Get recent diffs for this company
        const diffs = await storage.diff.list({
          companySlug: company.slug,
          limit: 3
        })
        
        if (diffs && diffs.length > 0) {
          for (const diff of diffs) {
            // Determine severity based on change type
            const severity = 
              diff.changeType === 'major' ? 'high' :
              diff.changeType === 'moderate' ? 'medium' : 'low'
            
            // Create policy update event
            events.push({
              id: `${company.slug}-${diff.id}`,
              date: diff.createdAt,
              company: company.name,
              type: 'policy-update',
              title: `Privacy Policy Update`,
              description: `${diff.changeCount || 0} changes detected with ${diff.additions || 0} additions and ${diff.deletions || 0} deletions`,
              severity,
              changes: {
                added: [],
                removed: [],
                modified: [`${diff.changeCount || 0} sections modified`]
              },
              tags: [
                company.category || 'Technology',
                diff.changeType || 'Update',
                'Privacy Policy'
              ].filter(Boolean)
            })
            
            // Add alerts for major changes
            if (diff.changeType === 'major' && diff.changeCount > 10) {
              events.push({
                id: `alert-${company.slug}-${diff.id}`,
                date: diff.createdAt,
                company: company.name,
                type: 'alert',
                title: 'Significant Privacy Changes Detected',
                description: `Major policy changes with ${diff.changeCount} modifications may impact user privacy`,
                severity: 'critical',
                tags: ['Alert', 'Major Change', company.category || 'Technology']
              })
            }
          }
        }
        
        // Get company metrics for risk change events
        const snapshots = await storage.snapshot.list({
          companySlug: company.slug,
          limit: 2
        })
        
        if (snapshots && snapshots.length >= 2) {
          // Compare recent snapshots to detect risk changes
          const recentSnapshot = snapshots[0]
          const previousSnapshot = snapshots[1]
          
          if (recentSnapshot && previousSnapshot) {
            const timeDiff = new Date(recentSnapshot.capturedAt).getTime() - new Date(previousSnapshot.capturedAt).getTime()
            const daysDiff = timeDiff / (1000 * 60 * 60 * 24)
            
            // Only create risk change events for significant time differences
            if (daysDiff > 7) {
              events.push({
                id: `risk-${company.slug}-${recentSnapshot.id}`,
                date: recentSnapshot.capturedAt,
                company: company.name,
                type: 'risk-change',
                title: 'Privacy Score Updated',
                description: 'Privacy risk assessment has been recalculated based on latest policy analysis',
                severity: 'medium',
                riskImpact: {
                  before: 5 + Math.random() * 5, // Placeholder - would use real scores
                  after: 5 + Math.random() * 5
                },
                tags: ['Risk Assessment', company.category || 'Technology']
              })
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to process timeline events for ${company.name}:`, error)
      }
    }
    
    // Sort events by date (newest first)
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    // Limit to most recent 50 events
    const recentEvents = events.slice(0, 50)
    
    return NextResponse.json({
      events: recentEvents,
      total: recentEvents.length
    })
  } catch (error) {
    console.error('Timeline events error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch timeline events', events: [] },
      { status: 500 }
    )
  }
}