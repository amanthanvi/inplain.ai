'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PrivacyScoreRadar,
  RiskLevelGauge,
  TimelineChart,
  ComparisonChart,
  DataCategoriesChart,
  TrendAnalysisChart,
  ScoreCard
} from '@/components/analytics/interactive-charts';
import {
  AnimatedCard,
  AnimatedButton,
  AnimatedList,
  AnimatedListItem,
  AnimatedBadge,
  AnimatedProgress,
  AnimatedTabs,
  AnimatedModal
} from '@/components/ui/animated-components';
import { 
  Shield, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Info,
  Download,
  Share2,
  Bell,
  Settings,
  ChevronRight,
  Eye,
  Lock,
  Users,
  FileText,
  BarChart3,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/lib/theme-system';

interface DashboardData {
  company: string;
  overallScore: number;
  scoreBreakdown: Array<{ category: string; score: number; average: number }>;
  timeline: Array<{ date: string; score: number }>;
  comparison: Array<{ company: string; privacy: number }>;
  dataCategories: Array<{ name: string; value: number }>;
  trends: Array<{ date: string; privacy: number; transparency: number; control: number }>;
  alerts: Array<{ id: string; type: 'info' | 'warning' | 'error'; title: string; message: string }>;
  insights: Array<{ id: string; title: string; description: string; impact: 'positive' | 'negative' | 'neutral' }>;
}

export function PremiumDashboard({ data }: { data: DashboardData }) {
  const [selectedMetric, setSelectedMetric] = useState<'privacy' | 'transparency' | 'control'>('privacy');
  const [showExportModal, setShowExportModal] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const { theme } = useThemeStore();

  // Calculate changes
  const latestScore = data.timeline[data.timeline.length - 1]?.score || 0;
  const previousScore = data.timeline[data.timeline.length - 2]?.score || latestScore;
  const scoreChange = ((latestScore - previousScore) / previousScore) * 100;

  const riskLevel = latestScore >= 7 ? 'low' : latestScore >= 4 ? 'medium' : 'high';
  const riskColor = riskLevel === 'low' ? 'text-green-600' : riskLevel === 'medium' ? 'text-yellow-600' : 'text-red-600';

  // Dashboard tabs
  const dashboardTabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: <OverviewTab data={data} scoreChange={scoreChange} />
    },
    {
      id: 'analytics',
      label: 'Analytics',
      content: <AnalyticsTab data={data} selectedMetric={selectedMetric} setSelectedMetric={setSelectedMetric} />
    },
    {
      id: 'insights',
      label: 'Insights',
      content: <InsightsTab insights={data.insights} expandedInsight={expandedInsight} setExpandedInsight={setExpandedInsight} />
    },
    {
      id: 'alerts',
      label: 'Alerts',
      content: <AlertsTab alerts={data.alerts} />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{data.company} Privacy Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Real-time privacy policy monitoring and analysis
          </p>
        </div>
        <div className="flex gap-2">
          <AnimatedButton
            variant="secondary"
            size="medium"
            onClick={() => setShowExportModal(true)}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </AnimatedButton>
          <AnimatedButton variant="primary" size="medium">
            <Bell className="mr-2 h-4 w-4" />
            Subscribe
          </AnimatedButton>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ScoreCard
          title="Privacy Score"
          value={latestScore.toFixed(1)}
          change={scoreChange}
          description="Overall privacy rating"
          icon={<Shield className="h-6 w-6" />}
        />
        <ScoreCard
          title="Risk Level"
          value={riskLevel.toUpperCase()}
          description="Current risk assessment"
          icon={<AlertTriangle className={cn('h-6 w-6', riskColor)} />}
        />
        <ScoreCard
          title="Data Categories"
          value={data.dataCategories.length}
          description="Types of data collected"
          icon={<FileText className="h-6 w-6" />}
        />
        <ScoreCard
          title="Last Updated"
          value="2 days ago"
          description="Policy last changed"
          icon={<Activity className="h-6 w-6" />}
        />
      </div>

      {/* Main Content */}
      <AnimatedTabs tabs={dashboardTabs} defaultTab="overview" />

      {/* Export Modal */}
      <AnimatedModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      >
        <ExportModal onClose={() => setShowExportModal(false)} />
      </AnimatedModal>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ data, scoreChange }: { data: DashboardData; scoreChange: number }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RiskLevelGauge 
        value={data.overallScore} 
        title="Overall Privacy Risk Assessment"
      />
      <PrivacyScoreRadar 
        data={data.scoreBreakdown}
        title="Privacy Score Breakdown"
      />
      <TimelineChart 
        data={data.timeline}
        title="Privacy Score Timeline"
        description="Track how privacy practices have evolved over time"
        className="lg:col-span-2"
      />
    </div>
  );
}

