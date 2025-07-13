import { NextRequest, NextResponse } from 'next/server'
import { getClerkAuth } from '@/lib/auth-clerk'
import { isDevAuthEnabled } from '@/lib/dev-auth'
import { storage } from '@/lib/storage/adapter'
import { DiffEngine } from '@/app/api/lib/diff-engine'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    // Check authentication (skip in dev with auth bypass)
    if (process.env.NODE_ENV === 'production' && !isDevAuthEnabled()) {
      const { userId } = await getClerkAuth()
      if (!userId) {
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    const slug = 'google'
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Get diffs from storage
    const diffs = await storage.diff.list({
      companySlug: slug,
      limit
    })

    if (!diffs || diffs.length === 0) {
      return NextResponse.json({
        diffs: [],
        message: 'No policy changes found for Google'
      })
    }

    // Transform diffs to include additional metadata
    const enrichedDiffs = await Promise.all(
      diffs.map(async (diff) => {
        try {
          // Get the actual diff content if available
          const content = await storage.getDiffContent(slug, diff.id)
          
          return {
            id: diff.id,
            createdAt: diff.createdAt,
            significance: diff.changeType, // changeType is already 'minor' | 'moderate' | 'major'
            changeType: diff.changeType,
            summary: 'Policy update detected', // TODO: Add summary generation
            sections: [], // TODO: Extract sections from diff content
            metrics: {
              additions: diff.additions || 0,
              deletions: diff.deletions || 0,
              modifications: 0 // Not available in DiffMeta
            },
            hasDetails: !!content
          }
        } catch (error) {
          console.error('Error enriching diff:', error)
          return {
            id: diff.id,
            createdAt: diff.createdAt,
            significance: diff.changeType, // changeType is already 'minor' | 'moderate' | 'major'
            changeType: diff.changeType,
            summary: 'Policy update detected', // TODO: Add summary generation
            sections: [], // TODO: Extract sections from diff content
            metrics: {
              additions: 0,
              deletions: 0,
              modifications: 0
            },
            hasDetails: false
          }
        }
      })
    )

    return NextResponse.json({
      diffs: enrichedDiffs,
      total: enrichedDiffs.length,
      hasMore: enrichedDiffs.length === limit
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    })
  } catch (error) {
    console.error('Google diff API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch policy differences' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    if (process.env.NODE_ENV === 'production' && !isDevAuthEnabled()) {
      const { userId } = await getClerkAuth()
      if (!userId) {
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    const slug = 'google'
    
    // Get the two latest snapshots
    const snapshots = await storage.snapshot.list({
      companySlug: slug,
      limit: 2
    })

    if (!snapshots || snapshots.length < 2) {
      return NextResponse.json({
        error: 'Not enough snapshots to generate diff',
        message: 'At least two snapshots are required to compare changes'
      }, { status: 400 })
    }

    const [current, previous] = snapshots

    // Get content for both snapshots
    const currentContent = await storage.getSnapshotContent(slug, current.id)
    const previousContent = await storage.getSnapshotContent(slug, previous.id)

    if (!currentContent || !previousContent) {
      return NextResponse.json({
        error: 'Failed to retrieve snapshot content'
      }, { status: 500 })
    }

    // Generate diff using DiffEngine
    const diffEngine = new DiffEngine()
    const diff = await diffEngine.generateDiff(previousContent, currentContent, {
      companySlug: slug,
      fromSnapshot: previous.id,
      toSnapshot: current.id
    })

    // Store the diff
    const storedDiff = await storage.diff.create({
      companySlug: slug,
      fromSnapshotId: previous.id,
      toSnapshotId: current.id,
      ...diff
    })

    return NextResponse.json({
      diff: storedDiff,
      message: 'Diff generated successfully'
    })
  } catch (error) {
    console.error('Google diff generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate diff' },
      { status: 500 }
    )
  }
}