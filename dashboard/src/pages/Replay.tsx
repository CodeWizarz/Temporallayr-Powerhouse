import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/client';
import { Card, Badge, Button } from '../components/ui';
import { PageHeader } from '../components/shared';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate, formatDuration } from '../lib/utils';
import { Play, RotateCcw, Pause, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

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

const STATUS_CONFIG: Record<ReplayStatus, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-yellow-400', label: 'Pending' },
  running: { icon: Loader2, color: 'text-blue-400', label: 'Running' },
  completed: { icon: CheckCircle, color: 'text-green-400', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
};

function ReplayCard({ session }: { session: ReplaySession }) {
  const config = STATUS_CONFIG[session.status];
  const Icon = config.icon;
  const progress = session.total_spans > 0 ? (session.replayed_spans / session.total_spans) * 100 : 0;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium text-[var(--text-primary)]">{session.name}</h4>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">Trace: {session.trace_id.slice(0, 16)}...</p>
        </div>
        <div className={`flex items-center gap-1.5 ${config.color}`}>
          <Icon size={14} className={session.status === 'running' ? 'animate-spin' : ''} />
          <span className="text-xs font-medium">{config.label}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
          <span>{session.replayed_spans} / {session.total_spans} spans</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-[var(--bg-base)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              session.status === 'failed' ? 'bg-red-500' : 'bg-[var(--accent)]'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {session.error_message && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded-md p-2 mb-3">
          {session.error_message}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{formatDate(session.created_at)}</span>
        {session.duration_ms && <span>{formatDuration(session.duration_ms)}</span>}
      </div>
    </Card>
  );
}

export default function Replay() {
  const [traceIdInput, setTraceIdInput] = useState('');

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['replay-sessions'],
    queryFn: () => api.getReplaySessions(),
  });

  const createReplay = useMutation({
    mutationFn: (traceId: string) => api.createReplaySession({ trace_id: traceId }),
  });

  const handleCreate = () => {
    if (traceIdInput.trim()) {
      createReplay.mutate(traceIdInput.trim());
      setTraceIdInput('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Replay"
        subtitle="Re-execute traces to debug and validate fixes"
      />

      {/* Create Replay */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Start New Replay</h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Enter trace ID to replay..."
            value={traceIdInput}
            onChange={(e) => setTraceIdInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1 px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
          <Button onClick={handleCreate} disabled={!traceIdInput.trim() || createReplay.isPending}>
            <Play size={14} className="mr-1.5" />
            {createReplay.isPending ? 'Starting...' : 'Replay'}
          </Button>
        </div>
      </Card>

      {/* Sessions */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Recent Sessions</h3>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : !sessions?.length ? (
          <EmptyState
            icon={RotateCcw}
            title="No replay sessions"
            description="Enter a trace ID above to start your first replay session."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((session: ReplaySession) => (
              <ReplayCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
