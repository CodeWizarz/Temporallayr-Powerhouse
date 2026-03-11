import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock3, Filter, GitBranch, RefreshCw, Search } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Button } from '../components/ui';
import { DashboardSection, EmptyPanel, MetricCard, Surface, SurfaceHeader } from '../components/shared';
import { formatDuration, formatNumber, timeAgo } from '../lib/utils';

export default function Traces() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 18;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['traces', search, page],
    queryFn: () => api.executions.list({ limit, offset: page * limit, search: search || undefined }),
  });

  const traces = data?.items ?? [];
  const total = data?.total ?? 0;
  const stats = useMemo(() => {
    const errorCount = traces.filter((trace) => trace.status === 'ERROR').length;
    const avgDuration = traces.length ? traces.reduce((sum, trace) => sum + trace.duration_ms, 0) / traces.length : 0;
    return { errorCount, avgDuration };
  }, [traces]);

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Traces"
        title="Search and inspect execution flow."
        description="The trace list is the operational backbone of the dashboard: strong filters, clear density, and enough metadata to decide where to dig next."
        actions={
          <>
            <Button variant="ghost" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate('/incidents')}>
              See incidents
            </Button>
          </>
        }
      />

      <Surface tone="hero">
        <div className="grid gap-5 p-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.018)] p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--text-dim)]">Trace query</div>
            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Search by trace id"
                  className="h-12 w-full rounded-2xl border border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)] pl-11 pr-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-hover)]"
                />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4" />
                Filters soon
              </Button>
            </div>
            <div className="mt-4 text-sm text-[var(--text-secondary)]">
              Use trace id fragments to narrow the list. Next step is structured filters for status, duration, and tenant.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <MetricCard label="Window size" value={formatNumber(total)} hint="Matching traces" icon={<GitBranch className="h-5 w-5" />} />
            <MetricCard label="Errors on page" value={formatNumber(stats.errorCount)} hint="Visible failures" icon={<AlertTriangle className="h-5 w-5" />} />
            <MetricCard label="Avg duration" value={formatDuration(stats.avgDuration)} hint="Current page average" icon={<Clock3 className="h-5 w-5" />} />
          </div>
        </div>
      </Surface>

      <Surface>
        <SurfaceHeader title="Trace inventory" description="Structured as a real operational table, not a placeholder card stack." />
        <div className="px-6 pb-6 pt-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-[16px] bg-white/4" />
              ))}
            </div>
          ) : traces.length === 0 ? (
            <EmptyPanel
              title="No traces found"
              description={search ? 'No traces match this query. Clear the input or search with a shorter trace fragment.' : 'No traces have been ingested yet. Connect an SDK source to start populating this table.'}
            />
          ) : (
            <div className="overflow-hidden rounded-[20px] border border-[var(--border-soft)]">
              <div className="grid grid-cols-[minmax(0,1.8fr)_120px_120px_140px_140px] gap-4 bg-[rgba(255,255,255,0.02)] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-dim)]">
                <div>Trace</div>
                <div>Status</div>
                <div>Spans</div>
                <div>Duration</div>
                <div>Started</div>
              </div>
              {traces.map((trace) => (
                <button
                  key={trace.id}
                  onClick={() => navigate(`/traces/${trace.id}`)}
                  className="grid w-full grid-cols-[minmax(0,1.8fr)_120px_120px_140px_140px] gap-4 border-t border-[var(--border-soft)] px-5 py-4 text-left transition hover:bg-white/3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[13px] text-[var(--text-primary)]">{trace.id}</div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">Tenant {trace.tenant_id}</div>
                  </div>
                  <div>
                    <Badge variant={trace.status === 'ERROR' ? 'error' : 'success'}>{trace.status}</Badge>
                  </div>
                  <div className="text-sm tabular-nums text-[var(--text-secondary)]">{trace.span_count}</div>
                  <div className="text-sm tabular-nums text-[var(--text-secondary)]">{formatDuration(trace.duration_ms)}</div>
                  <div className="text-sm text-[var(--text-secondary)]">{timeAgo(trace.created_at)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Surface>

      {total > limit ? (
        <div className="flex items-center justify-between rounded-[18px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-5 py-4">
          <div className="text-sm text-[var(--text-secondary)]">
            Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {formatNumber(total)} traces
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
      ) : null}
    </div>
  );
}
