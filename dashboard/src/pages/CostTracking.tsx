import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart as PieIcon,
  Activity,
  Calendar,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '../lib/client';
import { useTimeRange } from '../components/Layout';
import type { CostSummary, CostBreakdown, CostBreakdownItem, CostForecast } from '../types';

// ── Helpers ──────────────────────────────────────────────
function formatCost(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(2) + 'K';
  return '$' + n.toFixed(2);
}

function formatPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return sign + n.toFixed(1) + '%';
}

const COLORS = ['#818cf8', '#a78bfa', '#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#f87171', '#60a5fa'];

const chartTheme = {
  grid: '#1e1e2e',
  text: '#8888a0',
  bg: '#13131a',
};

// ── Stat Card ────────────────────────────────────────────
function CostStatCard({
  label,
  value,
  change,
  icon,
}: {
  label: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#1e1e2e] bg-[#13131a] p-5 hover:border-[#2a2a3e] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#8888a0] uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-[#e0e0e8]">{value}</div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${
          change > 0 ? 'text-red-400' : change < 0 ? 'text-green-400' : 'text-[#8888a0]'
        }`}>
          {change > 0 ? <ArrowUpRight size={12} /> : change < 0 ? <ArrowDownRight size={12} /> : null}
          {formatPct(change)} vs prev period
        </div>
      )}
    </div>
  );
}

// ── Custom Tooltip ───────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[#1e1e2e] bg-[#0d0d14] px-3 py-2 shadow-xl">
      <p className="text-xs text-[#8888a0] mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? formatCost(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Breakdown Table ──────────────────────────────────────
function BreakdownTable({ items }: { items: CostBreakdownItem[] }) {
  const [sortBy, setSortBy] = useState<'cost' | 'name'>('cost');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const va = sortBy === 'cost' ? a.cost : a.name;
      const vb = sortBy === 'cost' ? b.cost : b.name;
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'desc' ? vb - va : va - vb;
      }
      return sortDir === 'desc'
        ? String(vb).localeCompare(String(va))
        : String(va).localeCompare(String(vb));
    });
  }, [items, sortBy, sortDir]);

  const maxCost = Math.max(...items.map((i) => i.cost), 1);

  return (
    <div className="rounded-lg border border-[#1e1e2e] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#0d0d14]">
            <th
              className="text-left px-4 py-3 text-[#8888a0] font-medium cursor-pointer hover:text-[#e0e0e8]"
              onClick={() => { setSortBy('name'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}
            >Name</th>
            <th className="text-left px-4 py-3 text-[#8888a0] font-medium">Category</th>
            <th
              className="text-left px-4 py-3 text-[#8888a0] font-medium cursor-pointer hover:text-[#e0e0e8]"
              onClick={() => { setSortBy('cost'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}
            >Cost</th>
            <th className="text-left px-4 py-3 text-[#8888a0] font-medium w-48">Share</th>
            <th className="text-left px-4 py-3 text-[#8888a0] font-medium">Trend</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => (
            <tr
              key={item.name}
              className={`border-t border-[#1e1e2e] transition-colors hover:bg-[#1a1a2e] ${
                i % 2 === 0 ? 'bg-[#13131a]' : 'bg-[#111118]'
              }`}
            >
              <td className="px-4 py-3 text-[#e0e0e8] font-medium">{item.name}</td>
              <td className="px-4 py-3">
                <span className="rounded bg-[#1e1e2e] px-2 py-0.5 text-xs text-[#8888a0]">
                  {item.category}
                </span>
              </td>
              <td className="px-4 py-3 text-[#e0e0e8] font-mono">{formatCost(item.cost)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-[#1e1e2e] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      style={{ width: `${(item.cost / maxCost) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#8888a0] w-12 text-right">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`flex items-center gap-1 text-xs font-medium ${
                  item.trend > 0 ? 'text-red-400' : item.trend < 0 ? 'text-green-400' : 'text-[#8888a0]'
                }`}>
                  {item.trend > 0 ? <TrendingUp size={12} /> : item.trend < 0 ? <TrendingDown size={12} /> : null}
                  {formatPct(item.trend)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Top Traces Table ─────────────────────────────────────
function TopTracesTable({ traces }: { traces: any[] }) {
  if (!traces?.length) return null;
  return (
    <div className="rounded-lg border border-[#1e1e2e] overflow-hidden">
      <div className="px-4 py-3 bg-[#0d0d14] border-b border-[#1e1e2e]">
        <h3 className="text-sm font-semibold text-[#e0e0e8]">Top Traces by Cost</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#0d0d14]">
            <th className="text-left px-4 py-2 text-[#8888a0] font-medium">Trace ID</th>
            <th className="text-left px-4 py-2 text-[#8888a0] font-medium">Service</th>
            <th className="text-left px-4 py-2 text-[#8888a0] font-medium">Operation</th>
            <th className="text-left px-4 py-2 text-[#8888a0] font-medium">Cost</th>
            <th className="text-left px-4 py-2 text-[#8888a0] font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {traces.map((t: any, i: number) => (
            <tr
              key={t.trace_id || i}
              className={`border-t border-[#1e1e2e] hover:bg-[#1a1a2e] ${
                i % 2 === 0 ? 'bg-[#13131a]' : 'bg-[#111118]'
              }`}
            >
              <td className="px-4 py-2">
                <code className="text-xs text-indigo-400 font-mono">
                  {(t.trace_id || '').slice(0, 12)}...
                </code>
              </td>
              <td className="px-4 py-2 text-[#e0e0e8]">{t.service || '—'}</td>
              <td className="px-4 py-2 text-[#8888a0]">{t.operation || '—'}</td>
              <td className="px-4 py-2 text-[#e0e0e8] font-mono">{formatCost(t.cost || 0)}</td>
              <td className="px-4 py-2 text-[#8888a0]">{t.duration_ms ? `${t.duration_ms}ms` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────
export default function CostTrackingPage() {
  const { timeRange } = useTimeRange();
  const [view, setView] = useState<'overview' | 'breakdown'>('overview');

  const params = { from: timeRange.from, to: timeRange.to };

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['cost-summary', params],
    queryFn: () => api.cost.summary(params),
  });

  const { data: breakdown, isLoading: loadingBreakdown } = useQuery({
    queryKey: ['cost-breakdown', params],
    queryFn: () => api.cost.breakdown(params),
  });

  const { data: trends } = useQuery({
    queryKey: ['cost-trends', params],
    queryFn: () => api.cost.trends(params),
  });

  const { data: forecast } = useQuery({
    queryKey: ['cost-forecast', params],
    queryFn: () => api.cost.forecast(params),
  });

  const { data: topTraces } = useQuery({
    queryKey: ['cost-top-traces', params],
    queryFn: () => api.cost.topTraces(params),
  });

  // Build pie data from summary
  const pieData = useMemo(() => {
    if (!summary?.cost_by_dataset) return [];
    return Object.entries(summary.cost_by_dataset).map(([name, cost]) => ({
      name,
      value: cost as number,
    }));
  }, [summary]);

  const serviceData = useMemo(() => {
    if (!summary?.cost_by_service) return [];
    return Object.entries(summary.cost_by_service)
      .map(([name, cost]) => ({ name, cost: cost as number }))
      .sort((a, b) => b.cost - a.cost);
  }, [summary]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e0e0e8] flex items-center gap-2">
            <DollarSign size={20} className="text-indigo-400" />
            Cost Tracking
          </h1>
          <p className="text-sm text-[#8888a0] mt-0.5">Monitor and forecast your observability costs</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-[#1e1e2e] overflow-hidden">
            <button
              onClick={() => setView('overview')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                view === 'overview'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#13131a] text-[#8888a0] hover:text-[#e0e0e8]'
              }`}
            >Overview</button>
            <button
              onClick={() => setView('breakdown')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                view === 'breakdown'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#13131a] text-[#8888a0] hover:text-[#e0e0e8]'
              }`}
            >Breakdown</button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loadingSummary ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-[#13131a] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <CostStatCard
              label="Total Cost"
              value={formatCost(summary?.total_cost || 0)}
              change={summary?.cost_change_pct}
              icon={<DollarSign size={16} className="text-indigo-400" />}
            />
            <CostStatCard
              label="Projected Monthly"
              value={formatCost(forecast?.projected_monthly || 0)}
              icon={<TrendingUp size={16} className="text-purple-400" />}
            />
            <CostStatCard
              label="Current Monthly"
              value={formatCost(forecast?.current_monthly || 0)}
              icon={<Activity size={16} className="text-cyan-400" />}
            />
            <CostStatCard
              label="Datasets"
              value={pieData.length.toString()}
              icon={<PieIcon size={16} className="text-amber-400" />}
            />
          </div>

          {view === 'overview' ? (
            <>
              {/* Charts Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Cost Trend */}
                <div className="rounded-lg border border-[#1e1e2e] bg-[#13131a] p-4">
                  <h3 className="text-sm font-semibold text-[#e0e0e8] mb-4">Cost Over Time</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={trends || []}>
                      <defs>
                        <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis dataKey="date" tick={{ fill: chartTheme.text, fontSize: 11 }} />
                      <YAxis tick={{ fill: chartTheme.text, fontSize: 11 }} tickFormatter={(v) => '$' + v} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="cost" stroke="#818cf8" fill="url(#costGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Cost by Dataset - Pie */}
                <div className="rounded-lg border border-[#1e1e2e] bg-[#13131a] p-4">
                  <h3 className="text-sm font-semibold text-[#e0e0e8] mb-4">Cost by Dataset</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: chartTheme.text }}
                        formatter={(value: string) => <span className="text-[#8888a0]">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Cost by Service Bar Chart */}
              <div className="rounded-lg border border-[#1e1e2e] bg-[#13131a] p-4">
                <h3 className="text-sm font-semibold text-[#e0e0e8] mb-4">Cost by Service</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={serviceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                    <XAxis type="number" tick={{ fill: chartTheme.text, fontSize: 11 }} tickFormatter={(v) => '$' + v} />
                    <YAxis dataKey="name" type="category" tick={{ fill: chartTheme.text, fontSize: 11 }} width={120} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="cost" fill="#a78bfa" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Forecast */}
              {forecast?.daily_forecast && (
                <div className="rounded-lg border border-[#1e1e2e] bg-[#13131a] p-4">
                  <h3 className="text-sm font-semibold text-[#e0e0e8] mb-4">Cost Forecast (30 days)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={forecast.daily_forecast}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis dataKey="date" tick={{ fill: chartTheme.text, fontSize: 11 }} />
                      <YAxis tick={{ fill: chartTheme.text, fontSize: 11 }} tickFormatter={(v) => '$' + v} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="cost"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top Traces */}
              <TopTracesTable traces={topTraces || []} />
            </>
          ) : (
            /* Breakdown View */
            <>
              {loadingBreakdown ? (
                <div className="h-64 rounded-lg bg-[#13131a] animate-pulse" />
              ) : breakdown?.items ? (
                <BreakdownTable items={breakdown.items} />
              ) : (
                <div className="rounded-lg border border-[#1e1e2e] bg-[#13131a] p-12 text-center">
                  <DollarSign size={40} className="mx-auto text-[#333344] mb-3" />
                  <p className="text-[#555566]">No cost breakdown data available</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
