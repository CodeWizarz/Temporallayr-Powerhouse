import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Database, Plus, Trash2, FolderOpen } from 'lucide-react'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL ?? ''
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('api_key') ?? ''}`,
})

interface Dataset {
  id: string
  name: string
  description: string
  event_count: number
  created_at: string
  updated_at: string
}

export default function Datasets() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  const { data, isLoading } = useQuery<{ items: Dataset[]; total: number }>({
    queryKey: ['datasets'],
    queryFn: () => fetch(`${API}/datasets`, { headers: headers() }).then(r => r.json()),
    refetchInterval: 30000,
  })

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => fetch(`${API}/datasets`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasets'] }); setShowCreate(false); setForm({ name: '', description: '' }); toast.success('Dataset created') },
    onError: () => toast.error('Failed to create dataset'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`${API}/datasets/${id}`, { method: 'DELETE', headers: headers() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasets'] }); toast.success('Dataset deleted') },
  })

  const datasets = data?.items ?? []

  return (
    <div className="ch-page-container">
      <div className="ch-page-header">
        <div>
          <h1 className="ch-page-title">Datasets</h1>
          <p className="ch-page-subtitle">{data?.total ?? 0} datasets · Organize your agent event streams</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="ch-btn ch-btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Dataset
        </button>
      </div>

      {showCreate && (
        <div className="ch-card p-6 mb-6">
          <h3 className="text-sm font-semibold text-[var(--ch-text-primary)] mb-4">New Dataset</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ch-label">Name</label>
              <input className="ch-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="production-agents" />
            </div>
            <div>
              <label className="ch-label">Description</label>
              <input className="ch-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Production agent workflow events" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMutation.mutate(form)} className="ch-btn ch-btn-primary" disabled={!form.name}>Create</button>
            <button onClick={() => setShowCreate(false)} className="ch-btn ch-btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="ch-card p-12 text-center text-[var(--ch-text-secondary)]">Loading datasets...</div>
      ) : datasets.length === 0 ? (
        <div className="ch-card p-12 text-center">
          <FolderOpen className="w-10 h-10 text-[var(--ch-text-secondary)] mx-auto mb-3" />
          <p className="text-[var(--ch-text-secondary)]">No datasets yet. Create one to start organizing your agent events.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {datasets.map(ds => (
            <div key={ds.id} className="ch-card p-5 flex flex-col gap-3 group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" />
                  <span className="font-medium text-[var(--ch-text-primary)]">{ds.name}</span>
                </div>
                <button onClick={() => deleteMutation.mutate(ds.id)} className="opacity-0 group-hover:opacity-100 ch-btn ch-btn-ghost p-1.5 text-red-400 hover:text-red-300 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {ds.description && <p className="text-xs text-[var(--ch-text-secondary)]">{ds.description}</p>}
              <div className="flex items-center justify-between text-xs text-[var(--ch-text-secondary)] mt-auto pt-2 border-t border-[var(--ch-border)]">
                <span>{ds.event_count.toLocaleString()} events</span>
                <span>{new Date(ds.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
