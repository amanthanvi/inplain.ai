import { SnapshotMeta, DiffMeta } from '@policydiff/shared';
import { RiskScorer, RiskScore } from './risk-scorer';

export interface TrendData {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dataPoints: TrendPoint[];
  insights: TrendInsight[];
  predictions?: TrendPrediction[];
}

export interface TrendPoint {
  date: string;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface TrendInsight {
  type: 'increase' | 'decrease' | 'stable' | 'anomaly' | 'pattern';
  description: string;
  severity: 'info' | 'warning' | 'critical';
  confidence: number;
}

export interface TrendPrediction {
  date: string;
  predictedValue: number;
  confidence: number;
  upperBound: number;
  lowerBound: number;
}

export class TrendAnalyzer {
  static async analyzeRiskTrends(
    diffs: DiffMeta[],
    period: TrendData['period'] = 'monthly'
  ): Promise<TrendData> {
    const dataPoints: TrendPoint[] = [];
    const insights: TrendInsight[] = [];

    // Group diffs by period
    const groupedDiffs = this.groupByPeriod(diffs, period);

    // Calculate risk scores for each period
    for (const [periodKey, periodDiffs] of Object.entries(groupedDiffs)) {
      if (periodDiffs.length === 0) continue;

      // Calculate average risk for the period
      let totalRisk = 0;
      for (const diff of periodDiffs) {
        // In a real implementation, we'd fetch the actual diff content
        // For now, we'll simulate with metadata
        const simulatedRisk = this.simulateRiskScore(diff);
        totalRisk += simulatedRisk;
      }

      const avgRisk = totalRisk / periodDiffs.length;
      dataPoints.push({
        date: periodKey,
        value: avgRisk,
        label: `${periodDiffs.length} changes`,
        metadata: {
          changeCount: periodDiffs.length,
          maxRisk: Math.max(...periodDiffs.map(d => this.simulateRiskScore(d))),
          minRisk: Math.min(...periodDiffs.map(d => this.simulateRiskScore(d)))
        }
      });
    }

    // Sort by date
    dataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Analyze trends
    if (dataPoints.length >= 3) {
      // Trend direction
      const recentTrend = this.calculateTrend(dataPoints.slice(-3));
      if (recentTrend > 0.1) {
        insights.push({
          type: 'increase',
          description: `Risk levels have increased ${Math.round(recentTrend * 100)}% over the last 3 periods`,
          severity: recentTrend > 0.3 ? 'warning' : 'info',
          confidence: 0.8
        });
      } else if (recentTrend < -0.1) {
        insights.push({
          type: 'decrease',
          description: `Risk levels have decreased ${Math.round(Math.abs(recentTrend) * 100)}% over the last 3 periods`,
          severity: 'info',
          confidence: 0.8
        });
      } else {
        insights.push({
          type: 'stable',
          description: 'Risk levels have remained relatively stable',
          severity: 'info',
          confidence: 0.7
        });
      }

      // Anomaly detection
      const anomalies = this.detectAnomalies(dataPoints);
      for (const anomaly of anomalies) {
        insights.push({
          type: 'anomaly',
          description: `Unusual risk spike detected on ${anomaly.date} (${Math.round(anomaly.value)}% above average)`,
          severity: anomaly.value > 50 ? 'critical' : 'warning',
          confidence: 0.9
        });
      }

      // Pattern detection
      const patterns = this.detectPatterns(dataPoints);
      for (const pattern of patterns) {
        insights.push({
          type: 'pattern',
          description: pattern.description,
          severity: 'info',
          confidence: pattern.confidence
        });
      }
    }

    // Generate predictions
    const predictions = dataPoints.length >= 5 
      ? this.generatePredictions(dataPoints, period)
      : undefined;

    return {
      period,
      dataPoints,
      insights,
      predictions
    };
  }

