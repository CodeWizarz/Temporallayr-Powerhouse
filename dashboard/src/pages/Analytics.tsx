import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, Clock3, GitBranch, Zap } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Tabs } from '../components/ui';
import { DashboardSection, EmptyPanel, MetricCard, Surface, SurfaceHeader } from '../components/shared';
import { TIME_FILTERS } from '../lib/constants';
import { formatDuration, formatNumber, formatPercent } from '../lib/utils';

const METRIC_TABS = [
  { id: 'latency', label: 'Latency' },
  { id: 'throughput', label: 'Throughput' },
  { id: 'errors', label: 'Errors' },
];

function HorizontalBars({
  data,
  suffix,
}: {
  data: Array<{ name: string; value: number }>;
  suffix?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.name}>
          <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
            <div className="truncate text-[var(--text-secondary)]">{item.name}</div>
            <div className="tabular-nums text-[var(--text-primary)]">
              {suffix === '%' ? formatPercent(item.value) : `${formatNumber(item.value)}${suffix ?? ''}`}
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-panel-soft)]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),rgba(201,246,88,0.28))]" style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [timeFilter, setTimeFilter] = useState('24h');
  const [metricTab, setMetricTab] = useState('latency');

  const { data: analytics } = useQuery({
    queryKey: ['analytics', timeFilter],
    queryFn: () => api.getAnalytics({ time_range: timeFilter }),
  });

  const serviceData = useMemo(() => {
    if (!analytics?.services?.length) {
      return [] as Array<{ name: string; value: number }>;
    }

    return analytics.services
      .map((service: { service_name: string; avg_latency_ms: number; request_count: number; error_rate: number }) => ({
        name: service.service_name,
        value: metricTab === 'latency' ? service.avg_latency_ms : metricTab === 'throughput' ? service.request_count : service.error_rate,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [analytics, metricTab]);

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Analytics"
        title="Performance needs hierarchy too."
        description="Latency, throughput, and error rate should read as one coordinated analytics surface instead of disconnected cards."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="default">Real backend</Badge>
            <select
              value={timeFilter}
              onChange={(event) => setTimeFilter(event.target.value)}
              className="rounded-xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
            >
              {TIME_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>{filter.label}</option>
              ))}
            </select>
          </div>
        }
      />

      <Surface tone="hero">
        <div className="grid gap-4 p-6 md:grid-cols-2 2xl:grid-cols-4">
          <MetricCard label="Avg latency" value={formatDuration(analytics?.avg_latency_ms ?? 0)} hint="Mean request time" icon={<Clock3 className="h-5 w-5" />} />
          <MetricCard label="Total requests" value={formatNumber(analytics?.total_requests ?? 0)} hint="Observed in selected window" icon={<GitBranch className="h-5 w-5" />} />
          <MetricCard label="Error rate" value={formatPercent(analytics?.error_rate ?? 0)} hint="Across all visible services" icon={<Activity className="h-5 w-5" />} />
          <MetricCard label="P99 latency" value={formatDuration(analytics?.p99_latency_ms ?? 0)} hint="Tail performance" icon={<Zap className="h-5 w-5" />} />
        </div>
      </Surface>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Surface>
          <SurfaceHeader title="Percentile ladder" description="Latency percentiles, rendered as a quick read instead of isolated widgets." />
          <div className="grid gap-4 px-6 pb-6 pt-4 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(analytics?.percentiles ?? { P50: 0, P95: 0, P99: 0, Errors: 0 }).map(([label, value]) => (
              <div key={label} className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">{label}</div>
                <div className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)] tabular-nums">
                  {label === 'Errors' ? formatNumber(Number(value)) : formatDuration(Number(value))}
                </div>
              </div>
            ))}
          </div>
        </Surface>

        <Surface>
          <SurfaceHeader
            title="Service breakdown"
            description="The highest-signal analytics table in the product: service ranking by selected metric."
            actions={<Tabs tabs={METRIC_TABS} activeTab={metricTab} onChange={setMetricTab} variant="pill" />}
          />
          <div className="px-6 pb-6 pt-4">
            {serviceData.length === 0 ? (
              <EmptyPanel title="No analytics data" description="Once services start reporting spans, this panel will rank them by latency, throughput, and error rate." />
            ) : (
              <HorizontalBars
                data={serviceData}
                suffix={metricTab === 'latency' ? ' ms' : metricTab === 'errors' ? '%' : ''}
              />
            )}
          </div>
        </Surface>
      </div>

      <Surface tone="muted">
        <SurfaceHeader title="Analytics interpretation" description="A small amount of product guidance goes a long way when the data is sparse." />
        <div className="grid gap-4 px-6 pb-6 pt-4 md:grid-cols-3">
          <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">
            Use `P95` and `P99` to spot degradation before averages move.
          </div>
          <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">
            Compare high-throughput services with elevated latency to find scaling pressure.
          </div>
          <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">
            Error rate alone is noisy; correlate it with incident clusters from the incidents view.
          </div>
        </div>
      </Surface>
    </div>
  );
}
