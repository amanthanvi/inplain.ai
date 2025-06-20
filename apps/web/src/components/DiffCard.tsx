import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDuration, getTimeDiff } from '@policydiff/shared/utils'
import type { DiffMeta, Summary } from '@policydiff/shared'

interface DiffCardProps {
  diff: DiffMeta
  summary?: Summary | null
  showFullDiff?: boolean
}

export function DiffCard({ diff, summary, showFullDiff = false }: DiffCardProps) {
  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'high': return 'destructive'
      case 'medium': return 'warning'
      default: return 'secondary'
    }
  }

  const getChangeBadgeVariant = (changeType: string) => {
    switch (changeType) {
      case 'major': return 'destructive'
      case 'moderate': return 'warning'
      default: return 'secondary'
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Policy Update</CardTitle>
          <div className="flex gap-2">
            <Badge variant={getChangeBadgeVariant(diff.changeType)}>
              {diff.changeType}
            </Badge>
            {summary && (
              <Badge variant={getRiskBadgeVariant(summary.riskLevel)}>
                {summary.riskLevel} risk
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          {formatDuration(getTimeDiff(diff.createdAt))} ago
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 text-sm">
          <span className="text-green-600 dark:text-green-400">
            +{diff.additions} additions
          </span>
          <span className="text-red-600 dark:text-red-400">
            -{diff.deletions} deletions
          </span>
        </div>

        {summary && (
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold mb-1">Summary</h4>
              <p className="text-sm text-muted-foreground">{summary.summary}</p>
            </div>

            {summary.highlights.length > 0 && (
              <div>
                <h4 className="font-semibold mb-1">Key Changes</h4>
                <ul className="list-disc list-inside space-y-1">
                  {summary.highlights.map((highlight, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.categories.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {summary.categories.map((category) => (
                  <Badge key={category} variant="outline" className="text-xs">
                    {category.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}