'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DiffCard } from '@/components/DiffCard'
import { getRecentDiffs } from '@/lib/api'
import { formatDuration, getTimeDiff } from '@inplain.ai/shared/utils'

interface RecentDiffsProps {
  limit?: number
}

export function RecentDiffs({ limit = 5 }: RecentDiffsProps) {
  const [diffs, setDiffs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRecentDiffs() {
      const results = await getRecentDiffs(limit)
      setDiffs(results)
      setLoading(false)
    }
    
    fetchRecentDiffs()
  }, [limit])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (diffs.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No recent policy changes detected</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {diffs.map((item, index) => {
        // Skip if item or its properties are null/undefined
        if (!item || !item.diff || !item.company) return null;
        
        return (
          <Link key={item.diff.id || index} href={`/${item.company.slug}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xl truncate flex-1">{item.company.name}</CardTitle>
                  {item.diff.changeType && (
                    <Badge 
                      variant={
                        item.diff.changeType === 'major' ? 'destructive' :
                        item.diff.changeType === 'moderate' ? 'warning' : 'secondary'
                      }
                      className="shrink-0"
                    >
                      {item.diff.changeType}
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {formatDuration(getTimeDiff(item.diff.createdAt))} ago
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>+{item.diff.additions || 0} additions</span>
                  <span>-{item.diff.deletions || 0} deletions</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  )
}