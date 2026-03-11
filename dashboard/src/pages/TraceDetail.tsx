import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Clock3, GitBranch, Layers3, ShieldCheck } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Button } from '../components/ui';
import { DashboardSection, EmptyPanel, MetricCard, Surface, SurfaceHeader } from '../components/shared';
import { buildSpanTree, formatDate, formatDuration } from '../lib/utils';
import type { SpanNode } from '../types';

function SpanRow({ node, maxDuration }: { node: SpanNode; maxDuration: number }) {
  const width = Math.max(6, Math.round((node.duration_ms / Math.max(maxDuration, 1)) * 100));
  const badgeVariant = node.status === 'ERROR' ? 'error' : node.status === 'TIMEOUT' ? 'warning' : 'success';

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1.6fr)_110px_100px_1fr] gap-4 border-t border-[var(--border-soft)] px-4 py-3 text-sm" style={{ paddingLeft: `${node.depth * 18 + 16}px` }}>
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--text-primary)]">{node.name}</div>
          <div className="mt-1 font-mono text-xs text-[var(--text-dim)]">{node.span_id}</div>
        </div>
        <div className="text-sm tabular-nums text-[var(--text-secondary)]">{formatDuration(node.duration_ms)}</div>
        <div><Badge variant={badgeVariant}>{node.status}</Badge></div>
        <div className="flex items-center">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-panel-soft)]">
            <div className={`h-full rounded-full ${node.status === 'ERROR' ? 'bg-red-400' : node.status === 'TIMEOUT' ? 'bg-yellow-400' : 'bg-[var(--accent)]'}`} style={{ width: `${width}%` }} />
          </div>
        </div>
      </div>
      {node.children.map((child) => <SpanRow key={child.span_id} node={child} maxDuration={maxDuration} />)}
    </>
  );
}

export default function TraceDetail() {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['trace-detail', traceId], queryFn: () => api.executions.get(traceId || ''), enabled: Boolean(traceId) });

  const tree = useMemo(() => (data ? buildSpanTree(data.spans) : []), [data]);
  const maxDuration = useMemo(() => (data ? Math.max(...data.spans.map((span) => span.duration_ms), 0) : 0), [data]);
  const errorCount = data?.spans.filter((span) => span.status === 'ERROR').length ?? 0;

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Trace detail"
        title={traceId ? `Trace ${traceId.slice(0, 12)}` : 'Trace detail'}
        description={data ? `Captured ${formatDate(data.start_time)} across ${data.spans.length} spans. The page is structured to read like an execution report, not a raw dump.` : 'Inspect timing, hierarchy, and failures across the execution tree.'}
        actions={<Button variant="outline" onClick={() => navigate('/traces')}><ArrowLeft className="h-4 w-4" />Back to traces</Button>}
      />

      <Surface tone="hero">
        <div className="grid gap-4 p-6 md:grid-cols-2 2xl:grid-cols-4">
          <MetricCard label="Trace ID" value={traceId?.slice(0, 12) ?? 'N/A'} hint="Execution reference" icon={<GitBranch className="h-5 w-5" />} />
          <MetricCard label="Spans" value={String(data?.spans.length ?? 0)} hint="Total span count" icon={<Layers3 className="h-5 w-5" />} />
          <MetricCard label="Max duration" value={formatDuration(maxDuration)} hint="Longest span in tree" icon={<Clock3 className="h-5 w-5" />} />
          <MetricCard label="Exceptions" value={String(errorCount)} hint="Error spans in execution" icon={errorCount > 0 ? <AlertTriangle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />} />
        </div>
      </Surface>

      <Surface>
        <SurfaceHeader title="Span waterfall" description="Ordered by hierarchy, with width representing relative weight inside the trace." />
        <div className="px-6 pb-6 pt-4">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-[16px] bg-white/4" />)}</div>
          ) : error ? (
            <EmptyPanel title="Trace unavailable" description={error instanceof Error ? error.message : 'Failed to load trace detail.'} />
          ) : !data || tree.length === 0 ? (
            <EmptyPanel title="No spans found" description="This trace does not contain recorded spans yet, so the waterfall has nothing to render." />
          ) : (
            <div className="overflow-hidden rounded-[20px] border border-[var(--border-soft)]">
              <div className="grid grid-cols-[minmax(0,1.6fr)_110px_100px_1fr] gap-4 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                <span>Operation</span>
                <span>Duration</span>
                <span>Status</span>
                <span>Relative weight</span>
              </div>
              {tree.map((node) => <SpanRow key={node.span_id} node={node} maxDuration={maxDuration} />)}
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}
