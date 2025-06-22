'use client';

import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import { cn } from '@/lib/utils';
import { AnimatedCard } from '@/components/ui/animated-components';

interface ChartProps {
  data: any[];
  className?: string;
  title?: string;
  description?: string;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-lg border bg-background p-3 shadow-lg"
      >
        <p className="font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </motion.div>
    );
  }
  return null;
};

// Privacy Score Radar Chart
export function PrivacyScoreRadar({
  data,
  className,
  title = 'Privacy Score Breakdown'
}: ChartProps) {
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <AnimatedCard className={className}>
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data}>
          <PolarGrid 
            gridType="polygon"
            stroke="hsl(var(--border))"
            strokeOpacity={0.3}
          />
          <PolarAngleAxis 
            dataKey="category"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 10]}
            tickCount={6}
            tick={{ fontSize: 10 }}
            className="text-muted-foreground"
          />
          <Radar
            name="Current Score"
            dataKey="score"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Radar
            name="Industry Average"
            dataKey="average"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.2}
            strokeWidth={2}
            strokeDasharray="5 5"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
        </RadarChart>
      </ResponsiveContainer>
    </AnimatedCard>
  );
}

// Risk Level Gauge Chart
export function RiskLevelGauge({
  value,
  className,
  title = 'Overall Risk Level'
}: {
  value: number;
  className?: string;
  title?: string;
}) {
  const data = [
    { name: 'Low', value: 33.33, color: '#10b981' },
    { name: 'Medium', value: 33.33, color: '#f59e0b' },
    { name: 'High', value: 33.34, color: '#ef4444' }
  ];

  const needle = (value / 10) * 100;

  return (
    <AnimatedCard className={className}>
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="70%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={80}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="relative -mt-20">
        <motion.div
          className="absolute left-1/2 h-1 w-20 origin-left bg-foreground"
          style={{
            transform: `translateX(-50%) rotate(${(needle * 1.8) - 90}deg)`
          }}
          initial={{ rotate: -90 }}
          animate={{ rotate: (needle * 1.8) - 90 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        <div className="text-center">
          <p className="text-3xl font-bold">{value.toFixed(1)}</p>
          <p className="text-sm text-muted-foreground">Risk Score</p>
        </div>
      </div>
    </AnimatedCard>
  );
}

// Timeline Area Chart
export function TimelineChart({
  data,
  className,
  title = 'Privacy Score Timeline',
  description
}: ChartProps) {
  return (
    <AnimatedCard className={className}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 12 }}
            domain={[0, 10]}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine 
            y={5} 
            stroke="hsl(var(--muted-foreground))" 
            strokeDasharray="3 3"
            label={{ value: "Industry Average", position: "right" }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorScore)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </AnimatedCard>
  );
}

// Comparison Bar Chart
export function ComparisonChart({
  data,
  className,
  title = 'Company Comparison'
}: ChartProps) {
  return (
    <AnimatedCard className={className}>
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
          <XAxis type="number" domain={[0, 10]} stroke="hsl(var(--muted-foreground))" />
          <YAxis type="category" dataKey="company" stroke="hsl(var(--muted-foreground))" />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="privacy" fill="#3b82f6" radius={[0, 4, 4, 0]}>
            {data.map((entry: any, index: number) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.privacy >= 7 ? '#10b981' : entry.privacy >= 4 ? '#f59e0b' : '#ef4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AnimatedCard>
  );
}

// Data Categories Pie Chart
export function DataCategoriesChart({
  data,
  className,
  title = 'Data Collection Categories'
}: ChartProps) {
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

  return (
    <AnimatedCard className={className}>
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </AnimatedCard>
  );
}

// Trend Analysis Line Chart
export function TrendAnalysisChart({
  data,
  className,
  title = 'Privacy Trends',
  metrics = ['privacy', 'transparency', 'control']
}: ChartProps & { metrics?: string[] }) {
  const COLORS = {
    privacy: '#3b82f6',
    transparency: '#10b981',
    control: '#f59e0b',
    security: '#ef4444',
    compliance: '#8b5cf6'
  };

  return (
    <AnimatedCard className={className}>
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 12 }}
            domain={[0, 10]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          {metrics.map((metric) => (
            <Line
              key={metric}
              type="monotone"
              dataKey={metric}
              stroke={COLORS[metric as keyof typeof COLORS]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </AnimatedCard>
  );
}

// Interactive Score Card
export function ScoreCard({
  title,
  value,
  change,
  description,
  icon,
  className
}: {
  title: string;
  value: number | string;
  change?: number;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={cn(
        'rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-lg',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline space-x-2">
            <p className="text-3xl font-bold">{value}</p>
            {change !== undefined && (
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex items-center text-sm font-medium',
                  isPositive && 'text-green-600',
                  isNegative && 'text-red-600',
                  !isPositive && !isNegative && 'text-muted-foreground'
                )}
              >
                {isPositive && '↑'}
                {isNegative && '↓'}
                {Math.abs(change)}%
              </motion.span>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {icon && (
          <div className="rounded-lg bg-primary/10 p-3 text-primary">
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
}