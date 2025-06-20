export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString()
}

export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp)
}

export function getTimeDiff(from: string | Date, to: string | Date = new Date()): number {
  const fromDate = typeof from === 'string' ? parseTimestamp(from) : from
  const toDate = typeof to === 'string' ? parseTimestamp(to) : to
  return toDate.getTime() - fromDate.getTime()
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export function hashContent(content: string): string {
  const crypto = globalThis.crypto || require('crypto')
  
  if (typeof crypto.subtle !== 'undefined') {
    return crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(content))
      .then(buffer => {
        return Array.from(new Uint8Array(buffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
      })
      .catch(() => fallbackHash(content)) as unknown as string
  }
  
  return fallbackHash(content)
}

function fallbackHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(64, '0')
}

export function truncate(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - suffix.length) + suffix
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.search = ''
    if (parsed.pathname === '/') {
      parsed.pathname = ''
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return url
  }
}

export const RISK_LEVELS = {
  low: { label: 'Low Risk', color: 'green' },
  medium: { label: 'Medium Risk', color: 'yellow' },
  high: { label: 'High Risk', color: 'red' }
} as const

export const CHANGE_TYPES = {
  minor: { label: 'Minor Changes', threshold: 0.05 },
  moderate: { label: 'Moderate Changes', threshold: 0.15 },
  major: { label: 'Major Changes', threshold: 0.30 }
} as const

export function calculateChangeType(additions: number, deletions: number, total: number): 'minor' | 'moderate' | 'major' {
  if (total === 0) return 'minor'
  
  const changeRatio = (additions + deletions) / total
  
  if (changeRatio >= CHANGE_TYPES.major.threshold) return 'major'
  if (changeRatio >= CHANGE_TYPES.moderate.threshold) return 'moderate'
  return 'minor'
}