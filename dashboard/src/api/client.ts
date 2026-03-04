const BASE = import.meta.env.VITE_API_URL || '/api'
const KEY = () => localStorage.getItem('tl_api_key') || ''

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY()}`, ...opts.headers },
    })
    if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(e.detail || `HTTP ${res.status}`)
    }
    return res.json()
}

export interface Span {
    span_id: string; parent_span_id: string | null; name: string
    start_time: string; end_time: string | null; duration_ms: number | null
    status: 'success' | 'error'; error: string | null; attributes: Record<string, unknown>
}
export interface Trace {
    trace_id: string; tenant_id: string; start_time: string
    end_time: string | null; spans: Span[]
}
export interface Incident {
    incident_id: string; tenant_id: string; cluster_id: string
    severity: 'critical' | 'high' | 'normal'; status: 'open' | 'acknowledged' | 'resolved'
    count: number; first_seen: string; last_seen: string; failing_node?: string
}
export interface Cluster {
    cluster_id: string; fingerprint: string; failing_node: string
    error_type: string; count: number; executions: string[]
}
export interface LatencyRow {
    name: string; call_count: number; p50_ms: number
    p95_ms: number; p99_ms: number; avg_ms: number
    error_count: number; error_rate_pct: number
}
export interface Paginated<T> {
    items: T[]; total: number; limit: number; offset: number; has_more: boolean
}
export interface ReplayReport {
    graph_id: string; total_nodes: number; nodes_replayed: number
    divergences_found: number; is_deterministic: boolean
    results: Array<{ node_id: string; success: boolean; divergence_type?: string; divergence_details?: string }>
}

export const api = {
    executions: {
        list: (limit = 50, offset = 0) => req<Paginated<string>>(`/executions?limit=${limit}&offset=${offset}`),
        get: (id: string) => req<Trace>(`/executions/${id}`),
        replay: (id: string) => req<ReplayReport>(`/executions/${id}/replay`, { method: 'POST' }),
        diff: (a: string, b: string) => req<Record<string, unknown[]>>('/executions/diff', {
            method: 'POST', body: JSON.stringify({ execution_a: a, execution_b: b }),
        }),
    },
    incidents: {
        list: (limit = 50, offset = 0) => req<Paginated<Incident>>(`/incidents?limit=${limit}&offset=${offset}`),
        ack: (id: string) => req<Incident>(`/incidents/${id}/ack`, { method: 'POST' }),
        resolve: (id: string) => req<Incident>(`/incidents/${id}/resolve`, { method: 'POST' }),
    },
    clusters: {
        list: (hours = 24) => req<Paginated<Cluster>>(`/clusters?hours=${hours}&limit=50`),
    },
    analytics: {
        latency: (hours = 24) => req<Paginated<LatencyRow>>(`/analytics/latency?hours=${hours}&limit=200`),
        trends: (hours = 168) => req<unknown[]>(`/analytics/trends?hours=${hours}`),
    },
    keys: { list: () => req<unknown[]>('/keys') },
    admin: {
        listTenants: (adminKey: string) =>
            fetch(`${BASE}/admin/tenants`, { headers: { 'X-Admin-Key': adminKey } }).then(r => r.json()),
        register: (tenantId: string, adminKey: string) =>
            fetch(`${BASE}/admin/tenants/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
                body: JSON.stringify({ tenant_id: tenantId }),
            }).then(r => r.json()),
        rotateKey: (tenantId: string, adminKey: string) =>
            fetch(`${BASE}/admin/tenants/${tenantId}/rotate-key`, {
                method: 'POST', headers: { 'X-Admin-Key': adminKey },
            }).then(r => r.json()),
    },
    health: {
        check: () => req<{ status: string }>('/health'),
        ready: () => req<{ status: string; backends: Record<string, string> }>('/ready'),
    },
}
