import { NavLink, Outlet } from 'react-router-dom';
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
  Sparkles,
  Zap,
} from 'lucide-react';
import { api } from '../lib/client';
import { SIDEBAR_NAV } from '../lib/constants';
import { useAuth } from '../hooks/useAuth';

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

function RailLink({ path, label, icon, matchNested = false }: { path: string; label: string; icon: keyof typeof iconMap; matchNested?: boolean }) {
  const Icon = iconMap[icon];

  return (
    <NavLink
      to={path}
      end={!matchNested}
      className={({ isActive }) =>
        [
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
          isActive
            ? 'bg-[linear-gradient(135deg,rgba(210,255,92,0.14),rgba(210,255,92,0.05))] text-[var(--text-primary)] shadow-[inset_0_0_0_1px_rgba(210,255,92,0.18)]'
            : 'text-[var(--text-secondary)] hover:bg-white/4 hover:text-[var(--text-primary)]',
        ].join(' ')
      }
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/6 bg-white/4 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-primary)]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { logout } = useAuth();
  const { data: health } = useQuery({
    queryKey: ['shell-health'],
    queryFn: () => api.health.check(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(210,255,92,0.08),_transparent_24%),linear-gradient(180deg,#08110d_0%,#09100f_18%,#0b0e12_100%)] text-[var(--text-primary)]">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-[272px] shrink-0 flex-col border-r border-white/6 bg-[rgba(6,10,12,0.88)] px-4 py-4 backdrop-blur-xl">
          <div className="mb-4 rounded-2xl border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
            <NavLink to="/overview" className="flex items-center gap-3 text-[var(--text-primary)] no-underline">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),#86efac)] text-black shadow-[0_0_32px_rgba(210,255,92,0.22)]">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">Mission Control</div>
                <div className="text-base font-semibold tracking-[-0.02em]">TemporalLayr</div>
              </div>
            </NavLink>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Workspace</div>
                <div className="mt-1 font-medium text-[var(--text-secondary)]">Production AI</div>
              </div>
              <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Health</div>
                <div className="mt-1 flex items-center gap-2 font-medium text-[var(--text-secondary)]">
                  <span className={`h-2 w-2 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
                  {health?.status ?? 'checking'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {SIDEBAR_NAV.map((section) => (
              <div key={section.section} className="mb-6">
                <div className="mb-2 px-3 text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  {section.section}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <RailLink
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

          <div className="mt-4 space-y-3 border-t border-white/6 pt-4">
            <NavLink
              to="/new"
              className="flex items-center justify-between rounded-2xl border border-[rgba(210,255,92,0.16)] bg-[linear-gradient(135deg,rgba(210,255,92,0.12),rgba(210,255,92,0.03))] px-4 py-3 text-sm text-[var(--text-primary)] transition hover:border-[rgba(210,255,92,0.3)] hover:bg-[linear-gradient(135deg,rgba(210,255,92,0.16),rgba(210,255,92,0.05))]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/20 text-[var(--accent)]">
                  <Plus className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-medium">Connect Service</div>
                  <div className="text-xs text-[var(--text-muted)]">Get your SDK snippet</div>
                </div>
              </div>
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            </NavLink>

            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--text-secondary)] transition hover:bg-white/4 hover:text-red-300"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/6 bg-white/4">
                <LogOut className="h-4 w-4" />
              </span>
              Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="min-h-screen p-5 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
