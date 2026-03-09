import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Bell, BellOff, Plus, Trash2, Play } from 'lucide-react'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL ?? ''
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('api_key') ?? ''}`,
})

interface AlertRule {
  id: string
  name: string
  condition: string
  threshold: number
  window_seconds: number
  severity: 'critical' | 'warning' | 'info'
  enabled: boolean
  fired_count: number
  last_fired_at: string | null
  created_at: string
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10',
  warning: 'text-yellow-400 bg-yellow-400/10',
  info: 'text-blue-400 bg-blue-400/10',
}

export default function Alerts() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', condition: 'error_rate', threshold: 5, window_seconds: 300, severity: 'warning' })

  const { data, isLoading } = useQuery<{ items: AlertRule[] }>({
    queryKey: ['alerts'],
    queryFn: () => fetch(`${API}/alerts`, { headers: headers() }).then(r => r.json()),
    refetchInterval: 15000,
  })

  const { data: fired } = useQuery<{ items: any[] }>({
    queryKey: ['alerts-fired'],
    queryFn: () => fetch(`${API}/alerts/fired`, { headers: headers() }).then(r => r.json()),
    refetchInterval: 15000,
  })

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => fetch(`${API}/alerts`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }); setShowCreate(false); toast.success('Alert rule created') },
    onError: () => toast.error('Failed to create alert'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`${API}/alerts/${id}`, { method: 'DELETE', headers: headers() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }); toast.success('Alert deleted') },
  })

  const testMutation = useMutation({
    mutationFn: (id: string) => fetch(`${API}/alerts/${id}/test-fire`, { method: 'POST', headers: headers() }).then(r => r.json()),
    onSuccess: () => toast.success('Test alert fired'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      fetch(`${API}/alerts/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ enabled }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const rules = data?.items ?? []
  const firedItems = fired?.items ?? []

  return (
    <div className="ch-page-container">
      <div className="ch-page-header">
        <div>
          <h1 className="ch-page-title">Alerts</h1>
          <p className="ch-page-subtitle">{rules.length} rules · {firedItems.length} recent fires</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="ch-btn ch-btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="ch-card p-6 mb-6">
          <h3 className="text-sm font-semibold text-[var(--ch-text-primary)] mb-4">New Alert Rule</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ch-label">Name</label>
              <input className="ch-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="High error rate" />
            </div>
            <div>
              <label className="ch-label">Condition</label>
              <select className="ch-input" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                <option value="error_rate">Error Rate %</option>
                <option value="latency_p95">p95 Latency (ms)</option>
                <option value="token_usage">Token Usage</option>
                <option value="cost_per_hour">Cost/hr ($)</option>
              </select>
            </div>
            <div>
              <label className="ch-label">Threshold</label>
              <input type="number" className="ch-input" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: +e.target.value }))} />
            </div>
            <div>
              <label className="ch-label">Severity</label>
              <select className="ch-input" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMutation.mutate(form)} className="ch-btn ch-btn-primary" disabled={!form.name}>Create</button>
            <button onClick={() => setShowCreate(false)} className="ch-btn ch-btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {isLoading ? (
        <div className="ch-card p-12 text-center text-[var(--ch-text-secondary)]">Loading alerts...</div>
      ) : rules.length === 0 ? (
        <div className="ch-card p-12 text-center">
          <Bell className="w-10 h-10 text-[var(--ch-text-secondary)] mx-auto mb-3" />
          <p className="text-[var(--ch-text-secondary)]">No alert rules yet. Create one to get notified of anomalies.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className="ch-card p-4 flex items-center gap-4">
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${SEVERITY_COLORS[rule.severity]?.split(' ')[0] ?? 'text-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--ch-text-primary)] text-sm">{rule.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLORS[rule.severity] ?? ''}`}>{rule.severity}</span>
                  {!rule.enabled && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">disabled</span>}
                </div>
                <div className="text-xs text-[var(--ch-text-secondary)] mt-0.5">
                  {rule.condition} &gt; {rule.threshold} · {rule.window_seconds}s window · fired {rule.fired_count}×
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => testMutation.mutate(rule.id)} className="ch-btn ch-btn-ghost p-2" title="Test fire">
                  <Play className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })} className="ch-btn ch-btn-ghost p-2" title={rule.enabled ? 'Disable' : 'Enable'}>
                  {rule.enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => deleteMutation.mutate(rule.id)} className="ch-btn ch-btn-ghost p-2 text-red-400 hover:text-red-300" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent fires */}
      {firedItems.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-[var(--ch-text-primary)] mb-3">Recent Fires</h2>
          <div className="space-y-2">
            {firedItems.slice(0, 10).map((f, i) => (
              <div key={i} className="ch-card p-3 flex items-center gap-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="text-[var(--ch-text-primary)]">{f.alert_name ?? f.alert_id}</span>
                <span className="text-[var(--ch-text-secondary)] ml-auto text-xs">{f.fired_at ? new Date(f.fired_at).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
