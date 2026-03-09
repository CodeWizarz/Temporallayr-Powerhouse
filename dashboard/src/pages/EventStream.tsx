import { useState, useEffect, useRef, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StreamEvent {
    span_id: string
    trace_id: string
    name: string
    span_kind: string
    status: string
    start_time: string
    end_time?: string
    service_name?: string
    tenant_id?: string
    token_input?: number
    token_output?: number
    cost?: number
    error_message?: string
    [key: string]: any
}

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_EVENTS = 500
const RECONNECT_DELAY_MS = 3000
const BASE = (import.meta as any).env?.VITE_API_URL || '/api'
const KEY = () => localStorage.getItem('tl_api_key') || ''

const KIND_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
    llm:      { bg: 'rgba(168, 85, 247, 0.15)', fg: '#c084fc', label: 'LLM' },
    tool:     { bg: 'rgba(96, 165, 250, 0.15)',  fg: '#60a5fa', label: 'Tool' },
    pipeline: { bg: 'rgba(74, 222, 128, 0.15)',  fg: '#4ade80', label: 'Pipeline' },
    agent:    { bg: 'rgba(251, 191, 36, 0.15)',   fg: '#fbbf24', label: 'Agent' },
}

const STATUS_BADGE: Record<string, string> = {
    success: 'badge badge-success',
    error:   'badge badge-error',
    running: 'badge badge-warning',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
    if (!iso) return '--'
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 0) return 'just now'
    const seconds = Math.floor(diff / 1000)
    if (seconds < 5)  return 'just now'
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

function formatDuration(start: string, end?: string): string {
    if (!start || !end) return '--'
    const ms = new Date(end).getTime() - new Date(start).getTime()
    if (ms < 0) return '--'
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
}

function formatCost(cost?: number): string {
    if (cost == null) return ''
    return `$${cost.toFixed(4)}`
}

