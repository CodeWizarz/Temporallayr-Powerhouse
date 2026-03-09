import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, GitBranch, AlertTriangle, BarChart3,
  Play, Bell, Database, DollarSign, Activity, Heart, Settings,
  LogOut, Zap, Plus,
} from 'lucide-react';
import { SIDEBAR_NAV } from '../lib/constants';
import { useAuth } from '../hooks/useAuth';

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="icon" />,
  GitBranch: <GitBranch className="icon" />,
  AlertTriangle: <AlertTriangle className="icon" />,
  BarChart3: <BarChart3 className="icon" />,
  Play: <Play className="icon" />,
  Bell: <Bell className="icon" />,
  Database: <Database className="icon" />,
  DollarSign: <DollarSign className="icon" />,
  Activity: <Activity className="icon" />,
  Heart: <Heart className="icon" />,
  Settings: <Settings className="icon" />,
};


// ---- Time Range Context ----
import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';

interface TimeRange { from: string; to: string; }
interface TimeRangeCtx { range: TimeRange; timeRange: TimeRange; setRange: (r: TimeRange) => void; }

const TimeRangeContext = createContext<TimeRangeCtx | null>(null);

export function useTimeRange(): TimeRangeCtx {
  const ctx = useContext(TimeRangeContext);
  if (!ctx) {
    // fallback: return last 24h
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return { range: { from, to }, timeRange: { from, to }, setRange: () => {} };
  }
  return ctx;
}

function TimeRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<TimeRange>(() => ({
    from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString(),
  }));
  const value = useMemo(() => ({ range, timeRange: range, setRange }), [range]);
  return <TimeRangeContext.Provider value={value}>{children}</TimeRangeContext.Provider>;
}
// ---- End Time Range Context ----

export default function Layout() {
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <div className="ch-layout">
      <nav className="ch-sidebar-global">
        <div className="logo">
          <NavLink to="/overview" className="flex items-center gap-2 text-[var(--text-primary)] no-underline">
            <Zap className="w-5 h-5 text-[var(--accent)]" />
            <span className="text-sm font-bold tracking-tight">TemporalLayr</span>
          </NavLink>
        </div>
        <div className="flex-1">
          {SIDEBAR_NAV.map(section => (
            <div key={section.section} className="nav-section">
              <div className="nav-section-label">{section.section}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `nav-item ${isActive || location.pathname.startsWith(item.path) ? 'active' : ''}`
                  }
                >
                  {iconMap[item.icon]}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--border)] p-3 space-y-1">
          <NavLink to="/new" className="nav-item">
            <Plus className="icon" />
            <span>New Service</span>
          </NavLink>
          <button onClick={logout} className="nav-item w-full text-red-400 hover:!text-red-300">
            <LogOut className="icon" />
            <span>Logout</span>
          </button>
        </div>
      </nav>
      <div className="ch-content-area">
        <TimeRangeProvider><Outlet /></TimeRangeProvider>
      </div>
    </div>
  );
}
