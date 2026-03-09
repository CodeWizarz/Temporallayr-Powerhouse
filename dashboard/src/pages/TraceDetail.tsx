import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/client';
import { Card } from '../components/ui';
import { PageHeader } from '../components/shared';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDate, formatDuration, getStatusColor } from '../lib/utils';
import { ArrowLeft, Clock, Hash, Server, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { Span } from '../types';

function SpanRow({ span, depth = 0 }: { span: Span & { children?: Span[] }; depth?: number }) {
  const statusColor = span.status === 'ERROR' ? 'text-red-400' : span.status === 'OK' ? 'text-green-400' : 'text-yellow-400';
  const StatusIcon = span.status === 'ERROR' ? XCircle : span.status === 'OK' ? CheckCircle : AlertTriangle;

  return (
    <>
      <div
        className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors group"
        style={{ paddingLeft: `${depth * 24 + 16}px` }}
      >
        <StatusIcon size={14} className={statusColor} />
        <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">{span.name}</span>
        <span className="text-xs text-[var(--text-muted)] font-mono">{span.service_name}</span>
        <span className="text-xs text-[var(--text-muted)] font-mono w-20 text-right">{formatDuration(span.duration_ms)}</span>
        {/* Waterfall bar */}
        <div className="w-48 h-2 bg-[var(--bg-base)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${span.status === 'ERROR' ? 'bg-red-500' : 'bg-[var(--accent)]'}`}
            style={{ width: `${Math.min(100, Math.max(5, (span.duration_ms / 1000) * 100))}%` }}
          />
        </div>
      </div>
      {span.children?.map((child) => (
        <SpanRow key={child.span_id} span={child as Span & { children?: Span[] }} depth={depth + 1} />
      ))}
    </>
  );
}

function buildSpanTree(spans: Span[]): (Span & { children?: Span[] })[] {
  const map = new Map<string, Span & { children: Span[] }>();
  const roots: (Span & { children: Span[] })[] = [];

  spans.forEach((s: Span) => map.set(s.span_id, { ...s, children: [] }));
  spans.forEach((s: Span) => {
    const node = map.get(s.span_id)!;
    if (s.parent_span_id && map.has(s.parent_span_id)) {
      map.get(s.parent_span_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export default function TraceDetail() {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();

  const { data: spans, isLoading, error } = useQuery({
    queryKey: ['trace', traceId],
    queryFn: () => api.getTraceSpans(traceId!),
    enabled: !!traceId,
  });

  const tree = spans ? buildSpanTree(spans) : [];
  const rootSpan = spans?.[0];
  const totalDuration = spans ? Math.max(...spans.map((s: Span) => s.duration_ms)) : 0;
  const errorCount = spans?.filter((s: Span) => s.status === 'ERROR').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/traces')}
          className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <ArrowLeft size={18} className="text-[var(--text-muted)]" />
        </button>
        <PageHeader
          title={rootSpan?.name ?? 'Trace Detail'}
          subtitle={traceId ? `Trace ${traceId.slice(0, 12)}...` : ''}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs mb-1">
            <Hash size={12} /> Spans
          </div>
          <div className="text-xl font-semibold text-[var(--text-primary)]">
            {isLoading ? <Skeleton className="h-7 w-12" /> : spans?.length ?? 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs mb-1">
            <Clock size={12} /> Duration
          </div>
          <div className="text-xl font-semibold text-[var(--text-primary)]">
            {isLoading ? <Skeleton className="h-7 w-20" /> : formatDuration(totalDuration)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs mb-1">
            <Server size={12} /> Services
          </div>
          <div className="text-xl font-semibold text-[var(--text-primary)]">
            {isLoading ? <Skeleton className="h-7 w-8" /> : new Set(spans?.map((s: Span) => s.service_name)).size}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs mb-1">
            <AlertTriangle size={12} /> Errors
          </div>
          <div className={`text-xl font-semibold ${errorCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {isLoading ? <Skeleton className="h-7 w-8" /> : errorCount}
          </div>
        </Card>
      </div>

      {/* Span Waterfall */}
      <Card>
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Span Waterfall</h3>
        </div>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] text-xs text-[var(--text-muted)] font-medium">
          <span className="w-4" />
          <span className="flex-1">Operation</span>
          <span>Service</span>
          <span className="w-20 text-right">Duration</span>
          <span className="w-48 text-center">Timeline</span>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-sm">Failed to load trace spans</div>
        ) : tree.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">No spans found</div>
        ) : (
          tree.map((span) => <SpanRow key={span.span_id} span={span} />)
        )}
      </Card>

      {/* Span Attributes (first span) */}
      {rootSpan?.attributes && Object.keys(rootSpan.attributes).length > 0 && (
        <Card>
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Root Span Attributes</h3>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {Object.entries(rootSpan.attributes).map(([key, value]) => (
              <div key={key} className="flex items-center px-4 py-2.5">
                <span className="text-xs font-mono text-[var(--text-muted)] w-1/3 truncate">{key}</span>
                <span className="text-xs font-mono text-[var(--text-primary)] flex-1 truncate">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