  static async analyzeChangeFrequency(
    snapshots: SnapshotMeta[],
    period: TrendData['period'] = 'weekly'
  ): Promise<TrendData> {
    const dataPoints: TrendPoint[] = [];
    const insights: TrendInsight[] = [];

    // Group snapshots by period
    const grouped = this.groupByPeriod(snapshots, period);

    for (const [periodKey, periodSnapshots] of Object.entries(grouped)) {
      dataPoints.push({
        date: periodKey,
        value: periodSnapshots.length,
        label: `${periodSnapshots.length} updates`
      });
    }

    // Sort by date
    dataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Analyze frequency patterns
    if (dataPoints.length >= 4) {
      const avgFrequency = dataPoints.reduce((sum, p) => sum + p.value, 0) / dataPoints.length;
      const recentAvg = dataPoints.slice(-4).reduce((sum, p) => sum + p.value, 0) / 4;

      if (recentAvg > avgFrequency * 1.5) {
        insights.push({
          type: 'increase',
          description: `Update frequency has increased significantly (${Math.round((recentAvg / avgFrequency - 1) * 100)}% above average)`,
          severity: 'warning',
          confidence: 0.85
        });
      }

      // Detect regular patterns
      const regularityScore = this.calculateRegularity(dataPoints);
      if (regularityScore > 0.7) {
        insights.push({
          type: 'pattern',
          description: 'Updates follow a regular schedule',
          severity: 'info',
          confidence: regularityScore
        });
      }
    }

    return {
      period,
      dataPoints,
      insights
    };
  }

  static async analyzeComplianceTrends(
    diffs: DiffMeta[],
    regulations: string[] = ['GDPR', 'CCPA', 'COPPA']
  ): Promise<Record<string, TrendData>> {
    const trends: Record<string, TrendData> = {};

    for (const regulation of regulations) {
      const dataPoints: TrendPoint[] = [];
      const insights: TrendInsight[] = [];

      // Group by month
      const grouped = this.groupByPeriod(diffs, 'monthly');

      for (const [periodKey, periodDiffs] of Object.entries(grouped)) {
        // Count regulation mentions
        let mentionCount = 0;
        for (const diff of periodDiffs) {
          // In real implementation, would analyze actual diff content
          if (Math.random() > 0.7) { // Simulate regulation mention
            mentionCount++;
          }
        }

        dataPoints.push({
          date: periodKey,
          value: mentionCount,
          label: `${mentionCount} ${regulation} updates`
        });
      }

      // Generate insights
      if (dataPoints.some(p => p.value > 0)) {
        insights.push({
          type: 'pattern',
          description: `${regulation} compliance updates detected`,
          severity: 'info',
          confidence: 0.9
        });
      }

      trends[regulation] = {
        period: 'monthly',
        dataPoints,
        insights
      };
    }

    return trends;
  }

  private static groupByPeriod<T extends { capturedAt?: string; createdAt?: string }>(
    items: T[],
    period: TrendData['period']
  ): Record<string, T[]> {
    const grouped: Record<string, T[]> = {};

    for (const item of items) {
      const date = new Date(item.capturedAt || item.createdAt || '');
      let periodKey: string = '';

      switch (period) {
        case 'daily':
          periodKey = date.toISOString().split('T')[0] || '';
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0] || '';
          break;
        case 'monthly':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'quarterly':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          periodKey = `${date.getFullYear()}-Q${quarter}`;
          break;
        default:
          periodKey = date.toISOString().split('T')[0] || '';
      }

      if (!grouped[periodKey]) {
        grouped[periodKey] = [];
      }
      grouped[periodKey]!.push(item);
    }

    return grouped;
  }

  private static calculateTrend(points: TrendPoint[]): number {
    if (points.length < 2) return 0;

    const firstValue = points[0]!.value;
    const lastValue = points[points.length - 1]!.value;
    
    if (firstValue === 0) return lastValue > 0 ? 1 : 0;
    return (lastValue - firstValue) / firstValue;
  }

  private static detectAnomalies(points: TrendPoint[]): TrendPoint[] {
    const values = points.map(p => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );

    const anomalies: TrendPoint[] = [];
    const threshold = mean + 2 * stdDev;

    for (const point of points) {
      if (point.value > threshold) {
        anomalies.push({
          ...point,
          value: ((point.value - mean) / mean) * 100
        });
      }
    }

    return anomalies;
  }

