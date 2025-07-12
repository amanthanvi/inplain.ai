/**
 * Privacy Score Card Component
 * 
 * Compact privacy score display for company cards and lists
 * Shows grade, risk level, and key metrics in a condensed format
 */

'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Shield, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface PrivacyScoreCardProps {
  score: number
  grade: string
  riskLevel: 'Low' | 'Medium' | 'High'
  trend?: 'improving' | 'stable' | 'worsening'
  lastUpdated?: string
  breakdown?: {
    dataCollection: number
    userRights: number
    dataSharing: number
    security: number
  }
  compact?: boolean
  animate?: boolean
}

const gradeColors = {
  'A+': 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  'A': 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  'A-': 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  'B+': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  'B': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  'B-': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  'C+': 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  'C': 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  'C-': 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  'D+': 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
  'D': 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
  'D-': 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
  'F': 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
}

const riskStyles = {
  Low: {
    color: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-100 dark:bg-green-900/20',
    icon: Shield
  },
  Medium: {
    color: 'text-yellow-700 dark:text-yellow-300',
    bg: 'bg-yellow-100 dark:bg-yellow-900/20',
    icon: Shield
  },
  High: {
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-100 dark:bg-red-900/20',
    icon: AlertTriangle
  }
}

export function PrivacyScoreCard({
  score,
  grade,
  riskLevel,
  trend,
  lastUpdated,
  breakdown,
  compact = false,
  animate = true
}: PrivacyScoreCardProps) {
  const RiskIcon = riskStyles[riskLevel].icon
  const gradeStyle = gradeColors[grade as keyof typeof gradeColors] || gradeColors['F']

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <motion.div
                initial={animate ? { scale: 0 } : undefined}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg',
                  gradeStyle
                )}
              >
                {grade}
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-semibold">Privacy Score: {score}/100</p>
                <p className="text-xs">Risk Level: {riskLevel}</p>
                {lastUpdated && (
                  <p className="text-xs text-muted-foreground">
                    Updated: {new Date(lastUpdated).toLocaleDateString()}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Progress value={score} className="h-2 flex-1" />
            {trend && (
              <div className="flex items-center">
                {trend === 'improving' && <TrendingUp className="w-3 h-3 text-green-500" />}
                {trend === 'worsening' && <TrendingDown className="w-3 h-3 text-red-500" />}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn('text-xs', riskStyles[riskLevel].bg, riskStyles[riskLevel].color)}>
              <RiskIcon className="w-3 h-3 mr-1" />
              {riskLevel} Risk
            </Badge>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Main Score Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            initial={animate ? { scale: 0 } : undefined}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl',
              gradeStyle
            )}
          >
            {grade}
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Privacy Score</h3>
              {trend && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      {trend === 'improving' && <TrendingUp className="w-4 h-4 text-green-500" />}
                      {trend === 'worsening' && <TrendingDown className="w-4 h-4 text-red-500" />}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Score is {trend}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-2xl font-bold">{score}/100</p>
          </div>
        </div>
        
        <Badge className={cn(riskStyles[riskLevel].bg, riskStyles[riskLevel].color)}>
          <RiskIcon className="w-3 h-3 mr-1" />
          {riskLevel} Risk
        </Badge>
      </div>

      {/* Score Breakdown */}
      {breakdown && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Score Breakdown</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Data Collection</span>
                <span className="font-medium">{breakdown.dataCollection}</span>
              </div>
              <Progress value={breakdown.dataCollection} className="h-1.5" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>User Rights</span>
                <span className="font-medium">{breakdown.userRights}</span>
              </div>
              <Progress value={breakdown.userRights} className="h-1.5" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Data Sharing</span>
                <span className="font-medium">{breakdown.dataSharing}</span>
              </div>
              <Progress value={breakdown.dataSharing} className="h-1.5" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Security</span>
                <span className="font-medium">{breakdown.security}</span>
              </div>
              <Progress value={breakdown.security} className="h-1.5" />
            </div>
          </div>
        </div>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Last analyzed: {new Date(lastUpdated).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}