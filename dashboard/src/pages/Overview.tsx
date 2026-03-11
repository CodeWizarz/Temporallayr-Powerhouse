import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, CircleDollarSign, GitBranch, ShieldCheck, Zap } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Button } from '../components/ui';
import { DashboardSection, EmptyPanel, MetricCard, Surface, SurfaceHeader } from '../components/shared';
import { formatCurrency, formatDuration, formatNumber, timeAgo } from '../lib/utils';

function TrendBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);

  return (
    <div className="flex h-[180px] items-end gap-2">
      {values.map((value, index) => (
        <div key={index} className="flex-1 rounded-t-[10px] bg-[linear-gradient(180deg,rgba(201,246,88,0.92),rgba(201,246,88,0.18))]" style={{ height: `${Math.max(12, (value / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const tracesQuery = useQuery({ queryKey: ['overview-executions'], queryFn: () => api.executions.list({ limit: 6 }) });
  const incidentsQuery = useQuery({ queryKey: ['overview-incidents'], queryFn: () => api.incidents.list({ status: 'open', limit: 5 }) });
  const analyticsQuery = useQuery({ queryKey: ['overview-analytics'], queryFn: () => api.getAnalytics({ time_range: '24h' }) });
  const costQuery = useQuery({ queryKey: ['overview-cost'], queryFn: () => api.getCosts({ time_range: '30d' }) });

  const recentTraces = tracesQuery.data?.items ?? [];
  const openIncidents = incidentsQuery.data?.items ?? [];
  const trendBars = useMemo(() => {
    const values = analyticsQuery.data?.services?.map((service: { request_count?: number; avg_latency_ms?: number }) => (service.request_count ?? 0) + (service.avg_latency_ms ?? 0)) ?? [];
    return values.length ? values.slice(0, 10) : [8, 10, 7, 15, 11, 13, 9, 12];
  }, [analyticsQuery.data]);

  const metrics = useMemo(() => {
    const total = tracesQuery.data?.total ?? 0;
    const p95 = analyticsQuery.data?.percentiles?.P95 ?? 0;
    const errors = recentTraces.filter((trace) => trace.status === 'ERROR').length;
    const cost = Number(costQuery.data?.summary.total_cost ?? 0);
    return { total, p95, errors, cost };
  }, [analyticsQuery.data, costQuery.data, recentTraces, tracesQuery.data]);

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Overview"
        title="Observe your system with real hierarchy."
        description="A cleaner control surface for traces, incidents, latency, and cost. Everything important stays above the fold and every panel has a job."
        actions={
          <>
            <Badge variant="accent">24h window</Badge>
            <Button variant="outline" onClick={() => navigate('/traces')}>
              Explore traces
            </Button>
          </>
        }
      />

      <Surface tone="hero">
        <div className="grid gap-5 p-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--text-dim)]">Mission Snapshot</div>
              <div className="mt-3 max-w-2xl text-[28px] font-semibold leading-[1.05] tracking-[-0.06em] text-[var(--text-primary)] md:text-[36px]">
                Production traces, exceptions, and spend in one disciplined surface.
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <MetricCard label="Total traces" value={formatNumber(metrics.total)} hint="Active workspace volume" icon={<GitBranch className="h-5 w-5" />} />
              <MetricCard label="Open incidents" value={String(openIncidents.length)} hint="Clusters needing action" icon={<AlertTriangle className="h-5 w-5" />} />
              <MetricCard label="p95 latency" value={formatDuration(metrics.p95)} hint="Worst service percentile" icon={<Activity className="h-5 w-5" />} />
              <MetricCard label="30d spend" value={formatCurrency(metrics.cost)} hint="Estimated monthly burn" icon={<CircleDollarSign className="h-5 w-5" />} />
            </div>
          </div>

          <div className="rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.015)] p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Throughput shape</div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">Relative request pressure and service load.</div>
              </div>
              <Badge variant="default">Live sample</Badge>
            </div>
            <div className="mt-6">
              <TrendBars values={trendBars} />
            </div>
          </div>
        </div>
      </Surface>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Surface>
          <SurfaceHeader
            title="Recent traces"
            description="Fast access to the latest executions with status, duration, and density."
            actions={
              <Button variant="ghost" onClick={() => navigate('/traces')}>
                View all
                <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
          <div className="px-6 pb-6 pt-3">
            {recentTraces.length === 0 ? (
              <EmptyPanel title="No traces yet" description="Connect a service and send your first execution. This panel will turn into the primary trace feed once data starts flowing." />
            ) : (
              <div className="overflow-hidden rounded-[18px] border border-[var(--border-soft)]">
                <div className="grid grid-cols-[minmax(0,1.6fr)_110px_120px_140px] gap-4 bg-[rgba(255,255,255,0.02)] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  <div>Trace</div>
                  <div>Status</div>
                  <div>Spans</div>
                  <div>Duration</div>
                </div>
                {recentTraces.map((trace) => (
                  <button
                    key={trace.id}
                    onClick={() => navigate(`/traces/${trace.id}`)}
                    className="grid w-full grid-cols-[minmax(0,1.6fr)_110px_120px_140px] gap-4 border-t border-[var(--border-soft)] px-5 py-4 text-left transition hover:bg-white/3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[13px] text-[var(--text-primary)]">{trace.id}</div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">Seen {timeAgo(trace.created_at)}</div>
                    </div>
                    <div>
                      <Badge variant={trace.status === 'ERROR' ? 'error' : 'success'}>{trace.status}</Badge>
                    </div>
                    <div className="text-sm tabular-nums text-[var(--text-secondary)]">{trace.span_count}</div>
                    <div className="text-sm tabular-nums text-[var(--text-secondary)]">{formatDuration(trace.duration_ms)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Surface>

        <div className="space-y-6">
          <Surface tone="muted">
            <SurfaceHeader title="Incident feed" description="Most recent live failures ranked by severity and recency." />
            <div className="px-6 pb-6 pt-2">
              {openIncidents.length === 0 ? (
                <EmptyPanel title="No active incidents" description="When new failure clusters appear, they will show up here with severity, age, and count." />
              ) : (
                <div className="space-y-3">
                  {openIncidents.map((incident) => (
                    <button key={incident.incident_id} onClick={() => navigate('/incidents')} className="w-full rounded-[18px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.015)] px-4 py-4 text-left transition hover:bg-white/4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-[var(--text-primary)]">{incident.error_type || incident.failing_node || incident.cluster_id}</div>
                            <Badge variant={incident.severity === 'critical' ? 'error' : 'warning'}>{incident.severity}</Badge>
                          </div>
                          <div className="mt-2 text-sm text-[var(--text-secondary)]">{incident.count} occurrences on {incident.failing_node || 'unknown node'}</div>
                        </div>
                        <div className="text-xs text-[var(--text-dim)]">{timeAgo(incident.last_seen)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Surface>

          <Surface>
            <SurfaceHeader title="Runtime posture" description="How healthy the current working set looks right now." />
            <div className="grid gap-4 px-6 pb-6 pt-3 md:grid-cols-3">
              <MetricCard label="Healthy traces" value={formatNumber(Math.max(recentTraces.length - metrics.errors, 0))} hint="Recent non-error executions" icon={<ShieldCheck className="h-5 w-5" />} />
              <MetricCard label="Error traces" value={formatNumber(metrics.errors)} hint="Exceptions in recent executions" icon={<AlertTriangle className="h-5 w-5" />} />
              <MetricCard label="Tracked services" value={String(analyticsQuery.data?.services?.length ?? 0)} hint="Services visible in analytics" icon={<Zap className="h-5 w-5" />} />
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}