  private static detectPatterns(points: TrendPoint[]): Array<{ description: string; confidence: number }> {
    const patterns: Array<{ description: string; confidence: number }> = [];

    // Check for seasonal patterns
    if (points.length >= 12) {
      const monthlyAverages: Record<number, number[]> = {};
      
      for (const point of points) {
        const month = new Date(point.date).getMonth();
        if (!monthlyAverages[month]) {
          monthlyAverages[month] = [];
        }
        monthlyAverages[month].push(point.value);
      }

      // Find months with consistently high values
      for (const [month, values] of Object.entries(monthlyAverages)) {
        if (values.length >= 2) {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const overallAvg = points.reduce((sum, p) => sum + p.value, 0) / points.length;
          
          if (avg > overallAvg * 1.3) {
            const monthName = new Date(2000, parseInt(month), 1).toLocaleString('default', { month: 'long' });
            patterns.push({
              description: `Higher activity typically observed in ${monthName}`,
              confidence: 0.7
            });
          }
        }
      }
    }

    // Check for increasing/decreasing patterns
    const recentPoints = points.slice(-6);
    if (recentPoints.length >= 6) {
      let increasingCount = 0;
      for (let i = 1; i < recentPoints.length; i++) {
        if (recentPoints[i]!.value > recentPoints[i - 1]!.value) {
          increasingCount++;
        }
      }

      if (increasingCount >= 4) {
        patterns.push({
          description: 'Consistent upward trend in recent periods',
          confidence: increasingCount / (recentPoints.length - 1)
        });
      }
    }

    return patterns;
  }

  private static calculateRegularity(points: TrendPoint[]): number {
    if (points.length < 3) return 0;

    // Calculate intervals between updates
    const intervals: number[] = [];
    for (let i = 1; i < points.length; i++) {
      const interval = new Date(points[i]!.date).getTime() - new Date(points[i - 1]!.date).getTime();
      intervals.push(interval);
    }

    // Calculate variance in intervals
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - avgInterval, 2);
    }, 0) / intervals.length;

    // Convert to regularity score (0-1, where 1 is perfectly regular)
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgInterval;
    
    return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
  }

  private static generatePredictions(
    points: TrendPoint[],
    period: TrendData['period']
  ): TrendPrediction[] {
    const predictions: TrendPrediction[] = [];
    
    // Simple linear regression for predictions
    const n = points.length;
    const x = points.map((_, i) => i);
    const y = points.map(p => p.value);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i]!, 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Generate predictions for next 3 periods
    const lastDate = new Date(points[points.length - 1]!.date);
    
    for (let i = 1; i <= 3; i++) {
      let nextDate: Date;
      
      switch (period) {
        case 'daily':
          nextDate = new Date(lastDate);
          nextDate.setDate(lastDate.getDate() + i);
          break;
        case 'weekly':
          nextDate = new Date(lastDate);
          nextDate.setDate(lastDate.getDate() + i * 7);
          break;
        case 'monthly':
          nextDate = new Date(lastDate);
          nextDate.setMonth(lastDate.getMonth() + i);
          break;
        case 'quarterly':
          nextDate = new Date(lastDate);
          nextDate.setMonth(lastDate.getMonth() + i * 3);
          break;
      }
      
      const predictedValue = intercept + slope * (n + i - 1);
      const confidence = Math.max(0.5, 1 - (i * 0.15)); // Confidence decreases with distance
      const uncertainty = predictedValue * (1 - confidence) * 0.5;
      
      predictions.push({
        date: nextDate.toISOString().split('T')[0] || '',
        predictedValue: Math.max(0, predictedValue),
        confidence,
        upperBound: Math.max(0, predictedValue + uncertainty),
        lowerBound: Math.max(0, predictedValue - uncertainty)
      });
    }
    
    return predictions;
  }

  private static simulateRiskScore(diff: DiffMeta): number {
    // In real implementation, would calculate actual risk score
    // For now, simulate based on metadata
    const baseRisk = Math.random() * 50 + 25;
    const sizeMultiplier = diff.diffBlobKey ? 1.2 : 1.0;
    return baseRisk * sizeMultiplier;
  }
}