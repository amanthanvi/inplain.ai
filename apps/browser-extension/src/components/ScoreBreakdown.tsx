import React from 'react'
import { Shield, Database, Share2, UserCheck, Lock, Clock } from 'lucide-react'
import type { PrivacyScore } from '../lib/api'
import { cn, getScoreColor, getScoreBgColor } from '../lib/utils'

interface ScoreBreakdownProps {
  score: PrivacyScore
}

const categories = [
  {
    key: 'dataCollection' as const,
    label: 'Data Collection',
    icon: Database,
    description: 'What information is collected about you'
  },
  {
    key: 'dataSharing' as const,
    label: 'Data Sharing',
    icon: Share2,
    description: 'How your data is shared with third parties'
  },
  {
    key: 'userRights' as const,
    label: 'User Rights',
    icon: UserCheck,
    description: 'Your rights and control over your data'
  },
  {
    key: 'security' as const,
    label: 'Security',
    icon: Lock,
    description: 'How your data is protected'
  },
  {
    key: 'retention' as const,
    label: 'Data Retention',
    icon: Clock,
    description: 'How long your data is kept'
  }
]

export function ScoreBreakdown({ score }: ScoreBreakdownProps) {
  return (
    <div className="p-4 space-y-4">
      {/* Overall Score */}
      <div className="text-center py-4">
        <div className={cn(
          "inline-flex items-center justify-center w-24 h-24 rounded-full mb-3",
          getScoreBgColor(score.score)
        )}>
          <Shield className={cn("w-10 h-10", getScoreColor(score.score))} />
        </div>
        <h3 className={cn(
          "text-2xl font-bold",
          getScoreColor(score.score)
        )}>
          {score.score}/100
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Overall Privacy Score
        </p>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Score Breakdown</h4>
        
        {categories.map(({ key, label, icon: Icon, description }) => {
          const categoryScore = score.breakdown[key]
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <span className={cn(
                  "text-sm font-semibold",
                  getScoreColor(categoryScore)
                )}>
                  {categoryScore}/100
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all",
                    categoryScore >= 80 ? "bg-risk-low" :
                    categoryScore >= 60 ? "bg-risk-medium" :
                    "bg-risk-high"
                  )}
                  style={{ width: `${categoryScore}%` }}
                />
              </div>
              
              <p className="text-xs text-muted-foreground">
                {description}
              </p>
            </div>
          )
        })}
      </div>

      {/* Last Updated */}
      <div className="pt-4 border-t text-center">
        <p className="text-xs text-muted-foreground">
          Score last updated {new Date(score.lastUpdated).toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}