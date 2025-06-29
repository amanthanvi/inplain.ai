import { NextRequest, NextResponse } from 'next/server'
import { diffLines, Change } from 'diff'

export const runtime = 'edge'

interface DiffRequest {
  oldContent: string
  newContent: string
  format?: 'html' | 'json' | 'markdown'
}

interface DiffStats {
  additions: number
  deletions: number
  modifications: number
  totalChanges: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DiffRequest
    const { oldContent, newContent, format = 'html' } = body

    if (!oldContent || !newContent) {
      return NextResponse.json(
        { error: 'Both oldContent and newContent are required' },
        { status: 400 }
      )
    }

    // Generate diff
    const changes = diffLines(oldContent, newContent, { newlineIsToken: true })
    
    // Calculate stats
    const stats: DiffStats = {
      additions: 0,
      deletions: 0,
      modifications: 0,
      totalChanges: 0
    }

    // Process changes
    const processedChanges: Change[] = []
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i]
      
      if (change.added) {
        stats.additions += change.count || 1
        
        // Check if this is part of a modification
        if (i > 0 && changes[i - 1]?.removed) {
          stats.modifications++
          stats.additions--
          stats.deletions--
        }
      } else if (change.removed) {
        stats.deletions += change.count || 1
      }
      
      processedChanges.push(change)
    }
    
    stats.totalChanges = stats.additions + stats.deletions + stats.modifications

    // Format output based on requested format
    let formattedDiff: string
    
    if (format === 'html') {
      formattedDiff = generateHtmlDiff(processedChanges)
    } else if (format === 'markdown') {
      formattedDiff = generateMarkdownDiff(processedChanges)
    } else {
      formattedDiff = JSON.stringify(processedChanges)
    }

    return NextResponse.json({
      diff: formattedDiff,
      stats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Diff generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate diff' },
      { status: 500 }
    )
  }
}

function generateHtmlDiff(changes: Change[]): string {
  let html = '<div class="diff-container">'
  
  changes.forEach((change) => {
    const lines = (change.value || '').split('\n').filter(line => line)
    
    lines.forEach(line => {
      if (change.added) {
        html += `<div class="diff-line diff-added">
          <span class="diff-marker">+</span>
          <span class="diff-content">${escapeHtml(line)}</span>
        </div>`
      } else if (change.removed) {
        html += `<div class="diff-line diff-removed">
          <span class="diff-marker">-</span>
          <span class="diff-content">${escapeHtml(line)}</span>
        </div>`
      } else {
        html += `<div class="diff-line diff-unchanged">
          <span class="diff-marker"> </span>
          <span class="diff-content">${escapeHtml(line)}</span>
        </div>`
      }
    })
  })
  
  html += '</div>'
  
  // Add styles
  html += `
    <style>
      .diff-container {
        font-family: monospace;
        font-size: 0.875rem;
        line-height: 1.5;
      }
      .diff-line {
        display: flex;
        padding: 0.125rem 0;
      }
      .diff-marker {
        width: 1.5rem;
        text-align: center;
        user-select: none;
        color: #6b7280;
      }
      .diff-content {
        flex: 1;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .diff-added {
        background-color: #d1fae5;
        color: #065f46;
      }
      .diff-removed {
        background-color: #fee2e2;
        color: #991b1b;
        text-decoration: line-through;
      }
      .diff-unchanged {
        color: #374151;
      }
      @media (prefers-color-scheme: dark) {
        .diff-added {
          background-color: #064e3b;
          color: #6ee7b7;
        }
        .diff-removed {
          background-color: #7f1d1d;
          color: #fca5a5;
        }
        .diff-unchanged {
          color: #d1d5db;
        }
      }
    </style>
  `
  
  return html
}

function generateMarkdownDiff(changes: Change[]): string {
  let markdown = '```diff\n'
  
  changes.forEach((change) => {
    const lines = (change.value || '').split('\n').filter(line => line)
    
    lines.forEach(line => {
      if (change.added) {
        markdown += `+ ${line}\n`
      } else if (change.removed) {
        markdown += `- ${line}\n`
      } else {
        markdown += `  ${line}\n`
      }
    })
  })
  
  markdown += '```'
  return markdown
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  
  return text.replace(/[&<>"']/g, (m) => map[m] || m)
}