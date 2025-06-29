'use client'

import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  FileText,
  AlertTriangle,
  Info,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Bell,
  TrendingUp,
  ArrowRight,
  History
} from 'lucide-react'
import { PolicyChange } from '@/lib/monitoring/policy-monitor'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface PolicyChangeTimelineProps {
  changes: PolicyChange[]
  onViewDiff?: (change: PolicyChange) => void
  className?: string
}

export function PolicyChangeTimeline({
  changes,
  onViewDiff,
  className
}: PolicyChangeTimelineProps) {
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set())

  const toggleExpanded = (changeId: string) => {
    const newExpanded = new Set(expandedChanges)
    if (newExpanded.has(changeId)) {
      newExpanded.delete(changeId)
    } else {
      newExpanded.add(changeId)
    }
    setExpandedChanges(newExpanded)
  }

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'structure':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'content':
        return <FileText className="h-4 w-4 text-yellow-500" />
      case 'minor':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const getChangeBadgeVariant = (changeType: string) => {
    switch (changeType) {
      case 'structure':
        return 'destructive'
      case 'content':
        return 'warning'
      case 'minor':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  if (changes.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="text-center space-y-3">
            <History className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No policy changes detected yet</p>
            <p className="text-sm text-muted-foreground">
              We'll notify you when privacy policies are updated
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Group changes by date
  const groupedChanges = changes.reduce((groups, change) => {
    const date = format(new Date(change.timestamp), 'yyyy-MM-dd')
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(change)
    return groups
  }, {} as Record<string, PolicyChange[]>)

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Policy Change Timeline
            </CardTitle>
            <CardDescription>
              Recent privacy policy updates across monitored companies
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <Bell className="h-3 w-3" />
            {changes.length} changes
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {Object.entries(groupedChanges)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, dateChanges]) => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {format(new Date(date), 'MMMM d, yyyy')}
                </span>
              </div>

              <div className="space-y-3 pl-6 border-l-2 border-muted">
                {dateChanges.map((change) => {
                  const changeId = `${change.companySlug}-${change.timestamp}`
                  const isExpanded = expandedChanges.has(changeId)

                  return (
                    <div
                      key={changeId}
                      className="relative -ml-[9px]"
                    >
                      {/* Timeline dot */}
                      <div className="absolute left-0 w-4 h-4 bg-background border-2 border-primary rounded-full" />

                      {/* Change card */}
                      <div className="ml-6">
                        <Card>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              {/* Header */}
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  {getChangeIcon(change.changeType)}
                                  <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                      <Link
                                        href={`/companies/${change.companySlug}`}
                                        className="font-medium hover:underline"
                                      >
                                        {change.companySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                      </Link>
                                      <Badge variant={getChangeBadgeVariant(change.changeType)}>
                                        {change.changeType}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {formatDistanceToNow(new Date(change.timestamp), { addSuffix: true })}
                                    </p>
                                  </div>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleExpanded(changeId)}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>

                              {/* Summary */}
                              <div className="text-sm text-muted-foreground">
                                {change.changedSections.length} section{change.changedSections.length !== 1 ? 's' : ''} updated
                              </div>

                              {/* Expanded details */}
                              {isExpanded && (
                                <div className="space-y-3 pt-3 border-t">
                                  <div>
                                    <h4 className="text-sm font-medium mb-2">Changed Sections:</h4>
                                    <ul className="space-y-1">
                                      {change.changedSections.map((section, index) => (
                                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                          <ArrowRight className="h-3 w-3 mt-0.5" />
                                          <span>{section}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(change.url, '_blank')}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Policy
                                    </Button>
                                    {onViewDiff && change.diffUrl && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onViewDiff(change)}
                                      >
                                        <FileText className="h-4 w-4 mr-2" />
                                        View Changes
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

        {/* Load more button */}
        {changes.length >= 10 && (
          <div className="text-center pt-4">
            <Button variant="outline" size="sm">
              Load More Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}