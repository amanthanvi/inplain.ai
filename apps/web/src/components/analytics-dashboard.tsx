'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { Loader2, TrendingUp, Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { OptimizedLoading, SkeletonCard } from '@/components/ui/optimized-loading';
import { AnimatedCard } from '@/components/ui/animated-card';
import { cn } from '@/lib/utils';

interface AnalyticsDashboardProps {
  slug: string;
  className?: string;
}

interface AnalyticsData {
  risk?: any;
  compliance?: any;
  benchmark?: any;
  trends?: any;
}

export function AnalyticsDashboard({ slug, className }: AnalyticsDashboardProps) {
  const { session } = useSession();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('risk');
  const [period, setPeriod] = useState('monthly');
  const [data, setData] = useState<AnalyticsData>({});

  useEffect(() => {
    if (session?.tier && ['premium', 'enterprise'].includes(session.tier)) {
      loadAnalytics();
    }
  }, [slug, activeTab, period, session]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const headers = {
        'Authorization': `Bearer ${session?.sessionId}`,
        'Content-Type': 'application/json'
      };

      switch (activeTab) {
        case 'risk':
          const riskRes = await fetch(`/api/analytics/trends?slug=${slug}&type=risk&period=${period}`, { headers });
          if (riskRes.ok) {
            const riskData = await riskRes.json();
            setData((prev: AnalyticsData) => ({ ...prev, risk: riskData }));
          }
          break;

        case 'compliance':
          const complianceRes = await fetch('/api/analytics/compliance', {
            method: 'POST',
            headers,
            body: JSON.stringify({ slug, snapshotId: 'latest' })
          });
          if (complianceRes.ok) {
            const complianceData = await complianceRes.json();
            setData((prev: AnalyticsData) => ({ ...prev, compliance: complianceData }));
          }
          break;

        case 'benchmark':
          if (session?.tier === 'enterprise') {
            const benchmarkRes = await fetch(`/api/analytics/benchmark?slug=${slug}`, { headers });
            if (benchmarkRes.ok) {
              const benchmarkData = await benchmarkRes.json();
              setData((prev: AnalyticsData) => ({ ...prev, benchmark: benchmarkData }));
            }
          }
          break;

        case 'trends':
          const trendsRes = await fetch(`/api/analytics/trends?slug=${slug}&type=frequency&period=${period}`, { headers });
          if (trendsRes.ok) {
            const trendsData = await trendsRes.json();
            setData((prev: AnalyticsData) => ({ ...prev, trends: trendsData }));
          }
          break;
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!session || !['premium', 'enterprise'].includes(session.tier)) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Advanced Analytics</CardTitle>
          <CardDescription>Upgrade to Premium to access analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Get comprehensive risk analysis, compliance tracking, and industry benchmarks
            </p>
            <Button>Upgrade to Premium</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <AnimatedCard>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Privacy Analytics Dashboard</CardTitle>
              <CardDescription>
                Advanced insights and risk analysis
              </CardDescription>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              {session.tier === 'enterprise' && (
                <TabsTrigger value="benchmark">Benchmark</TabsTrigger>
              )}
            </TabsList>

            <OptimizedLoading isLoading={loading} fallback={<SkeletonCard />}>
              <TabsContent value="risk" className="space-y-4">
                {data.risk && <RiskAnalysisView data={data.risk} />}
              </TabsContent>

              <TabsContent value="compliance" className="space-y-4">
                {data.compliance && <ComplianceView data={data.compliance} />}
              </TabsContent>

              <TabsContent value="trends" className="space-y-4">
                {data.trends && <TrendsView data={data.trends} />}
              </TabsContent>

              {session.tier === 'enterprise' && (
                <TabsContent value="benchmark" className="space-y-4">
                  {data.benchmark && <BenchmarkView data={data.benchmark} />}
                </TabsContent>
              )}
            </OptimizedLoading>
          </Tabs>
        </CardContent>
      </AnimatedCard>
    </div>
  );
}

