import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/client';
import { Card } from '../components/ui';
import { Tabs } from '../components/ui/Tabs';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/shared';
import { Skeleton } from '../components/ui/Skeleton';
import { TIME_FILTERS } from '../lib/constants';
import { formatDuration, formatNumber } from '../lib/utils';
import { BarChart3, Clock, Zap, TrendingUp, TrendingDown, Activity } from 'lucide-react';

const METRIC_TABS = [
  { id: 'latency', label: 'Latency' },
  { id: 'throughput', label: 'Throughput' },
  { id: 'errors', label: 'Error Rate' },
];

function BarChart({ data, maxValue, label }: { data: { name: string; value: number }[]; maxValue: number; label: string }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-[var(--text-muted)] font-medium mb-3">{label}</div>
      {data.map((item) => (
        <div key={item.name} className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)] w-28 truncate text-right">{item.name}</span>
          <div className="flex-1 h-6 bg-[var(--bg-base)] rounded overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded transition-all duration-500"
              style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-mono text-[var(--text-primary)] w-16 text-right">
            {formatNumber(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function PercentileTable({ data }: { data: Record<string, number> }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {Object.entries(data).map(([pct, val]) => (
        <Card key={pct} className="p-3 text-center">
          <div className="text-xs text-[var(--text-muted)] mb-1">{pct}</div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">{formatDuration(val)}</div>
        </Card>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [timeFilter, setTimeFilter] = useState('24h');
  const [metricTab, setMetricTab] = useState('latency');

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics', timeFilter],
    queryFn: () => api.getAnalytics({ time_range: timeFilter }),
  });

  const serviceData = useMemo(() => {
    if (!analytics?.services) return [];
    return analytics.services
      .map((s: any) => ({
        name: s.service_name,
        value: metricTab === 'latency' ? s.avg_latency_ms : metricTab === 'throughput' ? s.request_count : s.error_rate,
      }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 10);
  }, [analytics, metricTab]);

  const maxValue = serviceData.length > 0 ? Math.max(...serviceData.map((d: any) => d.value)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Analytics" subtitle="Performance metrics and trends" />
        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
          className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        >
          {TIME_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard
              label="Avg Latency"
              value={formatDuration(analytics?.avg_latency_ms ?? 0)}
              icon={Clock}
              trend={analytics?.latency_trend}
            />
            <StatCard
              label="Total Requests"
              value={formatNumber(analytics?.total_requests ?? 0)}
              icon={Zap}
              trend={analytics?.request_trend}
            />
            <StatCard
              label="Error Rate"
              value={`${(analytics?.error_rate ?? 0).toFixed(2)}%`}
              icon={Activity}
              trend={analytics?.error_trend}
              trendInverse
            />
            <StatCard
              label="P99 Latency"
              value={formatDuration(analytics?.p99_latency_ms ?? 0)}
              icon={BarChart3}
            />
          </>
        )}
      </div>

      {/* Percentile Distribution */}
      {analytics?.percentiles && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Latency Percentiles</h3>
          <PercentileTable data={analytics.percentiles} />
        </Card>
      )}

      {/* Service Breakdown */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Service Breakdown</h3>
          <Tabs tabs={METRIC_TABS} activeTab={metricTab} onChange={setMetricTab} />
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : serviceData.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-muted)] text-sm">No service data available</div>
        ) : (
          <BarChart
            data={serviceData}
            maxValue={maxValue}
            label={metricTab === 'latency' ? 'Avg Latency (ms)' : metricTab === 'throughput' ? 'Request Count' : 'Error Rate (%)'}
          />
        )}
      </Card>
    </div>
  );
}
