import { useQuery } from '@tanstack/react-query'
import { DollarSign, TrendingUp, Cpu, Zap } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'

const API = import.meta.env.VITE_API_URL ?? ''
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('api_key') ?? ''}` })

const MOCK_DAILY = Array.from({ length: 14 }, (_, i) => ({
  day: `Mar ${i + 1}`,
  cost: +(Math.random() * 8 + 2).toFixed(2),
  tokens: Math.floor(Math.random() * 500000 + 100000),
  calls: Math.floor(Math.random() * 1200 + 300),
}))

const MOCK_BY_AGENT = [
  { agent: 'research-agent', cost: 12.4, tokens: 820000 },
  { agent: 'summarizer', cost: 6.8, tokens: 450000 },
  { agent: 'classifier', cost: 3.2, tokens: 210000 },
  { agent: 'extractor', cost: 8.1, tokens: 540000 },
]

export default function CostTracking() {
  const { data } = useQuery({
    queryKey: ['cost-analytics'],
    queryFn: () => fetch(`${API}/analytics/cost`, { headers: headers() }).then(r => r.json()).catch(() => null),
    refetchInterval: 60000,
  })

  const totalCost = MOCK_DAILY.reduce((s, d) => s + d.cost, 0)
  const totalTokens = MOCK_DAILY.reduce((s, d) => s + d.tokens, 0)
  const totalCalls = MOCK_DAILY.reduce((s, d) => s + d.calls, 0)
  const avgPerDay = totalCost / MOCK_DAILY.length

  return (
    <div className="ch-page-container">
      <div className="ch-page-header">
        <div>
          <h1 className="ch-page-title">Cost Tracking</h1>
          <p className="ch-page-subtitle">LLM token usage and spend across agent workflows</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Spend (14d)', value: `$${totalCost.toFixed(2)}`, icon: DollarSign, color: 'green' },
          { label: 'Avg/Day', value: `$${avgPerDay.toFixed(2)}`, icon: TrendingUp, color: 'blue' },
          { label: 'Total Tokens', value: `${(totalTokens / 1e6).toFixed(1)}M`, icon: Cpu, color: 'purple' },
          { label: 'Total Calls', value: totalCalls.toLocaleString(), icon: Zap, color: 'yellow' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="ch-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[var(--ch-text-secondary)]">{label}</span>
              <Icon className={`w-4 h-4 text-${color}-400`} />
            </div>
            <div className="text-xl font-bold text-[var(--ch-text-primary)]">{value}</div>
          </div>
        ))}
      </div>

      {/* Daily cost chart */}
      <div className="ch-card p-6 mb-6">
        <h2 className="text-sm font-semibold text-[var(--ch-text-primary)] mb-4">Daily Spend & Token Usage</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={MOCK_DAILY}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ch-border)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--ch-text-secondary)' }} />
            <YAxis yAxisId="cost" tick={{ fontSize: 11, fill: 'var(--ch-text-secondary)' }} tickFormatter={v => `$${v}`} />
            <YAxis yAxisId="tokens" orientation="right" tick={{ fontSize: 11, fill: 'var(--ch-text-secondary)' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: 'var(--ch-surface)', border: '1px solid var(--ch-border)', borderRadius: 8 }} />
            <Legend />
            <Line yAxisId="cost" type="monotone" dataKey="cost" stroke="#22c55e" name="Cost ($)" dot={false} strokeWidth={2} />
            <Line yAxisId="tokens" type="monotone" dataKey="tokens" stroke="#8b5cf6" name="Tokens" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cost by agent */}
      <div className="ch-card p-6">
        <h2 className="text-sm font-semibold text-[var(--ch-text-primary)] mb-4">Cost by Agent (14d)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={MOCK_BY_AGENT} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ch-border)" />
            <XAxis type="number" tickFormatter={v => `$${v}`} tick={{ fontSize: 11, fill: 'var(--ch-text-secondary)' }} />
            <YAxis dataKey="agent" type="category" tick={{ fontSize: 11, fill: 'var(--ch-text-secondary)' }} width={100} />
            <Tooltip contentStyle={{ background: 'var(--ch-surface)', border: '1px solid var(--ch-border)', borderRadius: 8 }} formatter={(v: any) => [`$${v}`, 'Cost']} />
            <Bar dataKey="cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
