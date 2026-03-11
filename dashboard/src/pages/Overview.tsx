import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, DollarSign, GitBranch, ShieldCheck, Zap } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Button, Card } from '../components/ui';
import { PageHeader } from '../components/shared';
import { formatCurrency, formatDuration, formatNumber, timeAgo } from '../lib/utils';

function MetricStrip({
  label,
  value,
  meta,
  icon,
}: {
  label: string;
  value: string;
  meta: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.012))] shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)] tabular-nums">{value}</div>
          <div className="mt-2 text-sm text-[var(--text-muted)]">{meta}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/6 bg-black/20 text-[var(--accent)]">
          {icon}
        </div>
      </div>
    </Card>
  );
}

export default function Overview() {
  const navigate = useNavigate();

  const tracesQuery = useQuery({
    queryKey: ['overview-executions'],
    queryFn: () => api.executions.list({ limit: 8 }),
  });

  const incidentsQuery = useQuery({
    queryKey: ['overview-incidents'],
    queryFn: () => api.incidents.list({ status: 'open', limit: 6 }),
  });

  const analyticsQuery = useQuery({
    queryKey: ['overview-analytics'],
    queryFn: () => api.getAnalytics({ time_range: '24h' }),
  });

  const costQuery = useQuery({
    queryKey: ['overview-cost'],
    queryFn: () => api.getCosts({ time_range: '30d' }),
  });

  const recentTraces = tracesQuery.data?.items ?? [];
  const openIncidents = incidentsQuery.data?.items ?? [];

  const metrics = useMemo(() => {
    const total = tracesQuery.data?.total ?? 0;
    const errors = recentTraces.filter((trace) => trace.status === 'ERROR').length;
    const p95 = analyticsQuery.data?.services?.length
      ? Math.max(...analyticsQuery.data.services.map((service: { avg_latency_ms: number }) => service.avg_latency_ms))
      : 0;
    const estCost = Number(costQuery.data?.summary.total_cost ?? 0);
    return { total, errors, p95, estCost };
  }, [analyticsQuery.data, costQuery.data, recentTraces, tracesQuery.data]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/6 bg-[radial-gradient(circle_at_top_left,rgba(210,255,92,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-0 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
        <PageHeader
          title="Overview"
          subtitle="Mission Control for traces, failures, latency, and spend across your AI stack."
          actions={
            <div className="flex items-center gap-2">
              <Badge variant="accent">24h live window</Badge>
              <Button variant="outline" onClick={() => navigate('/traces')}>
                Explore traces
              </Button>
            </div>
          }
        />
        <div className="grid gap-4 border-t border-white/6 p-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricStrip
            label="Total Traces"
            value={formatNumber(metrics.total)}
            meta="Captured in the active workspace"
            icon={<GitBranch className="h-5 w-5" />}
          />
          <MetricStrip
            label="Open Incidents"
            value={String(openIncidents.length)}
            meta="Failure clusters requiring attention"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <MetricStrip
            label="p95 Latency"
            value={formatDuration(metrics.p95)}
            meta="Worst-case service average in the last 24h"
            icon={<Activity className="h-5 w-5" />}
          />
          <MetricStrip
            label="30d Cost"
            value={formatCurrency(metrics.estCost)}
            meta="LLM and tracing spend estimate"
            icon={<DollarSign className="h-5 w-5" />}
          />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <Card className="overflow-hidden border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] p-0">
          <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent Traces</h2>
              <p className="text-sm text-[var(--text-muted)]">High-signal executions from the last polling window.</p>
            </div>
            <Button variant="ghost" onClick={() => navigate('/traces')}>
              View all
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="divide-y divide-white/6">
            {tracesQuery.isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse bg-white/3" />
              ))
            ) : recentTraces.length === 0 ? (
              <div className="px-5 py-10 text-sm text-[var(--text-muted)]">No traces yet. Connect a service to begin capturing executions.</div>
            ) : (
              recentTraces.map((trace) => (
                <button
                  key={trace.id}
                  onClick={() => navigate(`/traces/${trace.id}`)}
                  className="grid w-full grid-cols-[minmax(0,1.6fr)_100px_100px_130px] items-center gap-4 px-5 py-4 text-left transition hover:bg-white/3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-[var(--text-secondary)]">{trace.id}</div>
                    <div className="mt-1 text-sm text-[var(--text-muted)]">Seen {timeAgo(trace.created_at)}</div>
                  </div>
                  <div>
                    <Badge variant={trace.status === 'ERROR' ? 'error' : 'success'}>{trace.status}</Badge>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] tabular-nums">{trace.span_count} spans</div>
                  <div className="text-sm text-[var(--text-secondary)] tabular-nums">{formatDuration(trace.duration_ms)}</div>
                </button>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] p-0">
            <div className="border-b border-white/6 px-5 py-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Incident Feed</h2>
              <p className="text-sm text-[var(--text-muted)]">Active clusters ranked by recency and severity.</p>
            </div>
            <div className="divide-y divide-white/6">
              {incidentsQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse bg-white/3" />
                ))
              ) : openIncidents.length === 0 ? (
                <div className="px-5 py-10 text-sm text-[var(--text-muted)]">All quiet. No active incidents right now.</div>
              ) : (
                openIncidents.map((incident) => (
                  <button
                    key={incident.incident_id}
                    onClick={() => navigate('/incidents')}
                    className="w-full px-5 py-4 text-left transition hover:bg-white/3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--text-primary)]">{incident.error_type || incident.failing_node || incident.cluster_id}</span>
                          <Badge variant={incident.severity === 'critical' ? 'error' : 'warning'}>{incident.severity}</Badge>
                        </div>
                        <div className="mt-1 text-sm text-[var(--text-muted)]">{incident.count} occurrences on {incident.failing_node || 'unknown node'}</div>
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">{timeAgo(incident.last_seen)}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="overflow-hidden border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] p-0">
            <div className="border-b border-white/6 px-5 py-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Runtime Posture</h2>
              <p className="text-sm text-[var(--text-muted)]">Signals inferred from the latest trace and analytics window.</p>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <div className="rounded-2xl border border-white/6 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" /> Healthy traces
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatNumber(Math.max(recentTraces.length - metrics.errors, 0))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/6 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <AlertTriangle className="h-4 w-4 text-red-300" /> Erroring traces
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{metrics.errors}</div>
              </div>
              <div className="rounded-2xl border border-white/6 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <Zap className="h-4 w-4 text-[var(--accent)]" /> Services tracked
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                  {analyticsQuery.data?.services?.length ?? 0}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
