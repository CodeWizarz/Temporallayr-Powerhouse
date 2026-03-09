import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/client';
import { Card, Badge } from '../components/ui';
import { Tabs } from '../components/ui/Tabs';
import { PageHeader } from '../components/shared';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate } from '../lib/utils';
import { AlertTriangle, CheckCircle, Clock, Eye, EyeOff, ExternalLink } from 'lucide-react';
import type { Incident } from '../types';

const STATUS_TABS = [
  { id: 'open', label: 'Open' },
  { id: 'acknowledged', label: 'Acknowledged' },
  { id: 'resolved', label: 'Resolved' },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

function IncidentRow({ incident, onAcknowledge, onResolve }: {
  incident: Incident;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const severityClass = SEVERITY_COLORS[incident.severity] ?? SEVERITY_COLORS.low;

  return (
    <div className="flex items-start gap-4 p-4 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
      <div className={`mt-0.5 p-1.5 rounded-md border ${severityClass}`}>
        <AlertTriangle size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-medium text-[var(--text-primary)] truncate">{incident.title}</h4>
          <Badge variant={incident.severity === 'critical' ? 'error' : 'default'}>
            {incident.severity}
          </Badge>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-2 line-clamp-1">{incident.description}</p>
        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <Clock size={11} /> {formatDate(incident.created_at)}
          </span>
          <span>{incident.service_name}</span>
          {incident.trace_id && (
            <a
              href={`/traces/${incident.trace_id}`}
              className="flex items-center gap-1 text-[var(--accent)] hover:underline"
            >
              <ExternalLink size={11} /> View Trace
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {incident.status === 'open' && (
          <button
            onClick={() => onAcknowledge(incident.id)}
            className="p-1.5 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-yellow-400 transition-colors"
            title="Acknowledge"
          >
            <Eye size={15} />
          </button>
        )}
        {incident.status !== 'resolved' && (
          <button
            onClick={() => onResolve(incident.id)}
            className="p-1.5 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-green-400 transition-colors"
            title="Resolve"
          >
            <CheckCircle size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Incidents() {
  const [activeTab, setActiveTab] = useState('open');
  const queryClient = useQueryClient();

  const { data: incidents, isLoading } = useQuery({
    queryKey: ['incidents', activeTab],
    queryFn: () => api.getIncidents({ status: activeTab }),
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.updateIncident(id, { status: 'acknowledged' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.updateIncident(id, { status: 'resolved' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        subtitle="Track and resolve system incidents"
      />

      <Tabs tabs={STATUS_TABS} activeTab={activeTab} onChange={setActiveTab} />

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !incidents?.length ? (
          <EmptyState
            icon={activeTab === 'resolved' ? CheckCircle : EyeOff}
            title={`No ${activeTab} incidents`}
            description={activeTab === 'open' ? 'All clear! No open incidents right now.' : `No ${activeTab} incidents to display.`}
          />
        ) : (
          incidents.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              onAcknowledge={(id) => ackMutation.mutate(id)}
              onResolve={(id) => resolveMutation.mutate(id)}
            />
          ))
        )}
      </Card>
    </div>
  );
}
