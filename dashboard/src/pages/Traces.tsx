import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Search, RefreshCw } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Button } from '../components/ui';
import { ContextSidebar, SidebarNavItem } from '../components/shared/ContextSidebar';
import { PageHeader } from '../components/shared/PageHeader';
import { ErrorBanner } from '../components/shared/ErrorBanner';
import { formatDate, formatDuration } from '../lib/utils';
import type { TraceRow } from '../types';

export default function Traces() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['executions', search, page],
    queryFn: () => api.executions.list({ limit, offset: page * limit, search: search || undefined }),
  });

  const traces = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <>
      <ContextSidebar title="Traces">
        <div className="p-3">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="text" placeholder="Search traces..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-md pl-8 pr-3 py-1.5 text-xs
                text-[var(--text-primary)] placeholder-[var(--text-muted)]
                focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="space-y-0.5">
            <SidebarNavItem label="All Traces" active icon={<GitBranch className="w-3.5 h-3.5" />} count={total} />
          </div>
        </div>
      </ContextSidebar>

      <div className="ch-workspace">
        <PageHeader
          title="Traces"
          description={`${total} total executions`}
          actions={<Button variant="ghost" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => refetch()}>Refresh</Button>}
        />
        <div className="ch-workspace-content">
          {error && <ErrorBanner message={error instanceof Error ? error.message : 'Failed to load traces'} onRetry={() => refetch()} />}

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Trace ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Spans</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-[var(--border)]/50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-[var(--bg-elevated)] rounded animate-pulse" style={{ width: `${60 + j * 10}%` }} /></td>
                      ))}
                    </tr>
                  ))
                ) : traces.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--text-muted)]">No traces found</td></tr>
                ) : (
                  traces.map((t: TraceRow) => (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/traces/${t.id}`)}
                      className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-elevated)]/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-xs font-mono text-[var(--text-primary)]">{t.id.slice(0, 16)}...</td>
                      <td className="px-4 py-3">
                        <Badge variant={t.status === 'ERROR' ? 'error' : 'success'} dot>{t.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] tabular-nums">{t.span_count}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] tabular-nums">{formatDuration(t.duration_ms)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{formatDate(t.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-[var(--text-muted)]">
                Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