function RiskAnalysisView({ data }: { data: any }) {
  if (!data.dataPoints || data.dataPoints.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No risk data available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.dataPoints}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#ef4444" 
              fill="#ef4444" 
              fillOpacity={0.3}
              name="Risk Score"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {data.insights && data.insights.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold">Risk Insights</h4>
          {data.insights.map((insight: any, i: number) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              {insight.severity === 'critical' && <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />}
              {insight.severity === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />}
              {insight.severity === 'info' && <Info className="h-5 w-5 text-blue-500 mt-0.5" />}
              <div className="flex-1">
                <p className="text-sm">{insight.description}</p>
                <Badge variant="outline" className="mt-1">
                  {Math.round(insight.confidence * 100)}% confidence
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.predictions && data.predictions.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold">Risk Predictions</h4>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...data.dataPoints, ...data.predictions]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#ef4444" 
                  name="Actual"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="predictedValue" 
                  stroke="#3b82f6" 
                  name="Predicted"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function ComplianceView({ data }: { data: any }) {
  const { report } = data;
  if (!report) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Overall Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{report.overallScore}%</div>
            <Badge 
              variant={report.certificationReady ? 'default' : 'secondary'}
              className="mt-2"
            >
              {report.certificationReady ? 'Certification Ready' : 'Improvements Needed'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Regulations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.regulations.map((reg: any) => (
                <div key={reg.regulation} className="flex items-center justify-between">
                  <span className="text-sm">{reg.regulation.split(' ')[0]}</span>
                  <Badge variant={reg.compliant ? 'default' : 'destructive'}>
                    {reg.score}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Critical Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{report.criticalIssues.length}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Requiring immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {report.regulations.map((reg: any) => (
        <Card key={reg.regulation}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{reg.regulation}</CardTitle>
              <Badge variant={reg.compliant ? 'default' : 'destructive'}>
                {reg.compliant ? 'Compliant' : 'Non-Compliant'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reg.requirements.slice(0, 5).map((req: any) => (
                <div key={req.id} className="flex items-center gap-3">
                  {req.status === 'compliant' && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {req.status === 'partial' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                  {req.status === 'non-compliant' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                  <span className="text-sm flex-1">{req.description}</span>
                  <Badge variant="outline" className="text-xs">
                    {req.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TrendsView({ data }: { data: any }) {
  if (!data.dataPoints || data.dataPoints.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No trend data available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.dataPoints}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#3b82f6" name="Policy Updates" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data.insights && data.insights.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold">Trend Insights</h4>
          {data.insights.map((insight: any, i: number) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm">{insight.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {insight.type}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(insight.confidence * 100)}% confidence
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BenchmarkView({ data }: { data: any }) {
  const { benchmark } = data;
  if (!benchmark) return null;

  const radarData = [
    {
      metric: 'Privacy',
      value: benchmark.metrics.privacyScore,
      industry: benchmark.industry === 'technology' ? 75 : 70
    },
    {
      metric: 'Transparency',
      value: benchmark.metrics.transparencyScore,
      industry: benchmark.industry === 'technology' ? 70 : 65
    },
    {
      metric: 'User Rights',
      value: benchmark.metrics.userRightsScore,
      industry: benchmark.industry === 'technology' ? 80 : 75
    },
    {
      metric: 'Data Protection',
      value: benchmark.metrics.dataProtectionScore,
      industry: benchmark.industry === 'technology' ? 85 : 80
    },
    {
      metric: 'Third-Party Sharing',
      value: 100 - benchmark.metrics.thirdPartySharing,
      industry: benchmark.industry === 'technology' ? 55 : 50
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Industry Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar 
                    name="Your Score" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.6} 
                  />
                  <Radar 
                    name="Industry Avg" 
                    dataKey="industry" 
                    stroke="#ef4444" 
                    fill="#ef4444" 
                    fillOpacity={0.3} 
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Percentile Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(benchmark.percentiles).map(([key, value]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm capitalize">{key}</span>
                    <span className="text-sm font-semibold">{value as number}th percentile</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${value as number}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {benchmark.insights && benchmark.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Industry Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {benchmark.insights.map((insight: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className={cn(
                    "h-2 w-2 rounded-full mt-1.5",
                    insight.type === 'strength' && "bg-green-500",
                    insight.type === 'weakness' && "bg-red-500",
                    insight.type === 'opportunity' && "bg-yellow-500",
                    insight.type === 'trend' && "bg-blue-500"
                  )} />
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">{insight.category}</p>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                    {insight.recommendation && (
                      <p className="text-sm mt-1 text-blue-600">
                        → {insight.recommendation}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {insight.impact}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}