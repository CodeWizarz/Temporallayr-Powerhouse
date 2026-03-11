import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle, Server, XCircle } from 'lucide-react';
import { api } from '../lib/client';
import { Badge } from '../components/ui';
import { DashboardSection, EmptyPanel, MetricCard, Surface, SurfaceHeader } from '../components/shared';
import { formatDate, formatNumber } from '../lib/utils';

interface ServiceStatus {
  service_name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latency_ms: number;
  error_rate: number;
  uptime_pct: number;
  last_seen: string;
  span_count_24h: number;
}

export default function Status() {
  const { data } = useQuery({ queryKey: ['service-status'], queryFn: () => api.getServiceStatus(), refetchInterval: 30000 });
  const services = (data ?? []) as ServiceStatus[];

  const stats = useMemo(() => ({
    total: services.length,
    healthy: services.filter((service) => service.status === 'healthy').length,
    degraded: services.filter((service) => service.status === 'degraded').length,
    down: services.filter((service) => service.status === 'down').length,
  }), [services]);

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Status"
        title="Service health with better operational structure."
        description="This is the system view: fleet count, current state split, and a ranked service list that prioritizes degradation over decoration."
        actions={<Badge variant="default">Auto refresh 30s</Badge>}
      />

      <Surface tone="hero">
        <div className="grid gap-4 p-6 md:grid-cols-2 2xl:grid-cols-4">
          <MetricCard label="Total services" value={formatNumber(stats.total)} hint="Visible in current workspace" icon={<Server className="h-5 w-5" />} />
          <MetricCard label="Healthy" value={formatNumber(stats.healthy)} hint="No visible degradation" icon={<CheckCircle className="h-5 w-5" />} />
          <MetricCard label="Degraded" value={formatNumber(stats.degraded)} hint="Investigate quickly" icon={<AlertTriangle className="h-5 w-5" />} />
          <MetricCard label="Down" value={formatNumber(stats.down)} hint="Highest urgency" icon={<XCircle className="h-5 w-5" />} />
        </div>
      </Surface>

      <Surface>
        <SurfaceHeader title="Service fleet" description="Sorted by operational priority so broken services float to the top." />
        <div className="px-6 pb-6 pt-4">
          {services.length === 0 ? (
            <EmptyPanel title="No services registered" description="Once workloads begin sending traces, they will appear here with uptime, latency, and 24h volume." />
          ) : (
            <div className="overflow-hidden rounded-[20px] border border-[var(--border-soft)]">
              <div className="grid grid-cols-[minmax(0,1.4fr)_110px_110px_110px_130px] gap-4 bg-[rgba(255,255,255,0.02)] px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                <div>Service</div>
                <div>Uptime</div>
                <div>Latency</div>
                <div>Error</div>
                <div>Volume</div>
              </div>
              {services
                .sort((a, b) => {
                  const order = { down: 0, degraded: 1, unknown: 2, healthy: 3 };
                  return (order[a.status] ?? 4) - (order[b.status] ?? 4);
                })
                .map((service) => (
                  <div key={service.service_name} className="grid grid-cols-[minmax(0,1.4fr)_110px_110px_110px_130px] gap-4 border-t border-[var(--border-soft)] px-5 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-[var(--text-primary)]">{service.service_name}</div>
                        <Badge variant={service.status === 'healthy' ? 'success' : service.status === 'degraded' ? 'warning' : 'error'}>{service.status}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">Last seen {formatDate(service.last_seen)}</div>
                    </div>
                    <div className="text-sm tabular-nums text-[var(--text-primary)]">{service.uptime_pct.toFixed(2)}%</div>
                    <div className="text-sm tabular-nums text-[var(--text-secondary)]">{service.latency_ms.toFixed(0)}ms</div>
                    <div className="text-sm tabular-nums text-[var(--text-secondary)]">{service.error_rate.toFixed(2)}%</div>
                    <div className="text-sm tabular-nums text-[var(--text-secondary)]">{formatNumber(service.span_count_24h)}</div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Surface>

      <Surface tone="muted">
        <SurfaceHeader title="Operational guidance" description="A short explanation layer helps this page carry meaning even with sparse backend health data." />
        <div className="grid gap-4 px-6 pb-6 pt-4 md:grid-cols-3">
          <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">
            Prioritize services that are both degraded and high-volume.
          </div>
          <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">
            Compare status here with incidents to distinguish infra noise from recurring failure clusters.
          </div>
          <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">
            High latency plus normal uptime usually points to saturation, not availability loss.
          </div>
        </div>
      </Surface>
    </div>
  );
}
