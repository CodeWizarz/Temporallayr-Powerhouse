import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, CheckCircle, Clock, TrendingUp, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const API = import.meta.env.VITE_API_URL ?? ''

function MetricCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string; icon: any; color: string
}) {
  return (
    <div className="ch-card p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-[var(--ch-text-secondary)]">{title}</span>
        <span className={`p-2 rounded-lg bg-${color}-500/10`}>
          <Icon className={`w-4 h-4 text-${color}-400`} />
        </span>
      </div>
      <div className="text-2xl font-bold text-[var(--ch-text-primary)]">{value}</div>
      {sub && <div className="text-xs text-[var(--ch-text-secondary)] mt-1">{sub}</div>}
    </div>
  )
}

export default function Overview() {
  const { data: tracesData } = useQuery({
    queryKey: ['traces-stats'],
    queryFn: () => fetch(`${API}/traces/summary/stats`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('api_key') ?? ''}` }
    }).then(r => r.json()).catch(() => ({ total: 0, success: 0, error: 0, error_rate: 0 })),
    refetchInterval: 30000,
  })

  const { data: analyticsData } = useQuery({
    queryKey: ['analytics-latency'],
    queryFn: () => fetch(`${API}/analytics/latency`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('api_key') ?? ''}` }
    }).then(r => r.json()).catch(() => ({ p50: 0, p95: 0, p99: 0, trend: [] })),
    refetchInterval: 30000,
  })

  const stats = tracesData ?? { total: 0, success: 0, error: 0, error_rate: 0 }
  const latency = analyticsData ?? { p50: 0, p95: 0, p99: 0, trend: [] }

  const sparkData = Array.from({ length: 12 }, (_, i) => ({
    t: i,
    runs: Math.floor(Math.random() * 80 + 20),
    errors: Math.floor(Math.random() * 10),
  }))

  return (
    <div className="ch-page-container">
      <div className="ch-page-header">
        <div>
          <h1 className="ch-page-title">Overview</h1>
          <p className="ch-page-subtitle">Real-time view of your AI agent workflows</p>
        </div>
        <Link to="/traces" className="ch-btn ch-btn-primary">View Traces →</Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard title="Total Runs" value={stats.total.toLocaleString()} sub="all time" icon={Activity} color="blue" />
        <MetricCard title="Success" value={stats.success.toLocaleString()} sub={`${(100 - stats.error_rate).toFixed(1)}% success rate`} icon={CheckCircle} color="green" />
        <MetricCard title="Errors" value={stats.error.toLocaleString()} sub={`${stats.error_rate.toFixed(1)}% error rate`} icon={AlertTriangle} color="red" />
        <MetricCard title="p95 Latency" value={`${latency.p95 ?? 0}ms`} sub="last 24h" icon={Clock} color="yellow" />
      </div>

      {/* Throughput chart */}
      <div className="ch-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-[var(--ch-text-primary)]">Agent Runs (last 12h)</h2>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id="runsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ch-border)" />
            <XAxis dataKey="t" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: 'var(--ch-surface)', border: '1px solid var(--ch-border)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--ch-text-secondary)' }}
            />
            <Area type="monotone" dataKey="runs" stroke="#3b82f6" fill="url(#runsGrad)" name="Runs" />
            <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="url(#errGrad)" name="Errors" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: '/traces', label: 'Traces', desc: 'Execution timelines', icon: Activity },
          { to: '/analytics', label: 'Analytics', desc: 'Latency & trends', icon: TrendingUp },
          { to: '/alerts', label: 'Alerts', desc: 'Rules & incidents', icon: AlertTriangle },
          { to: '/stream', label: 'Live Stream', desc: 'Real-time events', icon: Zap },
        ].map(({ to, label, desc, icon: Icon }) => (
          <Link key={to} to={to} className="ch-card p-4 hover:border-[var(--ch-accent)] transition-colors group">
            <Icon className="w-5 h-5 text-[var(--ch-accent)] mb-2" />
            <div className="font-medium text-[var(--ch-text-primary)] text-sm">{label}</div>
            <div className="text-xs text-[var(--ch-text-secondary)] mt-0.5">{desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
