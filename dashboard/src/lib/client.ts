import { AUTH_KEY, API_BASE_URL } from './constants';
import type {
  Trace, TraceRow, Incident, Cluster, LatencyRow, ReplayReport, DiffReport,
  AlertRule, Dataset, DatasetSchema, CostSummary, CostTrend,
  HealthStatus, ServiceHealth, StreamStats, Paginated,
} from '../types';

class ApiClient {
  private get headers(): HeadersInit {
    const key = localStorage.getItem(AUTH_KEY);
    return {
      'Content-Type': 'application/json',
      ...(key ? { 'X-API-Key': key } : {}),
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options.headers as Record<string, string> },
    });

    if (res.status === 401) {
      localStorage.removeItem(AUTH_KEY);
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail || `API error: ${res.status}`);
    }

    return res.json();
  }

  private get<T>(path: string) { return this.request<T>(path); }
  private post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  }
  private put<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  }
  private del<T>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }

  /* Executions / Traces */
  executions = {
    list: (params?: { limit?: number; offset?: number; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      if (params?.search) q.set('search', params.search);
      return this.get<Paginated<TraceRow>>(`/executions?${q}`);
    },
    get: (id: string) => this.get<Trace>(`/executions/${id}`),
    replay: (id: string) => this.post<ReplayReport>(`/executions/${id}/replay`),
    diff: (a: string, b: string) => this.get<DiffReport>(`/executions/diff?trace_a=${a}&trace_b=${b}`),
  };

  /* Incidents */
  incidents = {
    list: (params?: { status?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.status && params.status !== 'all') q.set('status', params.status);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      return this.get<Paginated<Incident>>(`/incidents?${q}`);
    },
    ack: (id: string) => this.post<Incident>(`/incidents/${id}/acknowledge`),
    resolve: (id: string) => this.post<Incident>(`/incidents/${id}/resolve`),
  };

  /* Clusters */
  clusters = { list: () => this.get<Cluster[]>('/clusters') };

  /* Analytics */
  analytics = {
    latency: (period: string = '24h') => this.get<LatencyRow[]>(`/analytics/latency?period=${period}`),
    trends: (period: string = '7d') => this.get<Array<{ date: string; count: number; errors: number }>>(`/analytics/trends?period=${period}`),
  };

  /* Alerts */
  alerts = {
    list: () => this.get<AlertRule[]>('/alerts'),
    create: (data: Partial<AlertRule>) => this.post<AlertRule>('/alerts', data),
    update: (id: string, data: Partial<AlertRule>) => this.put<AlertRule>(`/alerts/${id}`, data),
    remove: (id: string) => this.del<void>(`/alerts/${id}`),
    silence: (id: string, duration: number) => this.post<void>(`/alerts/${id}/silence`, { duration }),
    test: (id: string) => this.post<{ success: boolean; message: string }>(`/alerts/${id}/test`),
    history: (id: string) => this.get<Array<{ triggered_at: string; resolved_at?: string; severity: string }>>(`/alerts/${id}/history`),
  };

  /* Stream */
  stream = {
    stats: () => this.get<StreamStats>('/stream/stats'),
    connect: (onEvent: (e: MessageEvent) => void) => {
      const key = localStorage.getItem(AUTH_KEY);
      const es = new EventSource(`${API_BASE_URL}/stream?api_key=${key}`);
      es.onmessage = onEvent;
      return es;
    },
  };

  /* Datasets */
  datasets = {
    list: () => this.get<Dataset[]>('/datasets'),
    get: (id: string) => this.get<Dataset>(`/datasets/${id}`),
    schema: (id: string) => this.get<DatasetSchema>(`/datasets/${id}/schema`),
    stats: (id: string) => this.get<{ row_count: number; size_bytes: number; last_updated: string }>(`/datasets/${id}/stats`),
    updateRetention: (id: string, days: number) => this.put<void>(`/datasets/${id}/retention`, { retention_days: days }),
  };

  /* Cost */
  cost = {
    summary: (period: string = '30d') => this.get<CostSummary>(`/cost/summary?period=${period}`),
    breakdown: (period: string = '30d') => this.get<CostSummary['breakdown']>(`/cost/breakdown?period=${period}`),
    trends: (period: string = '30d') => this.get<CostTrend[]>(`/cost/trends?period=${period}`),
    forecast: () => this.get<{ estimated_monthly: number; trend: string }>('/cost/forecast'),
    topTraces: (period: string = '30d') => this.get<Array<{ trace_id: string; cost: number; model: string }>>(`/cost/top-traces?period=${period}`),
  };

  /* Keys */
  keys = {
    list: () => this.get<Array<{ id: string; name: string; prefix: string; created_at: string; last_used?: string }>>('/keys'),
    create: (name: string) => this.post<{ id: string; key: string; name: string }>('/keys', { name }),
    revoke: (id: string) => this.del<void>(`/keys/${id}`),
  };

  /* Admin */
  admin = {
    listTenants: (adminKey: string) =>
      this.request<Array<{ tenant_id?: string; id?: string; created_at: string }>>('/admin/tenants', {
        headers: { 'X-Admin-Key': adminKey },
      }),
    register: (tenantId: string, adminKey: string) =>
      this.request<{ api_key: string; tenant_id: string }>('/admin/tenants', {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
        body: JSON.stringify({ tenant_id: tenantId }),
      }),
    rotateKey: (tenantId: string, adminKey: string) =>
      this.request<{ api_key: string }>(`/admin/tenants/${tenantId}/rotate`, {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
      }),
  };

  /* Health */
  health = {
    check: () => this.get<HealthStatus>('/health'),
    ready: () => this.get<{ ready: boolean; checks: Record<string, boolean> }>('/health/ready'),
    services: () => this.get<ServiceHealth[]>('/health/services'),
  };
}

export const api = new ApiClient();