// Analytics Tab Component
function AnalyticsTab({ 
  data, 
  selectedMetric, 
  setSelectedMetric 
}: { 
  data: DashboardData; 
  selectedMetric: string;
  setSelectedMetric: (metric: 'privacy' | 'transparency' | 'control') => void;
}) {
  return (
    <div className="space-y-6">
      {/* Metric Selector */}
      <div className="flex gap-2">
        {['privacy', 'transparency', 'control'].map((metric) => (
          <AnimatedButton
            key={metric}
            variant={selectedMetric === metric ? 'primary' : 'ghost'}
            size="small"
            onClick={() => setSelectedMetric(metric as any)}
          >
            {metric.charAt(0).toUpperCase() + metric.slice(1)}
          </AnimatedButton>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ComparisonChart 
          data={data.comparison}
          title="Industry Comparison"
        />
        <DataCategoriesChart 
          data={data.dataCategories}
          title="Data Collection Breakdown"
        />
        <TrendAnalysisChart 
          data={data.trends}
          title="Multi-Metric Trends"
          metrics={['privacy', 'transparency', 'control']}
          className="lg:col-span-2"
        />
      </div>
    </div>
  );
}

// Insights Tab Component
function InsightsTab({ 
  insights, 
  expandedInsight, 
  setExpandedInsight 
}: { 
  insights: DashboardData['insights'];
  expandedInsight: string | null;
  setExpandedInsight: (id: string | null) => void;
}) {
  return (
    <AnimatedList className="space-y-4">
      {insights.map((insight) => (
        <AnimatedListItem key={insight.id}>
          <motion.div
            layout
            onClick={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
            className="cursor-pointer rounded-lg border bg-card p-4 transition-colors hover:bg-accent/5"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <InsightIcon impact={insight.impact} />
                  <h4 className="font-medium">{insight.title}</h4>
                  <AnimatedBadge variant={
                    insight.impact === 'positive' ? 'success' : 
                    insight.impact === 'negative' ? 'error' : 'default'
                  }>
                    {insight.impact}
                  </AnimatedBadge>
                </div>
                <AnimatePresence>
                  {expandedInsight === insight.id && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 text-sm text-muted-foreground"
                    >
                      {insight.description}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              <motion.div
                animate={{ rotate: expandedInsight === insight.id ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </div>
          </motion.div>
        </AnimatedListItem>
      ))}
    </AnimatedList>
  );
}

// Alerts Tab Component
function AlertsTab({ alerts }: { alerts: DashboardData['alerts'] }) {
  const alertIcons = {
    info: Info,
    warning: AlertTriangle,
    error: AlertTriangle
  };

  const alertColors = {
    info: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20',
    warning: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20',
    error: 'text-red-600 bg-red-50 dark:bg-red-950/20'
  };

  return (
    <AnimatedList className="space-y-4">
      {alerts.map((alert) => {
        const Icon = alertIcons[alert.type];
        return (
          <AnimatedListItem key={alert.id}>
            <div className={cn(
              'flex items-start gap-3 rounded-lg p-4',
              alertColors[alert.type]
            )}>
              <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium">{alert.title}</h4>
                <p className="mt-1 text-sm opacity-90">{alert.message}</p>
              </div>
            </div>
          </AnimatedListItem>
        );
      })}
    </AnimatedList>
  );
}

// Export Modal Component
function ExportModal({ onClose }: { onClose: () => void }) {
  const exportOptions = [
    { id: 'pdf', label: 'PDF Report', description: 'Comprehensive analysis report' },
    { id: 'csv', label: 'CSV Data', description: 'Raw data for further analysis' },
    { id: 'json', label: 'JSON Export', description: 'Machine-readable format' }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Export Dashboard Data</h3>
      <p className="text-sm text-muted-foreground">
        Choose your preferred export format
      </p>
      <div className="space-y-2">
        {exportOptions.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/5"
          >
            <input type="radio" name="export" value={option.id} className="mt-1" />
            <div>
              <p className="font-medium">{option.label}</p>
              <p className="text-sm text-muted-foreground">{option.description}</p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <AnimatedButton variant="ghost" onClick={onClose}>
          Cancel
        </AnimatedButton>
        <AnimatedButton variant="primary">
          <Download className="mr-2 h-4 w-4" />
          Export
        </AnimatedButton>
      </div>
    </div>
  );
}

// Helper component for insight icons
function InsightIcon({ impact }: { impact: 'positive' | 'negative' | 'neutral' }) {
  if (impact === 'positive') return <CheckCircle className="h-5 w-5 text-green-600" />;
  if (impact === 'negative') return <AlertTriangle className="h-5 w-5 text-red-600" />;
  return <Info className="h-5 w-5 text-blue-600" />;
}