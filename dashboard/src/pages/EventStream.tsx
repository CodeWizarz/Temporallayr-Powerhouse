import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/client';
import { Card, Badge } from '../components/ui';
import { PageHeader } from '../components/shared';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate } from '../lib/utils';
import { Radio, Filter, Pause, Play, ArrowDown, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

interface StreamEvent {
  id: string;
  type: 'span_created' | 'span_completed' | 'incident_created' | 'alert_triggered' | 'service_registered' | 'error_detected';
  message: string;
  service_name?: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  metadata?: Record<string, any>;
}

const SEVERITY_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  success: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  span_created: 'Span',
  span_completed: 'Span Done',
  incident_created: 'Incident',
  alert_triggered: 'Alert',
  service_registered: 'Service',
  error_detected: 'Error',
};

function EventRow({ event }: { event: StreamEvent }) {
  const config = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.info;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
      <div className={`mt-0.5 p-1.5 rounded-md ${config.bg}`}>
        <Icon size={12} className={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="default">{EVENT_TYPE_LABELS[event.type] ?? event.type}</Badge>
          {event.service_name && (
            <span className="text-xs text-[var(--text-muted)]">{event.service_name}</span>
          )}
        </div>
        <p className="text-sm text-[var(--text-primary)] truncate">{event.message}</p>
      </div>
      <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
        {formatDate(event.timestamp)}
      </span>
    </div>
  );
}

export default function EventStream() {
  const [isPaused, setIsPaused] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const listRef = useRef<HTMLDivElement>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', typeFilter, severityFilter],
    queryFn: () => api.getEvents({
      type: typeFilter !== 'all' ? typeFilter : undefined,
      severity: severityFilter !== 'all' ? severityFilter : undefined,
    }),
    refetchInterval: isPaused ? false : 5000,
  });

  // Auto-scroll to top on new events
  useEffect(() => {
    if (!isPaused && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events, isPaused]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Event Stream"
          subtitle="Real-time system events and notifications"
        />
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-xs ${isPaused ? 'text-yellow-400' : 'text-green-400'}`}>
            <Radio size={12} className={isPaused ? '' : 'animate-pulse'} />
            {isPaused ? 'Paused' : 'Live'}
          </div>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter size={14} className="text-[var(--text-muted)]" />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="all">All Types</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="all">All Severity</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="success">Success</option>
        </select>
        <span className="text-xs text-[var(--text-muted)] ml-auto">
          {events?.length ?? 0} events
        </span>
      </div>

      {/* Event List */}
      <Card>
        <div ref={listRef} className="max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !events?.length ? (
            <EmptyState
              icon={Radio}
              title="No events"
              description={typeFilter !== 'all' || severityFilter !== 'all'
                ? 'No events match the current filters.'
                : 'Waiting for events from your services...'
              }
            />
          ) : (
            events.map((event: StreamEvent) => <EventRow key={event.id} event={event} />)
          )}
        </div>
      </Card>
    </div>
  );
}
