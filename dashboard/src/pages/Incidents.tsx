import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock3, EyeOff, ShieldAlert } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Button, Card, EmptyState, Tabs } from '../components/ui';
import { PageHeader } from '../components/shared';
import { formatDate, timeAgo } from '../lib/utils';
import type { Incident } from '../types';

const STATUS_TABS = [
  { id: 'open', label: 'Open' },
  { id: 'acknowledged', label: 'Acknowledged' },
  { id: 'resolved', label: 'Resolved' },
] as const;

const SEVERITY_BADGE: Record<Incident['severity'], 'error' | 'warning' | 'info'> = {
  critical: 'error',
  high: 'warning',
  medium: 'warning',
  low: 'info',
};

function IncidentItem({
  incident,
  onAcknowledge,
  onResolve,
}: {
  incident: Incident;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {incident.error_type || incident.failing_node || incident.cluster_id}
                </h3>
                <Badge variant={SEVERITY_BADGE[incident.severity]}>{incident.severity}</Badge>
              </div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">
                Cluster `{incident.cluster_id}` on `{incident.failing_node || 'unknown node'}`
              </div>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-[var(--text-secondary)] md:grid-cols-4">
            <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">First Seen</div>
              <div className="mt-1">{formatDate(incident.first_seen, { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Last Seen</div>
              <div className="mt-1">{timeAgo(incident.last_seen)}</div>
            </div>
            <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Occurrences</div>
              <div className="mt-1 tabular-nums">{incident.count.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">State</div>
              <div className="mt-1 capitalize">{incident.status}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {incident.status === 'open' && (
            <Button variant="outline" onClick={() => onAcknowledge(incident.incident_id)}>
              Acknowledge
            </Button>
          )}
          {incident.status !== 'resolved' && (
            <Button onClick={() => onResolve(incident.incident_id)}>Resolve</Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Incidents() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]['id']>('open');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['incidents', status],
    queryFn: () => api.incidents.list({ status, limit: 50 }),
  });

  const acknowledge = useMutation({
    mutationFn: (id: string) => api.incidents.ack(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => api.incidents.resolve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  });

  const incidents = data?.items ?? [];
  const stats = useMemo(() => {
    const critical = incidents.filter((incident) => incident.severity === 'critical').length;
    const high = incidents.filter((incident) => incident.severity === 'high').length;
    const total = incidents.reduce((sum, incident) => sum + incident.count, 0);
    return { critical, high, total };
  }, [incidents]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-0 shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
        <PageHeader
          title="Incidents"
          subtitle="Resolve regressions, cluster failures, and high-severity exceptions before they cascade."
          actions={<Tabs tabs={STATUS_TABS as unknown as { id: string; label: string }[]} activeTab={status} onChange={(id) => setStatus(id as typeof status)} variant="pill" />}
        />
        <div className="grid gap-4 border-t border-white/6 p-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/6 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <ShieldAlert className="h-4 w-4 text-red-300" />
              Critical
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{stats.critical}</div>
          </div>
          <div className="rounded-2xl border border-white/6 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <Clock3 className="h-4 w-4 text-yellow-300" />
              High Priority
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{stats.high}</div>
          </div>
          <div className="rounded-2xl border border-white/6 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              Occurrences
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{stats.total.toLocaleString()}</div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="h-44 animate-pulse border-white/6 bg-white/3">
              <div />
            </Card>
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <Card className="border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))]">
          <EmptyState
            icon={status === 'resolved' ? CheckCircle2 : EyeOff}
            title={`No ${status} incidents`}
            description={status === 'open' ? 'The system is quiet right now. New incidents will appear here as failure clusters form.' : `There are no ${status} incidents in this window.`}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {incidents.map((incident) => (
            <IncidentItem
              key={incident.incident_id}
              incident={incident}
              onAcknowledge={(id) => acknowledge.mutate(id)}
              onResolve={(id) => resolve.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
