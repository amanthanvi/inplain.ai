'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  AlertTriangle, Shield, TrendingUp, TrendingDown,
  Eye, BarChart3, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { HoverScale, ScaleIn, Counter } from '@/components/ui/framer-animations'

interface RiskData {
  overall: number
  categories: {
    dataCollection: number
    thirdPartySharing: number
    dataRetention: number
    userRights: number
    transparency: number
  }
  trend: 'up' | 'down' | 'stable'
  lastUpdated: string
  alerts: number
}

interface RiskScoreCardProps {
  company: string
  riskData: RiskData
  className?: string
}

export function RiskScoreCard({ company, riskData, className }: RiskScoreCardProps) {
  const getRiskColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-amber-600'
    if (score >= 4) return 'text-orange-600'
    return 'text-red-600'
  }

  const getRiskBg = (score: number) => {
    if (score >= 8) return 'from-green-500 to-emerald-500'
    if (score >= 6) return 'from-amber-500 to-orange-500'
    if (score >= 4) return 'from-orange-500 to-red-500'
    return 'from-red-500 to-rose-500'
  }

  const getRiskLabel = (score: number) => {
    if (score >= 8) return 'Low Risk'
    if (score >= 6) return 'Medium Risk'
    if (score >= 4) return 'High Risk'
    return 'Critical Risk'
  }

  const categories = [
    { key: 'dataCollection', label: 'Data Collection', icon: BarChart3 },
    { key: 'thirdPartySharing', label: 'Third Party Sharing', icon: Eye },
    { key: 'dataRetention', label: 'Data Retention', icon: Clock },
    { key: 'userRights', label: 'User Rights', icon: Shield },
    { key: 'transparency', label: 'Transparency', icon: TrendingUp }
  ]

  return (
    <HoverScale>
      <Card className={cn("glass-card overflow-hidden", className)}>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base md:text-lg truncate">{company}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {riskData.alerts > 0 && (
                <Badge variant="destructive" className="animate-pulse text-xs">
                  {riskData.alerts} alerts
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                Updated {riskData.lastUpdated}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 md:space-y-6">
          {/* Overall Score */}
          <div className="relative">
            <div className="text-center space-y-2">
              <div className="relative inline-block">
                <svg className="w-24 h-24 md:w-32 md:h-32 transform -rotate-90" viewBox="0 0 120 120">
                  {/* Background circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted/20"
                  />
                  
                  {/* Progress circle */}
                  <motion.circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className={cn("transition-all duration-500", getRiskColor(riskData.overall))}
                    initial={{ strokeDasharray: "0 314" }}
                    animate={{ 
                      strokeDasharray: `${(riskData.overall / 10) * 314} 314`
                    }}
                    transition={{ duration: 1.5, delay: 0.2 }}
                  />
                </svg>
                
                {/* Score in center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-bold">
                      <Counter to={riskData.overall} duration={1.5} />
                    </div>
                    <div className="text-xs text-muted-foreground">out of 10</div>
                  </div>
                </div>
              </div>
              
              <div>
                <div className={cn("font-semibold", getRiskColor(riskData.overall))}>
                  {getRiskLabel(riskData.overall)}
                </div>
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  {riskData.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : riskData.trend === 'down' ? (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  ) : null}
                  <span>Privacy Score</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Category Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Risk Categories</h4>
            <div className="space-y-3">
              {categories.map((category, index) => {
                const Icon = category.icon
                const score = riskData.categories[category.key as keyof typeof riskData.categories]
                
                return (
                  <motion.div
                    key={category.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 + 0.5 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{category.label}</span>
                      </div>
                      <span className={cn("text-sm font-medium", getRiskColor(score))}>
                        {score.toFixed(1)}
                      </span>
                    </div>
                    
                    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(score / 10) * 100}%` }}
                        transition={{ duration: 1, delay: index * 0.1 + 0.7 }}
                        className={cn(
                          "h-full bg-gradient-to-r rounded-full",
                          getRiskBg(score)
                        )}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 md:gap-3 pt-3 border-t">
            <div className="text-center">
              <div className="text-sm md:text-lg font-bold">
                <Counter to={riskData.categories.dataCollection} duration={1} />
              </div>
              <div className="text-xs text-muted-foreground">Data Collection</div>
            </div>
            <div className="text-center">
              <div className="text-sm md:text-lg font-bold">
                <Counter to={riskData.categories.userRights} duration={1} />
              </div>
              <div className="text-xs text-muted-foreground">User Rights</div>
            </div>
            <div className="text-center">
              <div className="text-sm md:text-lg font-bold">
                <Counter to={riskData.categories.transparency} duration={1} />
              </div>
              <div className="text-xs text-muted-foreground">Transparency</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </HoverScale>
  )
}