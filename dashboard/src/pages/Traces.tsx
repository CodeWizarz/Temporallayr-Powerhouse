import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Filter, GitBranch, RefreshCw, Search, Sparkles } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Button, Card, EmptyState } from '../components/ui';
import { PageHeader } from '../components/shared';
import { formatDuration, timeAgo } from '../lib/utils';

function TraceTableHeader({ children }: { children: ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">{children}</div>;
}

export default function Traces() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['traces', search, page],
    queryFn: () => api.executions.list({ limit, offset: page * limit, search: search || undefined }),
  });

  const traces = data?.items ?? [];
  const total = data?.total ?? 0;
  const errorCount = useMemo(() => traces.filter((trace) => trace.status === 'ERROR').length, [traces]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-0 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <PageHeader
          title="Traces"
          subtitle="Search, inspect, and follow execution paths through your AI workflows."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
              <Button onClick={() => navigate('/new')}>
                <Sparkles className="h-4 w-4" /> Connect service
              </Button>
            </div>
          }
        />

        <div className="grid gap-4 border-t border-white/6 p-6 md:grid-cols-[minmax(0,1fr)_160px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Search by trace id"
              className="h-12 w-full rounded-2xl border border-white/6 bg-black/20 pl-11 pr-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
            />
          </div>
          <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <GitBranch className="h-4 w-4" /> Window
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{total}</div>
          </div>
          <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <Filter className="h-4 w-4" /> Errors in page
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{errorCount}</div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] p-0">
        <div className="grid grid-cols-[minmax(0,1.7fr)_120px_120px_120px_130px] gap-4 border-b border-white/6 px-5 py-3">
          <TraceTableHeader>Trace</TraceTableHeader>
          <TraceTableHeader>Status</TraceTableHeader>
          <TraceTableHeader>Spans</TraceTableHeader>
          <TraceTableHeader>Duration</TraceTableHeader>
          <TraceTableHeader>Started</TraceTableHeader>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-white/3" />
            ))}
          </div>
        ) : traces.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No traces found"
            description={search ? 'Try a different trace id fragment or clear the current filter.' : 'Connect a service and send your first trace to populate the stream.'}
          />
        ) : (
          <div className="divide-y divide-white/6">
            {traces.map((trace) => (
              <button
                key={trace.id}
                onClick={() => navigate(`/traces/${trace.id}`)}
                className="grid w-full grid-cols-[minmax(0,1.7fr)_120px_120px_120px_130px] gap-4 px-5 py-4 text-left transition hover:bg-white/3"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-[var(--text-secondary)]">{trace.id}</div>
                  <div className="mt-1 text-sm text-[var(--text-muted)]">Tenant {trace.tenant_id}</div>
                </div>
                <div>
                  <Badge variant={trace.status === 'ERROR' ? 'error' : 'success'}>{trace.status}</Badge>
                </div>
                <div className="text-sm tabular-nums text-[var(--text-secondary)]">{trace.span_count}</div>
                <div className="text-sm tabular-nums text-[var(--text-secondary)]">{formatDuration(trace.duration_ms)}</div>
                <div className="text-sm text-[var(--text-muted)]">{timeAgo(trace.created_at)}</div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {total > limit && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--text-muted)]">
            Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <Button variant="outline" disabled={(page + 1) * limit >= total} onClick={() => setPage((current) => current + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
