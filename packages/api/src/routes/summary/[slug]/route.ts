import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StorageClient } from '../../../lib/storage'
import { SummarySchema } from '@policydiff/shared'
import { formatTimestamp } from '@policydiff/shared/utils'

const storage = new StorageClient()

const bodySchema = z.object({
  diffId: z.string().uuid(),
  force: z.boolean().optional()
})

const CLAUDE_API_URL = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages'
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const body = await request.json()
    const { diffId, force } = bodySchema.parse(body)

    const diff = await storage.getDiff(slug, diffId)
    if (!diff) {
      return NextResponse.json(
        { error: 'Diff not found' },
        { status: 404 }
      )
    }

    if (diff.summaryId && !force) {
      const existingSummary = await storage.getSummary(diff.summaryId)
      if (existingSummary) {
        return NextResponse.json({
          summary: existingSummary,
          cached: true
        })
      }
    }

    const diffContent = await storage.getDiffContent(diff.diffBlobKey)
    if (!diffContent) {
      return NextResponse.json(
        { error: 'Diff content not found' },
        { status: 404 }
      )
    }

    const prompt = `You are analyzing changes to a privacy policy or terms of service document. 
    
Based on the following diff information:
- ${diff.additions} characters added
- ${diff.deletions} characters deleted
- ${diff.changeCount} total changes
- Change type: ${diff.changeType}

Here is the HTML diff showing the changes:
${diffContent.htmlDiff}

Please provide:
1. A concise summary (2-3 sentences) of what changed
2. Key highlights of the most important changes (up to 5 bullet points)
3. Risk assessment (low/medium/high) based on how these changes might affect user privacy or rights
4. Categories that these changes fall into

Focus on explaining the practical implications for users in plain language.`

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`)
    }

    const claudeResponse = await response.json()
    const content = claudeResponse.content[0].text

    const parsedSummary = parseClaudeResponse(content)
    
    const summary = SummarySchema.parse({
      id: crypto.randomUUID(),
      diffId,
      createdAt: formatTimestamp(),
      model: 'claude-3-opus-20240229',
      prompt,
      summary: parsedSummary.summary,
      highlights: parsedSummary.highlights,
      riskLevel: parsedSummary.riskLevel,
      categories: parsedSummary.categories,
      tokensUsed: claudeResponse.usage?.total_tokens || 0,
      cached: false
    })

    await storage.saveSummary(summary)
    
    diff.summaryId = summary.id
    await storage.saveDiff(diff)

    return NextResponse.json({
      summary,
      cached: false
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=3600',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Summary generation error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function parseClaudeResponse(content: string): {
  summary: string
  highlights: string[]
  riskLevel: 'low' | 'medium' | 'high'
  categories: string[]
} {
  const lines = content.split('\n').filter(line => line.trim())
  
  let summary = ''
  const highlights: string[] = []
  let riskLevel: 'low' | 'medium' | 'high' = 'low'
  const categories: string[] = []
  
  let section = ''
  
  for (const line of lines) {
    if (line.includes('summary') || line.includes('Summary')) {
      section = 'summary'
    } else if (line.includes('highlight') || line.includes('Highlight')) {
      section = 'highlights'
    } else if (line.includes('risk') || line.includes('Risk')) {
      section = 'risk'
    } else if (line.includes('categor') || line.includes('Categor')) {
      section = 'categories'
    } else if (section === 'summary' && !summary) {
      summary = line.replace(/^[-*]\s*/, '').trim()
    } else if (section === 'highlights' && line.startsWith('-')) {
      highlights.push(line.replace(/^[-*]\s*/, '').trim())
    } else if (section === 'risk' && line.toLowerCase().includes('low')) {
      riskLevel = 'low'
    } else if (section === 'risk' && line.toLowerCase().includes('medium')) {
      riskLevel = 'medium'
    } else if (section === 'risk' && line.toLowerCase().includes('high')) {
      riskLevel = 'high'
    } else if (section === 'categories') {
      const categoryMap: Record<string, string> = {
        'data collection': 'data_collection',
        'data sharing': 'data_sharing',
        'data retention': 'data_retention',
        'user rights': 'user_rights',
        'security': 'security',
        'cookies': 'cookies',
        'third parties': 'third_parties',
        'children': 'children'
      }
      
      for (const [key, value] of Object.entries(categoryMap)) {
        if (line.toLowerCase().includes(key)) {
          categories.push(value)
        }
      }
    }
  }
  
  return {
    summary: summary || 'Changes detected in the policy document.',
    highlights: highlights.slice(0, 5),
    riskLevel,
    categories: [...new Set(categories)]
  }
}