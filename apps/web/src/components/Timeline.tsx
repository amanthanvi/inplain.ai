'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getLatestDiffs } from '@/lib/api'
import { formatDuration, getTimeDiff } from '@policydiff/shared/utils'
import type { DiffMeta } from '@policydiff/shared'

interface TimelineProps {
  slug: string
}

export function Timeline({ slug }: TimelineProps) {
  const [diffs, setDiffs] = useState<DiffMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHistory() {
      const data = await getLatestDiffs(slug)
      setDiffs(data)
      setLoading(false)
    }
    
    fetchHistory()
  }, [slug])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (diffs.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 space-y-2">
          <p className="text-muted-foreground text-sm">No change history available yet</p>
          <p className="text-xs text-muted-foreground">
            Changes will appear here after the daily monitoring runs
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"></div>
      
      <div className="space-y-4">
        {diffs.map((diff, index) => (
          <div key={diff.id} className="relative flex items-start">
            <div className="absolute left-4 w-2 h-2 bg-primary rounded-full -translate-x-1/2 mt-2"></div>
            
            <Card className="ml-8 flex-1">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant={
                    diff.changeType === 'major' ? 'destructive' :
                    diff.changeType === 'moderate' ? 'warning' : 'secondary'
                  } className="text-xs">
                    {diff.changeType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(getTimeDiff(diff.createdAt))} ago
                  </span>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <span className="text-green-600 dark:text-green-400">+{diff.additions}</span>
                  {' / '}
                  <span className="text-red-600 dark:text-red-400">-{diff.deletions}</span>
                  {' changes'}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}