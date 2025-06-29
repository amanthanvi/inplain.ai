import React from 'react'
import { AlertTriangle, Plus, Minus, Edit3, ExternalLink, Calendar } from 'lucide-react'
import type { PolicyChange } from '../lib/api'
import { cn, formatDate, getSeverityColor, getSeverityBgColor } from '../lib/utils'

interface PolicyChangesProps {
  changes: PolicyChange[]
  companySlug: string
}

const changeTypeIcons = {
  addition: Plus,
  deletion: Minus,
  modification: Edit3,
}

const changeTypeLabels = {
  addition: 'Added',
  deletion: 'Removed',
  modification: 'Modified',
}

export function PolicyChanges({ changes, companySlug }: PolicyChangesProps) {
  if (changes.length === 0) {
    return (
      <div className="p-6 text-center">
        <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold mb-2">No Recent Changes</h3>
        <p className="text-sm text-muted-foreground mb-4">
          No policy changes detected in the last 90 days
        </p>
        <a
          href={`https://inplain.ai/${companySlug}/policies`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          View Policy History
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="space-y-3">
        {changes.map((change) => {
          const Icon = changeTypeIcons[change.type]
          const label = changeTypeLabels[change.type]
          
          return (
            <div
              key={change.id}
              className="p-3 rounded-md border bg-card"
            >
              {/* Change Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "p-1 rounded",
                    getSeverityBgColor(change.severity)
                  )}>
                    <Icon className={cn(
                      "w-3 h-3",
                      getSeverityColor(change.severity)
                    )} />
                  </div>
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(change.date)}
                  </span>
                </div>
                
                {change.severity === 'high' && (
                  <AlertTriangle className="w-4 h-4 text-risk-high" />
                )}
              </div>

              {/* Section */}
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {change.section}
              </p>

              {/* Summary */}
              <p className="text-sm line-clamp-2">
                {change.summary}
              </p>

              {/* Severity Badge */}
              <div className="mt-2">
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                  getSeverityBgColor(change.severity),
                  getSeverityColor(change.severity)
                )}>
                  {change.severity} impact
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* View All Link */}
      <div className="mt-4 pt-4 border-t text-center">
        <a
          href={`https://inplain.ai/${companySlug}/policies`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          View All Changes
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}