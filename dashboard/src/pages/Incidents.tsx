import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Button, Tabs } from '../components/ui';
import { DashboardSection, EmptyPanel, MetricCard, Surface, SurfaceHeader } from '../components/shared';
import { formatDate, formatNumber, timeAgo } from '../lib/utils';
import type { Incident } from '../types';

const STATUS_TABS = [
  { id: 'open', label: 'Open' },
  { id: 'acknowledged', label: 'Acknowledged' },
  { id: 'resolved', label: 'Resolved' },
] as const;

const severityVariant: Record<Incident['severity'], 'error' | 'warning' | 'info'> = {
  critical: 'error',
  high: 'warning',
  medium: 'warning',
  low: 'info',
};

function IncidentRow({
  incident,
  onAcknowledge,
  onResolve,
}: {
  incident: Incident;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.015)] p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  {incident.error_type || incident.failing_node || incident.cluster_id}
                </h3>
                <Badge variant={severityVariant[incident.severity]}>{incident.severity}</Badge>
              </div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">
                Cluster `{incident.cluster_id}` on `{incident.failing_node || 'unknown node'}`
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">First seen</div>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">{formatDate(incident.first_seen, { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Last seen</div>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">{timeAgo(incident.last_seen)}</div>
            </div>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Occurrences</div>
              <div className="mt-2 text-sm tabular-nums text-[var(--text-secondary)]">{formatNumber(incident.count)}</div>
            </div>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">State</div>
              <div className="mt-2 text-sm capitalize text-[var(--text-secondary)]">{incident.status}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {incident.status === 'open' ? (
            <Button variant="outline" onClick={() => onAcknowledge(incident.incident_id)}>
              Acknowledge
            </Button>
          ) : null}
          {incident.status !== 'resolved' ? <Button onClick={() => onResolve(incident.incident_id)}>Resolve</Button> : null}
        </div>
      </div>
    </div>
  );
}

export default function Incidents() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]['id']>('open');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['incidents', status], queryFn: () => api.incidents.list({ status, limit: 50 }) });

  const acknowledge = useMutation({ mutationFn: (id: string) => api.incidents.ack(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }) });
  const resolve = useMutation({ mutationFn: (id: string) => api.incidents.resolve(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }) });

  const incidents = data?.items ?? [];
  const stats = useMemo(() => {
    const critical = incidents.filter((incident) => incident.severity === 'critical').length;
    const active = incidents.filter((incident) => incident.status !== 'resolved').length;
    const total = incidents.reduce((sum, incident) => sum + incident.count, 0);
    return { critical, active, total };
  }, [incidents]);

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Incidents"
        title="Handle real failures with structure."
        description="Incidents should read like an operational queue: severity first, timing second, actions close at hand, and no decorative noise."
        actions={<Tabs tabs={STATUS_TABS as unknown as { id: string; label: string }[]} activeTab={status} onChange={(value) => setStatus(value as typeof status)} variant="pill" />}
      />

      <Surface tone="hero">
        <div className="grid gap-4 p-6 md:grid-cols-3">
          <MetricCard label="Critical incidents" value={formatNumber(stats.critical)} hint="Highest-severity failures" icon={<ShieldAlert className="h-5 w-5" />} />
          <MetricCard label="Active incidents" value={formatNumber(stats.active)} hint="Open or acknowledged" icon={<Clock3 className="h-5 w-5" />} />
          <MetricCard label="Occurrences" value={formatNumber(stats.total)} hint="Observed failure events" icon={<CheckCircle2 className="h-5 w-5" />} />
        </div>
      </Surface>

      <Surface>
        <SurfaceHeader title="Incident queue" description="Every incident item carries the fields you need to triage quickly." />
        <div className="px-6 pb-6 pt-3">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-44 animate-pulse rounded-[18px] bg-white/4" />
              ))}
            </div>
          ) : incidents.length === 0 ? (
            <EmptyPanel
              title={`No ${status} incidents`}
              description={status === 'open' ? 'The system is quiet right now. New failure clusters will appear here as they form.' : `There are no ${status} incidents in the selected view.`}
            />
          ) : (
            <div className="space-y-4">
              {incidents.map((incident) => (
                <IncidentRow
                  key={incident.incident_id}
                  incident={incident}
                  onAcknowledge={(id) => acknowledge.mutate(id)}
                  onResolve={(id) => resolve.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}