function kindStyle(kind: string) {
    const lower = (kind || '').toLowerCase()
    return KIND_COLORS[lower] || { bg: 'var(--bg-elevated)', fg: 'var(--text-secondary)', label: kind || 'unknown' }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventStreamPage() {
    // State
    const [events, setEvents] = useState<StreamEvent[]>([])
    const [paused, setPaused] = useState(false)
    const [connStatus, setConnStatus] = useState<ConnectionStatus>('disconnected')
    const [expandedId, setExpandedId] = useState<string | null>(null)

    // Filters
    const [filterKind, setFilterKind] = useState<string>('all')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [searchText, setSearchText] = useState('')

    // Refs
    const eventSourceRef = useRef<EventSource | null>(null)
    const bufferRef = useRef<StreamEvent[]>([])
    const pausedRef = useRef(paused)
    const scrollRef = useRef<HTMLDivElement>(null)
    const isHoveringRef = useRef(false)
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Keep ref in sync with state
    useEffect(() => { pausedRef.current = paused }, [paused])

    // ------------------------------------------------------------------
    // SSE Connection
    // ------------------------------------------------------------------
    const connect = useCallback(() => {
        // Clean up any existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = null
        }

        setConnStatus('reconnecting')

        const url = `${BASE}/v1/stream?token=${encodeURIComponent(KEY())}`
        const es = new EventSource(url)
        eventSourceRef.current = es

        es.onopen = () => {
            setConnStatus('connected')
        }

        es.onmessage = (msg) => {
            try {
                const evt: StreamEvent = JSON.parse(msg.data)
                if (!evt.span_id) return

                if (pausedRef.current) {
                    // Buffer while paused - keep max 200 in buffer
                    bufferRef.current = [evt, ...bufferRef.current].slice(0, 200)
                } else {
                    setEvents(prev => [evt, ...prev].slice(0, MAX_EVENTS))
                }
            } catch {
                // Ignore malformed messages
            }
        }

        es.onerror = () => {
            es.close()
            eventSourceRef.current = null
            setConnStatus('disconnected')

            // Auto-reconnect
            reconnectTimerRef.current = setTimeout(() => {
                setConnStatus('reconnecting')
                connect()
            }, RECONNECT_DELAY_MS)
        }
    }, [])

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------
    useEffect(() => {
        connect()

        // Relative time ticker -- re-render every 5s to update timestamps
        tickRef.current = setInterval(() => {
            setEvents(prev => [...prev])
        }, 5000)

        return () => {
            if (eventSourceRef.current) eventSourceRef.current.close()
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
            if (tickRef.current) clearInterval(tickRef.current)
        }
    }, [connect])

    // ------------------------------------------------------------------
    // Flush buffer on resume
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!paused && bufferRef.current.length > 0) {
            setEvents(prev => [...bufferRef.current, ...prev].slice(0, MAX_EVENTS))
            bufferRef.current = []
        }
    }, [paused])

    // ------------------------------------------------------------------
    // Auto-scroll
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!paused && !isHoveringRef.current && scrollRef.current) {
            scrollRef.current.scrollTop = 0
        }
    }, [events, paused])

    // ------------------------------------------------------------------
    // Filter logic
    // ------------------------------------------------------------------
    const filtered = events.filter(evt => {
        if (filterKind !== 'all' && (evt.span_kind || '').toLowerCase() !== filterKind) return false
        if (filterStatus !== 'all' && (evt.status || '').toLowerCase() !== filterStatus) return false
        if (searchText) {
            const q = searchText.toLowerCase()
            const haystack = `${evt.name} ${evt.span_id} ${evt.trace_id} ${evt.service_name || ''} ${evt.error_message || ''}`.toLowerCase()
            if (!haystack.includes(q)) return false
        }
        return true
    })

    // ------------------------------------------------------------------
    // Connection status badge
    // ------------------------------------------------------------------
    function ConnBadge() {
        const map: Record<ConnectionStatus, { cls: string; dot: string; text: string }> = {
            connected:    { cls: 'badge badge-success', dot: '#4ade80', text: 'Connected' },
            disconnected: { cls: 'badge badge-error',   dot: '#f87171', text: 'Disconnected' },
            reconnecting: { cls: 'badge badge-warning', dot: '#fb923c', text: 'Reconnecting' },
        }
        const s = map[connStatus]
        return (
            <span className={s.cls}>
                <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: s.dot, display: 'inline-block',
                    marginRight: 4,
                    animation: connStatus === 'reconnecting' ? 'spin 1s linear infinite' : connStatus === 'connected' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
                }} />
                {s.text}
            </span>
        )
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
        <>
            {/* ---------- Context sidebar ---------- */}
            <div className="ch-sidebar-context">
                <div className="ch-context-header">
                    <div className="ch-context-tab active">Stream</div>
                    <div className="ch-context-tab">History</div>
                </div>
                <div className="ch-context-content">
                    {/* Filters */}
                    <div className="mb-4">
                        <div className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-2 px-1">Filters</div>

                        <label className="block text-xs text-text-muted mb-1 px-1">Span Kind</label>
                        <select
                            className="ch-form-select ch-form-select--sm w-full mb-3"
                            value={filterKind}
                            onChange={e => setFilterKind(e.target.value)}
                        >
                            <option value="all">All kinds</option>
                            <option value="llm">LLM</option>
                            <option value="tool">Tool</option>
                            <option value="pipeline">Pipeline</option>
                            <option value="agent">Agent</option>
                        </select>

                        <label className="block text-xs text-text-muted mb-1 px-1">Status</label>
                        <select
                            className="ch-form-select ch-form-select--sm w-full mb-3"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All statuses</option>
                            <option value="success">Success</option>
                            <option value="error">Error</option>
                            <option value="running">Running</option>
                        </select>

                        <label className="block text-xs text-text-muted mb-1 px-1">Search</label>
                        <input
                            className="input w-full"
                            type="text"
                            placeholder="Filter by name, ID..."
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                        />
                    </div>

                    <div className="border-t border-border-subtle mt-4 pt-4">
                        <div className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-3 px-1">Legend</div>
                        {Object.entries(KIND_COLORS).map(([kind, c]) => (
                            <div key={kind} className="flex items-center gap-2 py-1 px-1">
                                <span style={{
                                    width: 10, height: 10, borderRadius: 'var(--radius-sm)',
                                    background: c.bg, border: `1px solid ${c.fg}`,
                                    display: 'inline-block', flexShrink: 0,
                                }} />
                                <span className="text-xs text-text-secondary">{c.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-border-subtle mt-4 pt-4">
                        <div className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-2 px-1">Stats</div>
                        <div className="flex flex-col gap-2 px-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-text-muted">Total captured</span>
                                <span className="text-text-primary font-semibold">{events.length}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-text-muted">Visible</span>
                                <span className="text-text-primary font-semibold">{filtered.length}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-text-muted">Buffered</span>
                                <span className="text-text-primary font-semibold">{bufferRef.current.length}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-text-muted">Errors</span>
                                <span className="text-error font-semibold">
                                    {events.filter(e => e.status === 'error').length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ---------- Main workspace ---------- */}
            <main className="ch-workspace">
                {/* Top bar */}
                <header className="ch-topbar">
                    <div className="ch-topbar-title flex items-center gap-3">
                        <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="text-sm font-bold text-text-primary">Event Stream</span>
                        <ConnBadge />
                        <span className="badge badge-neutral">
                            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="ch-topbar-actions">
                        {/* Pause / Resume */}
                        <button
                            className={paused ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                            onClick={() => setPaused(p => !p)}
                        >
                            {paused ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    </svg>
                                    Resume{bufferRef.current.length > 0 ? ` (${bufferRef.current.length})` : ''}
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Pause
                                </>
                            )}
                        </button>

                        {/* Clear */}
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setEvents([]); bufferRef.current = [] }}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Clear
                        </button>

                        {/* Reconnect */}
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={connect}
                            title="Reconnect"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </header>

                {/* Paused banner */}
                {paused && (
                    <div className="px-4 py-2" style={{ background: 'var(--accent-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center gap-2 text-xs">
                            <svg className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span style={{ color: 'var(--accent)' }} className="font-semibold">Stream paused</span>
                            <span className="text-text-muted">
                                {bufferRef.current.length > 0
                                    ? `-- ${bufferRef.current.length} event${bufferRef.current.length !== 1 ? 's' : ''} buffered`
                                    : '-- click Resume to continue'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Event list */}
                <div
                    className="ch-workspace-scroll"
                    ref={scrollRef}
                    onMouseEnter={() => { isHoveringRef.current = true }}
                    onMouseLeave={() => { isHoveringRef.current = false }}
                >
                    <div className="p-0 m-0 w-full">
                        {filtered.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <svg className="w-6 h-6 mx-auto" style={{ color: 'var(--text-muted)', opacity: 0.5 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div className="empty-state-title">
                                    {events.length === 0 ? 'Waiting for events...' : 'No events match filters'}
                                </div>
                                <div className="empty-state-desc">
                                    {events.length === 0
                                        ? 'Events will appear here as your agents execute. Make sure the SSE endpoint is running.'
                                        : 'Try adjusting your filter criteria.'}
                                </div>
                                {events.length === 0 && connStatus === 'connected' && (
                                    <div className="mt-3">
                                        <span className="loading-spinner" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {filtered.map(evt => {
                                    const kc = kindStyle(evt.span_kind)
                                    const isExpanded = expandedId === evt.span_id
                                    const statusCls = STATUS_BADGE[(evt.status || '').toLowerCase()] || 'badge badge-neutral'
                                    const hasTokens = evt.token_input != null || evt.token_output != null
                                    const hasCost = evt.cost != null

                                    return (
                                        <div
                                            key={evt.span_id}
                                            className="px-4 py-3 border-b border-border-subtle transition-colors"
                                            style={{
                                                borderLeft: `3px solid ${kc.fg}`,
                                                cursor: 'pointer',
                                                background: isExpanded ? 'var(--bg-surface)' : 'transparent',
                                            }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)' }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isExpanded ? 'var(--bg-surface)' : 'transparent' }}
                                            onClick={() => setExpandedId(isExpanded ? null : evt.span_id)}
                                        >
                                            {/* Row 1: Main info */}
                                            <div className="flex items-center gap-3">
                                                {/* Timestamp */}
                                                <span className="text-xs text-text-muted font-mono shrink-0" style={{ minWidth: 64 }}>
                                                    {relativeTime(evt.start_time)}
                                                </span>

                                                {/* Kind badge */}
                                                <span
                                                    className="badge shrink-0"
                                                    style={{
                                                        background: kc.bg,
                                                        color: kc.fg,
                                                        minWidth: 60,
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    {kc.label}
                                                </span>

                                                {/* Name */}
                                                <span className="text-sm text-text-primary font-medium truncate flex-1" title={evt.name}>
                                                    {evt.name || 'unnamed'}
                                                </span>

                                                {/* Status */}
                                                <span className={`${statusCls} shrink-0`}>
                                                    {evt.status || 'unknown'}
                                                </span>

                                                {/* Duration */}
                                                <span className="text-xs text-text-muted font-mono shrink-0" style={{ minWidth: 56, textAlign: 'right' }}>
                                                    {formatDuration(evt.start_time, evt.end_time)}
                                                </span>

                                                {/* Tokens (LLM only) */}
                                                {hasTokens && (
                                                    <span className="text-xs text-text-muted shrink-0" title="in / out tokens">
                                                        <svg className="w-3 h-3 inline mr-1" style={{ color: '#c084fc', verticalAlign: 'middle' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                                        </svg>
                                                        {evt.token_input ?? 0}/{evt.token_output ?? 0}
                                                    </span>
                                                )}

                                                {/* Cost */}
                                                {hasCost && (
                                                    <span className="text-xs font-mono shrink-0" style={{ color: 'var(--accent)' }}>
                                                        {formatCost(evt.cost)}
                                                    </span>
                                                )}

                                                {/* Expand chevron */}
                                                <svg
                                                    className="w-3.5 h-3.5 text-text-muted shrink-0 transition-transform"
                                                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>

                                            {/* Row 2: Subtitle (service, trace id, error) */}
                                            <div className="flex items-center gap-2 mt-1 ml-1" style={{ paddingLeft: 68 }}>
                                                {evt.service_name && (
                                                    <span className="badge badge-neutral text-xs">{evt.service_name}</span>
                                                )}
                                                <span className="text-xs text-text-muted font-mono truncate" title={evt.trace_id}>
                                                    {evt.trace_id ? evt.trace_id.substring(0, 16) + '...' : ''}
                                                </span>
                                                {evt.error_message && (
                                                    <span className="text-xs text-error truncate" style={{ maxWidth: 300 }} title={evt.error_message}>
                                                        {evt.error_message}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Expanded JSON viewer */}
                                            {isExpanded && (
                                                <div
                                                    className="mt-3 rounded"
                                                    style={{
                                                        background: 'var(--bg-base)',
                                                        border: '1px solid var(--border-subtle)',
                                                        marginLeft: 68,
                                                    }}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
                                                        <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">
                                                            Event Payload
                                                        </span>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(JSON.stringify(evt, null, 2))
                                                            }}
                                                            title="Copy JSON"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    <pre
                                                        className="p-3 text-xs font-mono overflow-x-auto"
                                                        style={{
                                                            color: 'var(--text-secondary)',
                                                            whiteSpace: 'pre-wrap',
                                                            wordBreak: 'break-all',
                                                            maxHeight: 320,
                                                            overflowY: 'auto',
                                                        }}
                                                    >
                                                        {JSON.stringify(evt, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Inline keyframe for pulsing dot */}
            <style>{`
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </>
    )
}
