import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock3, Loader2, Play, RotateCcw, XCircle } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Button } from '../components/ui';
import { DashboardSection, EmptyPanel, MetricCard, Surface, SurfaceHeader } from '../components/shared';
import { formatDate, formatDuration } from '../lib/utils';

type ReplayStatus = 'pending' | 'running' | 'completed' | 'failed';

interface ReplaySession {
  id: string;
  name: string;
  trace_id: string;
  status: ReplayStatus;
  created_at: string;
  completed_at?: string;
  duration_ms?: number;
  total_spans: number;
  replayed_spans: number;
  error_message?: string;
}

const STATUS_CONFIG: Record<ReplayStatus, { icon: typeof Clock3; variant: 'warning' | 'info' | 'success' | 'error'; label: string }> = {
  pending: { icon: Clock3, variant: 'warning', label: 'Pending' },
  running: { icon: Loader2, variant: 'info', label: 'Running' },
  completed: { icon: CheckCircle, variant: 'success', label: 'Completed' },
  failed: { icon: XCircle, variant: 'error', label: 'Failed' },
};

export default function Replay() {
  const [traceIdInput, setTraceIdInput] = useState('');
  const queryClient = useQueryClient();
  const { data: sessions } = useQuery({ queryKey: ['replay-sessions'], queryFn: () => api.getReplaySessions() });

  const createReplay = useMutation({
    mutationFn: (traceId: string) => api.createReplaySession({ trace_id: traceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replay-sessions'] });
      setTraceIdInput('');
    },
  });

  const list = (sessions ?? []) as ReplaySession[];
  const stats = {
    total: list.length,
    completed: list.filter((session) => session.status === 'completed').length,
    failed: list.filter((session) => session.status === 'failed').length,
  };

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Replay Lab"
        title="Replay should feel like a tool, not a form." 
        description="This surface is designed around the real workflow: paste a trace id, launch a replay, and inspect the latest run state immediately."
      />

      <Surface tone="hero">
        <div className="grid gap-6 p-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.018)] p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-dim)]">Launch replay</div>
            <div className="mt-3 text-sm text-[var(--text-secondary)]">Start from a known trace id and compare deterministic behavior over time.</div>
            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <input value={traceIdInput} onChange={(event) => setTraceIdInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && traceIdInput.trim() && createReplay.mutate(traceIdInput.trim())} placeholder="Enter trace ID..." className="h-12 flex-1 rounded-2xl border border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)] px-4 text-sm text-[var(--text-primary)] outline-none" />
              <Button onClick={() => createReplay.mutate(traceIdInput.trim())} disabled={!traceIdInput.trim() || createReplay.isPending}>
                <Play className="h-4 w-4" />
                {createReplay.isPending ? 'Starting...' : 'Start replay'}
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <MetricCard label="Sessions" value={String(stats.total)} hint="Stored locally" icon={<RotateCcw className="h-5 w-5" />} />
            <MetricCard label="Completed" value={String(stats.completed)} hint="Successful replays" icon={<CheckCircle className="h-5 w-5" />} />
            <MetricCard label="Failed" value={String(stats.failed)} hint="Runs with divergence" icon={<XCircle className="h-5 w-5" />} />
          </div>
        </div>
      </Surface>

      <Surface>
        <SurfaceHeader title="Recent replay sessions" description="Compact, readable run cards with progress and failure state." />
        <div className="px-6 pb-6 pt-4">
          {list.length === 0 ? (
            <EmptyPanel title="No replay sessions" description="Enter a trace id above to start your first replay session. Sessions are currently stored locally for this frontend workflow." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((session) => {
                const config = STATUS_CONFIG[session.status];
                const Icon = config.icon;
                const progress = session.total_spans > 0 ? (session.replayed_spans / session.total_spans) * 100 : 0;

                return (
                  <div key={session.id} className="rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.015)] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-medium text-[var(--text-primary)]">{session.name}</div>
                        <div className="mt-1 font-mono text-xs text-[var(--text-dim)]">{session.trace_id.slice(0, 18)}</div>
                      </div>
                      <Badge variant={config.variant}><Icon className={`mr-1 h-3 w-3 ${session.status === 'running' ? 'animate-spin' : ''}`} />{config.label}</Badge>
                    </div>
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                        <span>{session.replayed_spans} / {session.total_spans} spans</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-panel-soft)]">
                        <div className={`h-full rounded-full ${session.status === 'failed' ? 'bg-red-400' : 'bg-[var(--accent)]'}`} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    {session.error_message ? <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-3 text-sm text-red-300">{session.error_message}</div> : null}
                    <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span>{formatDate(session.created_at)}</span>
                      <span>{session.duration_ms ? formatDuration(session.duration_ms) : '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}
