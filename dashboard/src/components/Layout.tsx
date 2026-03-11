import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Database,
  DollarSign,
  GitBranch,
  Heart,
  LayoutDashboard,
  LogOut,
  Play,
  Plus,
  Settings,
  Zap,
} from 'lucide-react';
import { api } from '../lib/client';
import { SIDEBAR_NAV } from '../lib/constants';
import { useAuth } from '../hooks/useAuth';
import { Badge, Button } from './ui';

const iconMap = {
  LayoutDashboard,
  GitBranch,
  AlertTriangle,
  BarChart3,
  Play,
  Bell,
  Database,
  DollarSign,
  Activity,
  Heart,
  Settings,
} as const;

function ShellNavLink({
  path,
  label,
  icon,
  matchNested = false,
}: {
  path: string;
  label: string;
  icon: keyof typeof iconMap;
  matchNested?: boolean;
}) {
  const Icon = iconMap[icon];

  return (
    <NavLink
      to={path}
      end={!matchNested}
      className={({ isActive }) =>
        [
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all',
          isActive
            ? 'bg-white/6 text-[var(--text-primary)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]'
            : 'text-[var(--text-secondary)] hover:bg-white/4 hover:text-[var(--text-primary)]',
        ].join(' ')
      }
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-primary)]">
        <Icon className="h-4 w-4" />
      </span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { logout } = useAuth();
  const location = useLocation();
  const { data: health } = useQuery({
    queryKey: ['shell-health'],
    queryFn: () => api.health.check(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="flex h-screen w-[248px] shrink-0 flex-col border-r border-[var(--border-soft)] bg-[rgba(10,14,19,0.88)] px-4 py-5 backdrop-blur-xl">
          <NavLink to="/overview" className="rounded-[20px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-[#11150e] shadow-[0_12px_30px_rgba(201,246,88,0.22)]">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-dim)]">Axiom Mode</div>
                <div className="mt-1 text-base font-semibold tracking-[-0.03em]">TemporalLayr</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-[var(--bg-panel-soft)] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Workspace</div>
                <div className="mt-1 text-[13px] text-[var(--text-secondary)]">Production</div>
              </div>
              <div className="rounded-xl bg-[var(--bg-panel-soft)] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Status</div>
                <div className="mt-1 flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                  <span className={`h-2 w-2 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
                  {health?.status ?? 'checking'}
                </div>
              </div>
            </div>
          </NavLink>

          <div className="mt-6 flex-1 overflow-y-auto pr-1">
            {SIDEBAR_NAV.map((section) => (
              <div key={section.section} className="mb-7">
                <div className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--text-dim)]">
                  {section.section}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <ShellNavLink
                      key={item.path}
                      path={item.path}
                      label={item.label}
                      icon={item.icon}
                      matchNested={item.path === '/settings'}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3 border-t border-[var(--border-soft)] pt-4">
            <div className="rounded-2xl border border-[rgba(201,246,88,0.18)] bg-[linear-gradient(180deg,rgba(201,246,88,0.08),rgba(201,246,88,0.02))] p-3">
              <div className="mb-3 text-xs text-[var(--text-secondary)]">
                Connect your first workload and stream traces into the dashboard.
              </div>
              <Button className="w-full justify-between" onClick={() => (window.location.href = '/new')}>
                Connect Service
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--text-secondary)] transition hover:bg-white/4 hover:text-[var(--text-primary)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
                <LogOut className="h-4 w-4" />
              </span>
              Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="border-b border-[var(--border-soft)] bg-[rgba(10,14,19,0.55)] px-8 py-4 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--text-dim)]">Control Panel</div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">
                  {location.pathname === '/overview' ? 'Live signal across traces, incidents, and spend.' : 'TemporalLayr observability workspace.'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="default">Koyeb backend</Badge>
                <Badge variant={health?.status === 'healthy' ? 'success' : 'warning'} dot>
                  {health?.status ?? 'checking'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[1360px] px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
