import React, { useState } from 'react'
import { 
  ExternalLink, 
  Eye, 
  EyeOff, 
  TrendingUp, 
  AlertTriangle,
  ChevronRight,
  Clock,
  Shield,
  FileText
} from 'lucide-react'
import type { Company, PrivacyScore, PolicyChange } from '../lib/api'
import { cn, formatDate, getScoreColor, getScoreBgColor, getSeverityColor, getSeverityBgColor } from '../lib/utils'
import { ScoreBreakdown } from './ScoreBreakdown'
import { PolicyChanges } from './PolicyChanges'

interface CompanyViewProps {
  domain: string
  company: Company
  score: PrivacyScore | null
  changes: PolicyChange[]
  isWatched: boolean
  onToggleWatchlist: () => void
}

type Tab = 'overview' | 'score' | 'changes'

export function CompanyView({
  domain,
  company,
  score,
  changes,
  isWatched,
  onToggleWatchlist
}: CompanyViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const recentChanges = changes.filter(change => {
    const changeDate = new Date(change.date)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return changeDate > thirtyDaysAgo
  })

  const hasHighSeverityChanges = recentChanges.some(c => c.severity === 'high')

  return (
    <div className="flex flex-col h-full">
      {/* Company Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{company.name}</h2>
            <p className="text-sm text-muted-foreground">{domain}</p>
          </div>
          <button
            onClick={onToggleWatchlist}
            className={cn(
              "p-2 rounded-md transition-colors",
              isWatched 
                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                : "bg-secondary hover:bg-secondary/80"
            )}
            title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
          >
            {isWatched ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          {score && (
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-md",
              getScoreBgColor(score.score)
            )}>
              <Shield className={cn("w-4 h-4", getScoreColor(score.score))} />
              <div>
                <p className="text-xs text-muted-foreground">Privacy Score</p>
                <p className={cn("text-sm font-semibold", getScoreColor(score.score))}>
                  {score.score}/100
                </p>
              </div>
            </div>
          )}
          
          {recentChanges.length > 0 && (
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-md",
              hasHighSeverityChanges ? "bg-risk-high/10" : "bg-muted"
            )}>
              <AlertTriangle className={cn(
                "w-4 h-4",
                hasHighSeverityChanges ? "text-risk-high" : "text-muted-foreground"
              )} />
              <div>
                <p className="text-xs text-muted-foreground">Recent Changes</p>
                <p className={cn(
                  "text-sm font-semibold",
                  hasHighSeverityChanges ? "text-risk-high" : "text-foreground"
                )}>
                  {recentChanges.length}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "flex-1 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === 'overview' 
              ? "text-primary border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('score')}
          className={cn(
            "flex-1 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === 'score' 
              ? "text-primary border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Score Details
        </button>
        <button
          onClick={() => setActiveTab('changes')}
          className={cn(
            "flex-1 px-4 py-2 text-sm font-medium transition-colors relative",
            activeTab === 'changes' 
              ? "text-primary border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Changes
          {recentChanges.length > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            {/* Company Info */}
            <div>
              <h3 className="text-sm font-semibold mb-2">About</h3>
              <p className="text-sm text-muted-foreground">{company.description}</p>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <a
                href={company.privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm">View Privacy Policy</span>
                </div>
                <ExternalLink className="w-4 h-4" />
              </a>

              <a
                href={`https://inplain.ai/${company.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">View Full Analysis</span>
                </div>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Last Checked */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Last checked {formatDate(company.lastChecked)}</span>
            </div>
          </div>
        )}

        {activeTab === 'score' && score && (
          <ScoreBreakdown score={score} />
        )}

        {activeTab === 'changes' && (
          <PolicyChanges changes={changes} companySlug={company.slug} />
        )}
      </div>
    </div>
  )
}