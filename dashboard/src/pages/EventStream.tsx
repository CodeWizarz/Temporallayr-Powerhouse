import { useEffect, useRef, useState } from 'react'
import { Activity, Pause, Play, Trash2, Filter } from 'lucide-react'

const API = import.meta.env.VITE_API_URL ?? ''

interface StreamEvent {
  id: string
  type: string
  timestamp: string
  tenant_id?: string
  seq?: number
  [key: string]: any
}

const TYPE_COLORS: Record<string, string> = {
  heartbeat: 'text-gray-400',
  agent_run_start: 'text-blue-400',
  agent_run_end: 'text-green-400',
  agent_error: 'text-red-400',
  tool_call: 'text-yellow-400',
  llm_call: 'text-purple-400',
}

export default function EventStream() {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('')
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  useEffect(() => {
    const apiKey = localStorage.getItem('api_key') ?? ''
    const url = `${API}/stream/events?token=${encodeURIComponent(apiKey)}`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (e) => {
      if (pausedRef.current) return
      try {
        const ev: StreamEvent = JSON.parse(e.data)
        setEvents(prev => [ev, ...prev].slice(0, 500))
      } catch {}
    }

    return () => { es.close(); setConnected(false) }
  }, [])

  const filtered = filter
    ? events.filter(e => JSON.stringify(e).toLowerCase().includes(filter.toLowerCase()))
    : events

  return (
    <div className="ch-page-container h-full flex flex-col">
      <div className="ch-page-header flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="ch-page-title">Live Event Stream</h1>
          <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${connected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ch-text-secondary)]" />
            <input
              className="ch-input pl-8 text-xs h-8 w-48"
              placeholder="Filter events..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <button onClick={() => setPaused(p => !p)} className={`ch-btn flex items-center gap-1.5 text-xs ${paused ? 'ch-btn-primary' : 'ch-btn-secondary'}`}>
            {paused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause</>}
          </button>
          <button onClick={() => setEvents([])} className="ch-btn ch-btn-ghost p-2" title="Clear">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-xs space-y-px">
        {filtered.length === 0 ? (
          <div className="ch-card p-12 text-center">
            <Activity className="w-8 h-8 text-[var(--ch-text-secondary)] mx-auto mb-3 animate-pulse" />
            <p className="text-[var(--ch-text-secondary)]">Waiting for events...</p>
          </div>
        ) : filtered.map((ev, i) => (
          <div key={ev.id ?? i} className="flex items-start gap-3 px-3 py-1.5 rounded hover:bg-[var(--ch-surface-hover)] group">
            <span className="text-[var(--ch-text-secondary)] flex-shrink-0 w-20">{new Date(ev.timestamp).toLocaleTimeString()}</span>
            <span className={`flex-shrink-0 w-28 ${TYPE_COLORS[ev.type] ?? 'text-[var(--ch-text-primary)]'}`}>{ev.type}</span>
            <span className="text-[var(--ch-text-secondary)] truncate">{JSON.stringify({ ...ev, type: undefined, timestamp: undefined, id: undefined })}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
