import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, GitBranch, AlertTriangle, Activity, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/client';
import { StatCard } from '../components/ui';
import { ContextSidebar, SidebarNavItem } from '../components/shared/ContextSidebar';
import { PageHeader } from '../components/shared/PageHeader';
import { ErrorBanner } from '../components/shared/ErrorBanner';
import { SkeletonCard } from '../components/ui/Skeleton';
import { formatNumber, formatDuration } from '../lib/utils';

export default function Overview() {
  const navigate = useNavigate();

  const { data: executions, isLoading: loadingExec, error: execError } = useQuery({
    queryKey: ['executions', 'overview'],
    queryFn: () => api.executions.list({ limit: 5 }),
  });

  const { data: incidents, isLoading: loadingInc } = useQuery({
    queryKey: ['incidents', 'overview'],
    queryFn: () => api.incidents.list({ limit: 5, status: 'open' }),
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health.check(),
  });

  const totalTraces = executions?.total ?? 0;
  const openIncidents = incidents?.total ?? 0;
  const recentTraces = executions?.items ?? [];
  const errorCount = recentTraces.filter(t => t.status === 'ERROR').length;

  return (
    <>
      <ContextSidebar title="Dashboard">
        <div className="p-3 space-y-1">
          <SidebarNavItem label="Overview" active icon={<LayoutDashboard className="w-3.5 h-3.5" />} />
          <SidebarNavItem label="Recent Traces" icon={<GitBranch className="w-3.5 h-3.5" />} onClick={() => navigate('/traces')} />
          <SidebarNavItem label="Active Incidents" icon={<AlertTriangle className="w-3.5 h-3.5" />} count={openIncidents} onClick={() => navigate('/incidents')} />
          <SidebarNavItem label="Event Stream" icon={<Activity className="w-3.5 h-3.5" />} onClick={() => navigate('/stream')} />
        </div>
      </ContextSidebar>

      <div className="ch-workspace">
        <PageHeader title="Overview" description={health ? `System ${health.status}` : 'Loading...'} />
        <div className="ch-workspace-content space-y-6">
          {execError && <ErrorBanner message={execError instanceof Error ? execError.message : 'Failed to load data'} />}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingExec ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <StatCard title="Total Traces" value={formatNumber(totalTraces)} icon={<GitBranch className="w-5 h-5" />} />
                <StatCard title="Open Incidents" value={openIncidents} icon={<AlertTriangle className="w-5 h-5" />} />
                <StatCard title="Error Rate" value={totalTraces > 0 ? `${((errorCount / recentTraces.length) * 100).toFixed(1)}%` : '0%'} icon={<Activity className="w-5 h-5" />} />
                <StatCard title="System" value={health?.status ?? 'checking'} icon={<Activity className="w-5 h-5" />} />
              </>
            )}
          </div>

          {/* Recent Traces */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Recent Traces</h3>
              <button onClick={() => navigate('/traces')} className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-[var(--border)]/50">
              {loadingExec ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3"><div className="h-4 bg-[var(--bg-elevated)] rounded animate-pulse w-3/4" /></div>
                ))
              ) : recentTraces.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No traces yet. Instrument your first agent to get started.</div>
              ) : (
                recentTraces.map(trace => (
                  <div
                    key={trace.id}
                    onClick={() => navigate(`/traces/${trace.id}`)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-elevated)]/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${trace.status === 'ERROR' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                      <span className="text-xs font-mono text-[var(--text-primary)]">{trace.id.slice(0, 12)}...</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                      <span>{trace.span_count} spans</span>
                      <span>{formatDuration(trace.duration_ms)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Open Incidents */}
          {!loadingInc && (incidents?.items?.length ?? 0) > 0 && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">Active Incidents</h3>
                <button onClick={() => navigate('/incidents')} className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer">
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-[var(--border)]/50">
                {incidents!.items.map(inc => (
                  <div key={inc.incident_id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${inc.severity === 'critical' ? 'bg-red-400/10 text-red-400' : inc.severity === 'high' ? 'bg-orange-400/10 text-orange-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
                        {inc.severity}
                      </span>
                      <span className="text-xs text-[var(--text-primary)]">{inc.failing_node}</span>
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">{inc.count} occurrences</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
