import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Clock3, GitBranch, Layers3, ShieldCheck } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Button, Card, EmptyState } from '../components/ui';
import { PageHeader } from '../components/shared';
import { buildSpanTree, formatDate, formatDuration } from '../lib/utils';
import type { SpanNode } from '../types';

function SpanRow({ node, maxDuration }: { node: SpanNode; maxDuration: number }) {
  const width = Math.max(6, Math.round((node.duration_ms / Math.max(maxDuration, 1)) * 100));
  const badgeVariant = node.status === 'ERROR' ? 'error' : node.status === 'TIMEOUT' ? 'warning' : 'success';

  return (
    <>
      <div
        className="grid grid-cols-[minmax(0,1.7fr)_120px_120px_1fr] items-center gap-4 border-b border-white/6 px-4 py-3 text-sm"
        style={{ paddingLeft: `${node.depth * 20 + 16}px` }}
      >
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--text-primary)]">{node.name}</div>
          <div className="mt-1 font-mono text-xs text-[var(--text-muted)]">{node.span_id}</div>
        </div>
        <div className="text-xs text-[var(--text-secondary)] tabular-nums">{formatDuration(node.duration_ms)}</div>
        <div>
          <Badge variant={badgeVariant}>{node.status}</Badge>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/30">
          <div
            className={`h-full rounded-full ${node.status === 'ERROR' ? 'bg-red-400' : node.status === 'TIMEOUT' ? 'bg-yellow-400' : 'bg-[var(--accent)]'}`}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
      {node.children.map((child) => (
        <SpanRow key={child.span_id} node={child} maxDuration={maxDuration} />
      ))}
    </>
  );
}

export default function TraceDetail() {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['trace-detail', traceId],
    queryFn: () => api.executions.get(traceId || ''),
    enabled: Boolean(traceId),
  });

  const tree = useMemo(() => (data ? buildSpanTree(data.spans) : []), [data]);
  const maxDuration = useMemo(
    () => (data ? Math.max(...data.spans.map((span) => span.duration_ms), 0) : 0),
    [data],
  );
  const errorCount = data?.spans.filter((span) => span.status === 'ERROR').length ?? 0;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-0 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <PageHeader
          title={traceId ? `Trace ${traceId.slice(0, 12)}` : 'Trace Detail'}
          subtitle={data ? `Captured ${formatDate(data.start_time)} across ${data.spans.length} spans.` : 'Inspect execution flow, timing, and failures across the span tree.'}
          actions={
            <Button variant="outline" onClick={() => navigate('/traces')}>
              <ArrowLeft className="h-4 w-4" />
              Back to Traces
            </Button>
          }
        />
        <div className="grid gap-4 border-t border-white/6 p-6 md:grid-cols-4">
          <Card className="border-white/6 bg-black/20">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Trace ID</div>
            <div className="mt-2 truncate font-mono text-sm text-[var(--text-secondary)]">{traceId}</div>
          </Card>
          <Card className="border-white/6 bg-black/20">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <Layers3 className="h-4 w-4" /> Spans
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{data?.spans.length ?? 0}</div>
          </Card>
          <Card className="border-white/6 bg-black/20">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <Clock3 className="h-4 w-4" /> Max Duration
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{formatDuration(maxDuration)}</div>
          </Card>
          <Card className="border-white/6 bg-black/20">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {errorCount > 0 ? <AlertTriangle className="h-4 w-4 text-red-300" /> : <ShieldCheck className="h-4 w-4 text-emerald-300" />}
              Exceptions
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{errorCount}</div>
          </Card>
        </div>
      </Card>

      <Card className="overflow-hidden border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] p-0">
        <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Span Waterfall</h2>
            <p className="text-sm text-[var(--text-muted)]">Hierarchy, duration, and status across the execution tree.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <GitBranch className="h-4 w-4" /> Ordered by parent-child flow
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-white/4" />
            ))}
          </div>
        ) : error ? (
          <EmptyState title="Trace unavailable" description={error instanceof Error ? error.message : 'Failed to load trace detail.'} />
        ) : !data || tree.length === 0 ? (
          <EmptyState title="No spans found" description="This trace does not contain any recorded spans yet." />
        ) : (
          <div>
            <div className="grid grid-cols-[minmax(0,1.7fr)_120px_120px_1fr] gap-4 border-b border-white/6 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              <span>Operation</span>
              <span>Duration</span>
              <span>Status</span>
              <span>Relative Weight</span>
            </div>
            {tree.map((node) => (
              <SpanRow key={node.span_id} node={node} maxDuration={maxDuration} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
