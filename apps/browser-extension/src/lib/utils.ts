import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 30) {
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  } else if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'} ago`
  } else if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  } else if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  } else {
    return 'Just now'
  }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-risk-low'
  if (score >= 60) return 'text-risk-medium'
  return 'text-risk-high'
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-risk-low/10'
  if (score >= 60) return 'bg-risk-medium/10'
  return 'bg-risk-high/10'
}

export function getSeverityColor(severity: 'low' | 'medium' | 'high'): string {
  switch (severity) {
    case 'low':
      return 'text-risk-low'
    case 'medium':
      return 'text-risk-medium'
    case 'high':
      return 'text-risk-high'
    default:
      return 'text-muted-foreground'
  }
}

export function getSeverityBgColor(severity: 'low' | 'medium' | 'high'): string {
  switch (severity) {
    case 'low':
      return 'bg-risk-low/10'
    case 'medium':
      return 'bg-risk-medium/10'
    case 'high':
      return 'bg-risk-high/10'
    default:
      return 'bg-muted'
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}