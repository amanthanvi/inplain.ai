'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Database, Zap, TrendingUp, AlertTriangle, Server } from 'lucide-react';
import { AnimatedCard, AnimatedBadge } from '@/components/ui/animated-components';
import { useThemeStore } from '@/lib/theme-system';

interface PerformanceMetrics {
  performance: {
    stats: Record<string, any>;
    slowOperations: Array<{
      label: string;
      avgDuration: number;
      p95: number;
      count: number;
    }>;
    report: string;
  };
  cache: {
    keys: number;
    memory: string;
    hitRate: number;
    effectiveness: Array<{
      label: string;
      hitRate: number;
      avgDuration: number;
    }>;
  };
  timestamp: string;
}

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/metrics');
      if (!res.ok) throw new Error('Failed to fetch metrics');
      const data = await res.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading performance metrics...</div>;
  }

  if (error) {
    return (
      <AnimatedCard className="p-6">
        <div className="flex items-center gap-3 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          <p>Error loading metrics: {error}</p>
        </div>
      </AnimatedCard>
    );
  }

  if (!metrics) return null;

  // Prepare chart data
  const slowOpsData = metrics.performance.slowOperations.map(op => ({
    name: op.label.split(':').pop() || op.label,
    avg: Math.round(op.avgDuration),
    p95: Math.round(op.p95),
    count: op.count
  }));

  const cacheData = metrics.cache.effectiveness.map(item => ({
    name: item.label.split(':').pop() || item.label,
    hitRate: Math.round(item.hitRate),
    avgTime: Math.round(item.avgDuration)
  }));

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Response Time</p>
              <p className="text-2xl font-bold">
                {Object.values(metrics.performance.stats)
                  .filter(s => s?.avgDuration)
                  .reduce((acc, s) => acc + s.avgDuration, 0) / 
                  Object.values(metrics.performance.stats).filter(s => s?.avgDuration).length || 0}
                ms
              </p>
            </div>
            <Activity className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Average across all operations</p>
        </AnimatedCard>

        <AnimatedCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cache Hit Rate</p>
              <p className="text-2xl font-bold">{metrics.cache.hitRate || 0}%</p>
            </div>
            <Database className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{metrics.cache.keys} keys in cache</p>
        </AnimatedCard>

        <AnimatedCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Memory Usage</p>
              <p className="text-2xl font-bold">{metrics.cache.memory}</p>
            </div>
            <Server className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Redis memory consumption</p>
        </AnimatedCard>

        <AnimatedCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Operations</p>
              <p className="text-2xl font-bold">
                {Object.values(metrics.performance.stats)
                  .reduce((acc, s) => acc + (s?.count || 0), 0)}
              </p>
            </div>
            <Zap className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Total tracked operations</p>
        </AnimatedCard>
      </div>

      {/* Slow Operations Chart */}
      {slowOpsData.length > 0 && (
        <AnimatedCard className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Slow Operations
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slowOpsData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: isDark ? '#888' : '#666' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tick={{ fill: isDark ? '#888' : '#666' }}
                  label={{ 
                    value: 'Duration (ms)', 
                    angle: -90, 
                    position: 'insideLeft',
                    fill: isDark ? '#888' : '#666'
                  }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#1a1a1a' : '#fff',
                    border: '1px solid ' + (isDark ? '#333' : '#eee')
                  }}
                />
                <Bar dataKey="avg" fill="#3b82f6" name="Average" />
                <Bar dataKey="p95" fill="#ef4444" name="P95" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnimatedCard>
      )}

      {/* Cache Effectiveness */}
      {cacheData.length > 0 && (
        <AnimatedCard className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Cache Effectiveness
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cacheData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: isDark ? '#888' : '#666' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fill: isDark ? '#888' : '#666' }}
                  label={{ 
                    value: 'Hit Rate (%)', 
                    angle: -90, 
                    position: 'insideLeft',
                    fill: isDark ? '#888' : '#666'
                  }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: isDark ? '#888' : '#666' }}
                  label={{ 
                    value: 'Avg Time (ms)', 
                    angle: 90, 
                    position: 'insideRight',
                    fill: isDark ? '#888' : '#666'
                  }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#1a1a1a' : '#fff',
                    border: '1px solid ' + (isDark ? '#333' : '#eee')
                  }}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="hitRate" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Hit Rate %"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="avgTime" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  name="Avg Time"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </AnimatedCard>
      )}

      {/* Performance Report */}
      <AnimatedCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">Detailed Performance Report</h3>
        <pre className="text-xs font-mono whitespace-pre-wrap bg-muted p-4 rounded overflow-x-auto">
          {metrics.performance.report}
        </pre>
      </AnimatedCard>

      {/* Last Updated */}
      <div className="text-sm text-muted-foreground text-center">
        Last updated: {new Date(metrics.timestamp).toLocaleString()}
      </div>
    </div>
  );
}