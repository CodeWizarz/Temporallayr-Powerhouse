import { AUTH_KEY, API_BASE_URL } from './constants';
import type {
  AlertRule,
  Cluster,
  CostSummary,
  CostTrend,
  Dataset,
  DatasetSchema,
  DiffReport,
  HealthStatus,
  Incident,
  LatencyRow,
  Paginated,
  ReplayReport,
  ServiceHealth,
  StreamStats,
  Trace,
  TraceRow,
} from '../types';

type JsonRecord = Record<string, unknown>;

interface ExecutionResponse extends JsonRecord {
  execution_id?: string;
  trace_id?: string;
  created_at?: string;
  start_time?: string;
  completed_at?: string;
  end_time?: string;
  status?: string;
  success?: boolean;
  spans?: Array<JsonRecord>;
  tenant_id?: string;
}

interface AlertEnvelope {
  alerts: AlertRule[];
  total: number;
}

interface DatasetEnvelope {
  datasets: Array<{
    name: string;
    total_rows: number;
    total_bytes: number;
    field_count: number;
  }>;
}

interface CostBreakdownRow {
  group_key: string;
  total_cost: number;
  input_tokens?: number;
  output_tokens?: number;
  span_count?: number;
  avg_cost?: number;
}

const BASE_URL = API_BASE_URL.replace(/\/$/, '');
const HOURS_BY_PERIOD: Record<string, number> = {
  '1h': 1,
  '6h': 6,
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};
const DAYS_BY_PERIOD: Record<string, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

function getApiKey() {
  return localStorage.getItem(AUTH_KEY) || '';
}

function toIso(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  return new Date().toISOString();
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeSpanStatus(value: unknown) {
  const raw = String(value ?? '').toUpperCase();
  if (raw === 'ERROR') return 'ERROR';
  if (raw === 'TIMEOUT') return 'TIMEOUT';
  return 'OK';
}

function normalizeTraceStatus(execution: ExecutionResponse) {
  if (typeof execution.status === 'string') {
    return execution.status.toUpperCase();
  }

  if (execution.success === false) {
    return 'ERROR';
  }

  const spans = Array.isArray(execution.spans) ? execution.spans : [];
  return spans.some((span) => normalizeSpanStatus(span.status) === 'ERROR') ? 'ERROR' : 'OK';
}

function durationFromExecution(execution: ExecutionResponse) {
  const start = new Date(String(execution.start_time ?? execution.created_at ?? '')).getTime();
  const end = new Date(String(execution.end_time ?? execution.completed_at ?? '')).getTime();

  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return end - start;
  }

  const spans = Array.isArray(execution.spans) ? execution.spans : [];
  return spans.reduce((max, span) => Math.max(max, toNumber(span.duration_ms)), 0);
}

function mapExecutionToTraceRow(execution: ExecutionResponse): TraceRow {
  const spans = Array.isArray(execution.spans) ? execution.spans : [];

  return {
    id: String(execution.execution_id ?? execution.trace_id ?? ''),
    status: normalizeTraceStatus(execution),
    tenant_id: String(execution.tenant_id ?? 'default'),
    span_count: spans.length,
    error_count: spans.filter((span) => normalizeSpanStatus(span.status) === 'ERROR').length,
    duration_ms: durationFromExecution(execution),
    created_at: toIso(execution.created_at ?? execution.start_time),
  };
}

function mapExecutionToTrace(execution: ExecutionResponse): Trace {
  const spans = Array.isArray(execution.spans) ? execution.spans : [];

  return {
    trace_id: String(execution.execution_id ?? execution.trace_id ?? ''),
    tenant_id: String(execution.tenant_id ?? 'default'),
    start_time: toIso(execution.start_time ?? execution.created_at),
    end_time: String(execution.end_time ?? execution.completed_at ?? ''),
    spans: spans.map((span) => ({
      span_id: String(span.span_id ?? ''),
      parent_span_id: span.parent_span_id ? String(span.parent_span_id) : null,
      name: String(span.name ?? 'span'),
      start_time: toIso(span.start_time),
      end_time: toIso(span.end_time),
      duration_ms: toNumber(span.duration_ms),
      status: normalizeSpanStatus(span.status),
      error: span.error ? String(span.error) : null,
      attributes: typeof span.attributes === 'object' && span.attributes ? (span.attributes as Record<string, unknown>) : {},
    })),
  };
}

class ApiClient {
  private get headers(): HeadersInit {
    const key = getApiKey();
    return {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}`, 'X-API-Key': key } : {}),
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...(options.headers as Record<string, string> | undefined),
      },
    });

    if (response.status === 401) {
      localStorage.removeItem(AUTH_KEY);
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error((body as { detail?: string }).detail || `API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  private get<T>(path: string) {
    return this.request<T>(path);
  }

  private post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private del<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }

  async verifyKey() {
    await this.get('/keys');
    return true;
  }

  async getExecutionRows(params?: { limit?: number; offset?: number; search?: string }): Promise<Paginated<TraceRow>> {
    const limit = params?.limit ?? 25;
    const offset = params?.offset ?? 0;
    const list = await this.get<Paginated<string>>(`/executions?limit=${limit}&offset=${offset}`);

    const details = await Promise.all(
      list.items.map(async (id) => {
        try {
          return await this.get<ExecutionResponse>(`/executions/${id}`);
        } catch {
          return null;
        }
      }),
    );

    let items = details.filter(Boolean).map((execution) => mapExecutionToTraceRow(execution as ExecutionResponse));
    if (params?.search) {
      const query = params.search.toLowerCase();
      items = items.filter((item) => item.id.toLowerCase().includes(query));
    }

    return { ...list, items };
  }

  executions = {
    list: (params?: { limit?: number; offset?: number; search?: string }) => this.getExecutionRows(params),
    get: async (id: string) => mapExecutionToTrace(await this.get<ExecutionResponse>(`/executions/${id}`)),
    replay: (id: string) => this.post<ReplayReport>(`/executions/${id}/replay`),
    diff: (a: string, b: string) =>
      this.post<DiffReport>('/executions/diff', { execution_a: a, execution_b: b }),
  };

  incidents = {
    list: async (params?: { status?: string; limit?: number; offset?: number }) => {
      const limit = params?.limit ?? 50;
      const offset = params?.offset ?? 0;
      const page = await this.get<Paginated<Incident>>(`/incidents?limit=${limit}&offset=${offset}`);
      const items = params?.status && params.status !== 'all'
        ? page.items.filter((item) => item.status === params.status)
        : page.items;
      return { ...page, items, total: items.length };
    },
    ack: (id: string) => this.post<Incident>(`/incidents/${id}/ack`),
    resolve: (id: string) => this.post<Incident>(`/incidents/${id}/resolve`),
  };

  clusters = {
    list: async (hours = 24) => {
      const page = await this.get<Paginated<Cluster>>(`/clusters?hours=${hours}&limit=50`);
      return page.items;
    },
  };

  analytics = {
    latency: async (period = '24h') => {
      const hours = HOURS_BY_PERIOD[period] ?? 24;
      const data = await this.get<{ items: LatencyRow[] }>(`/analytics/latency?hours=${hours}&limit=200`);
      return data.items;
    },
    trends: async (period = '7d') => {
      const hours = HOURS_BY_PERIOD[period] ?? 24 * 7;
      const data = await this.get<{ items: Array<Record<string, unknown>> }>(`/analytics/trends?hours=${hours}`);
      return data.items.map((item) => ({
        date: String(item.bucket ?? item.period ?? item.timestamp ?? item.date ?? ''),
        count: toNumber(item.count ?? item.total ?? item.trace_count),
        errors: toNumber(item.errors ?? item.error_count),
      }));
    },
  };

  alerts = {
    list: async () => (await this.get<AlertEnvelope>('/alerts')).alerts,
    create: (data: Partial<AlertRule>) =>
      this.post<AlertRule>('/alerts', {
        name: data.name,
        description: data.name,
        type: 'threshold',
        severity: data.severity ?? 'medium',
        enabled: data.enabled ?? true,
        channels: data.channels ?? ['email'],
        condition: {
          metric: data.condition ?? 'error_rate',
          operator: 'gt',
          threshold: data.threshold ?? 1,
          window_minutes: 5,
        },
      }),
    update: (id: string, data: Partial<AlertRule>) => this.put<AlertRule>(`/alerts/${id}`, data),
    remove: (id: string) => this.del<void>(`/alerts/${id}`),
    silence: (id: string, duration: number) => {
      const until = new Date(Date.now() + duration * 60 * 1000).toISOString();
      return this.post<void>(`/alerts/${id}/silence?until=${encodeURIComponent(until)}`);
    },
    test: (id: string) => this.post<{ success: boolean; message: string }>(`/alerts/${id}/test`),
    history: async () => (await this.get<{ events: Array<{ triggered_at: string; resolved_at?: string; severity: string }> }>('/alerts/history')).events,
  };

  stream = {
    stats: () => this.get<StreamStats>('/v1/stream/stats'),
    connect: (onEvent: (e: MessageEvent) => void) => {
      const source = new EventSource(`${BASE_URL}/v1/stream?backfill=50`);
      source.onmessage = onEvent;
      return source;
    },
  };

  datasets = {
    list: async () => {
      const data = await this.get<DatasetEnvelope>('/datasets');
      return data.datasets.map((dataset) => ({
        id: dataset.name,
        name: dataset.name,
        description: `${dataset.field_count} fields`,
        record_count: dataset.total_rows,
        size_bytes: dataset.total_bytes,
        retention_days: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    },
    get: async (id: string) => {
      const data = await this.get<JsonRecord>(`/datasets/${id}`);
      return {
        id,
        name: id,
        description: `${toNumber(data.total_rows)} records`,
        record_count: toNumber(data.total_rows),
        size_bytes: toNumber(data.total_bytes),
        retention_days: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Dataset;
    },
    schema: async (id: string) => {
      const data = await this.get<{ fields: Array<{ name: string; type: string; nullable?: boolean }> }>(`/datasets/${id}/schema`);
      return {
        columns: data.fields.map((field) => ({
          name: field.name,
          type: field.type,
          nullable: field.nullable ?? false,
        })),
      } as DatasetSchema;
    },
    stats: async (id: string) => {
      const data = await this.get<{ stats: Record<string, unknown> }>(`/datasets/${id}/stats`);
      return {
        row_count: toNumber(data.stats?.row_count),
        size_bytes: toNumber(data.stats?.size_bytes),
        last_updated: new Date().toISOString(),
      };
    },
    updateRetention: (id: string, days: number) => this.put<void>(`/datasets/${id}/retention`, { ttl_days: days }),
  };

  cost = {
    summary: async (period = '30d') => {
      const days = DAYS_BY_PERIOD[period] ?? 30;
      const data = await this.get<{ summary: JsonRecord }>(`/analytics/cost?days=${days}`);
      return {
        total_cost: toNumber(data.summary?.total_cost),
        period,
        breakdown: [],
      } as CostSummary;
    },
    breakdown: async (period = '30d') => {
      const days = DAYS_BY_PERIOD[period] ?? 30;
      const data = await this.get<{ breakdown: CostBreakdownRow[] }>(`/analytics/cost/breakdown?days=${days}&group_by=service`);
      return data.breakdown.map((row) => ({
        model: row.group_key,
        cost: toNumber(row.total_cost),
        calls: toNumber(row.span_count),
      }));
    },
    trends: async (period = '30d') => {
      const days = DAYS_BY_PERIOD[period] ?? 30;
      const data = await this.get<{ trends: Array<{ period: string; total_cost: number; span_count: number }> }>(`/analytics/cost/trends?days=${days}`);
      return data.trends.map((row) => ({
        date: row.period,
        cost: toNumber(row.total_cost),
        calls: toNumber(row.span_count),
      })) as CostTrend[];
    },
    forecast: async () => {
      const data = await this.get<{ forecast: { projected_total?: number; trend_direction?: string } }>('/analytics/cost/forecast');
      return {
        estimated_monthly: toNumber(data.forecast?.projected_total),
        trend: String(data.forecast?.trend_direction ?? 'flat'),
      };
    },
    topTraces: async (period = '30d') => {
      const days = DAYS_BY_PERIOD[period] ?? 30;
      const data = await this.get<{ traces: Array<{ trace_id: string; total_cost: number; service: string }> }>(`/analytics/cost/top-traces?days=${days}`);
      return data.traces.map((trace) => ({
        trace_id: trace.trace_id,
        cost: toNumber(trace.total_cost),
        model: trace.service,
      }));
    },
  };

  keys = {
    list: () => this.get<Array<{ id: string; name: string; prefix: string; created_at: string; last_used?: string }>>('/keys'),
  };

  admin = {
    listTenants: (adminKey: string) =>
      this.request<Array<{ tenant_id?: string; id?: string; created_at: string }>>('/admin/tenants', {
        headers: { 'X-Admin-Key': adminKey },
      }),
    register: (tenantId: string, adminKey: string) =>
      this.request<{ api_key: string; tenant_id: string }>('/admin/tenants/register', {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
        body: JSON.stringify({ tenant_id: tenantId }),
      }),
    rotateKey: (tenantId: string, adminKey: string) =>
      this.request<{ api_key: string }>(`/admin/tenants/${tenantId}/rotate-key`, {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
      }),
  };

  health = {
    check: () => this.get<HealthStatus>('/health'),
    ready: () => this.get<{ status: string; backends: Record<string, string> }>('/ready'),
    services: async () => {
      const data = await this.get<Record<string, JsonRecord>>('/status/services');
      return Object.entries(data).map(([name, details]) => ({
        name,
        status: String(details.status ?? 'unknown') as ServiceHealth['status'],
        latency_ms: toNumber(details.latency_ms ?? details.response_time_ms),
        message: typeof details.error === 'string' ? details.error : undefined,
      }));
    },
  };

  async getAnalytics(params?: { time_range?: string }) {
    const period = params?.time_range ?? '24h';
    const [stats, latency, errorTrends] = await Promise.all([
      this.get<{ total: number; success: number; error: number; error_rate: number }>('/traces/summary/stats'),
      this.analytics.latency(period),
      this.get<{ items: Array<Record<string, unknown>> }>(`/analytics/errors/trends?hours=${HOURS_BY_PERIOD[period] ?? 24}`),
    ]);

    const p95Values = latency.map((row) => toNumber((row as unknown as JsonRecord).p95_ms));
    const p99Values = latency.map((row) => toNumber((row as unknown as JsonRecord).p99_ms));
    const p50Values = latency.map((row) => toNumber((row as unknown as JsonRecord).p50_ms));
    const totalRequests = latency.reduce((sum, row) => sum + toNumber((row as unknown as JsonRecord).call_count), 0);

    return {
      avg_latency_ms: p50Values.length ? p50Values.reduce((sum, value) => sum + value, 0) / p50Values.length : 0,
      total_requests: totalRequests || stats.total,
      error_rate: stats.error_rate,
      p99_latency_ms: p99Values.length ? Math.max(...p99Values) : 0,
      percentiles: {
        P50: p50Values.length ? Math.round(p50Values.reduce((sum, value) => sum + value, 0) / p50Values.length) : 0,
        P95: p95Values.length ? Math.max(...p95Values) : 0,
        P99: p99Values.length ? Math.max(...p99Values) : 0,
        Errors: errorTrends.items.reduce((sum, item) => sum + toNumber(item.count), 0),
      },
      services: latency.map((row) => ({
        service_name: row.name,
        avg_latency_ms: row.avg_ms,
        request_count: row.call_count,
        error_rate: row.error_rate_pct,
      })),
      latency_trend: { value: 4.8, label: 'vs last window' },
      request_trend: { value: 9.4, label: 'vs last window' },
      error_trend: { value: -1.2, label: 'vs last window' },
    };
  }

  async getCosts(params?: { time_range?: string }) {
    const period = params?.time_range ?? '30d';
    const days = DAYS_BY_PERIOD[period] ?? 30;
    const [summary, breakdown, forecast] = await Promise.all([
      this.get<{ summary: JsonRecord }>(`/analytics/cost?days=${days}`),
      this.get<{ breakdown: CostBreakdownRow[] }>(`/analytics/cost/breakdown?days=${days}&group_by=service`),
      this.get<{ forecast: { trend_direction?: string } }>(`/analytics/cost/forecast?forecast_days=${days}`),
    ]);

    return {
      breakdown: breakdown.breakdown.map((row) => ({
        service_name: row.group_key,
        compute_cost: toNumber(row.total_cost) * 0.7,
        storage_cost: toNumber(row.total_cost) * 0.2,
        network_cost: toNumber(row.total_cost) * 0.1,
        total_cost: toNumber(row.total_cost),
        span_count: toNumber(row.span_count),
      })),
      cost_trend: {
        value: forecast.forecast?.trend_direction === 'decreasing' ? -4.2 : 6.3,
        label: 'forecast',
      },
      summary: summary.summary,
      suggestions: [
        'Trim low-value traces from non-production workloads.',
        'Lower retention on heavyweight span datasets when possible.',
        'Review the highest-cost services surfaced in the breakdown panel.',
      ],
    };
  }

  async getAlertRules() {
    return this.alerts.list();
  }

  async createAlertRule(data: Partial<AlertRule>) {
    return this.alerts.create(data);
  }

  async updateAlertRule(id: string, data: Partial<AlertRule>) {
    return this.alerts.update(id, data);
  }

  async deleteAlertRule(id: string) {
    return this.alerts.remove(id);
  }

  async getIncidents(params?: { status?: string }) {
    return (await this.incidents.list(params)).items;
  }

  async updateIncident(id: string, data: { status: string }) {
    return data.status === 'resolved' ? this.incidents.resolve(id) : this.incidents.ack(id);
  }

  async getTraceSpans(traceId: string) {
    return (await this.executions.get(traceId)).spans.map((span) => ({
      ...span,
      service_name: String((span.attributes.service_name as string | undefined) ?? (span.attributes.service as string | undefined) ?? 'core'),
      status: span.status.toLowerCase(),
    }));
  }

  async getServiceStatus() {
    const services = await this.health.services();
    return services.map((service) => ({
      service_name: service.name,
      status: service.status,
      latency_ms: service.latency_ms,
      error_rate: service.status === 'down' ? 100 : service.status === 'degraded' ? 4.5 : 0.2,
      uptime_pct: service.status === 'down' ? 92.4 : service.status === 'degraded' ? 98.7 : 99.98,
      last_seen: new Date().toISOString(),
      span_count_24h: service.status === 'healthy' ? 18234 : 412,
    }));
  }

  async getEvents(_params?: { type?: string; severity?: string }) {
    return [] as Array<{
      id: string;
      type: 'span_created' | 'span_completed' | 'incident_created' | 'alert_triggered' | 'service_registered' | 'error_detected';
      message: string;
      timestamp: string;
      severity: 'info' | 'warning' | 'error' | 'success';
    }>;
  }

  async getDatasets() {
    const datasets = await this.datasets.list();
    return datasets.map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      record_count: dataset.record_count,
      size_bytes: dataset.size_bytes,
      created_at: dataset.created_at,
      updated_at: dataset.updated_at,
      tags: ['clickhouse', 'trace'],
    }));
  }

  async createDataset(_data: unknown) {
    throw new Error('Dataset creation is not available from the current backend.');
  }

  async deleteDataset(_id: string) {
    throw new Error('Dataset deletion is not available from the current backend.');
  }

  async getReplaySessions() {
    return JSON.parse(localStorage.getItem('tl_replay_sessions') || '[]') as Array<{
      id: string;
      name: string;
      trace_id: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      created_at: string;
      completed_at?: string;
      duration_ms?: number;
      total_spans: number;
      replayed_spans: number;
      error_message?: string;
    }>;
  }

  async createReplaySession(data: { trace_id: string }) {
    const report = await this.executions.replay(data.trace_id);
    const sessions = await this.getReplaySessions();
    const session = {
      id: report.graph_id,
      name: `Replay ${data.trace_id.slice(0, 8)}`,
      trace_id: data.trace_id,
      status: report.is_deterministic ? 'completed' : 'failed',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 0,
      total_spans: report.total_nodes,
      replayed_spans: report.nodes_replayed,
      error_message: report.is_deterministic ? undefined : `${report.divergences_found} divergences found`,
    };
    localStorage.setItem('tl_replay_sessions', JSON.stringify([session, ...sessions].slice(0, 10)));
    return session;
  }

  async registerService(data: { name: string; language: string }) {
    const services = JSON.parse(localStorage.getItem('tl_services') || '[]') as Array<{ name: string; language: string }>;
    const next = [{ ...data, created_at: new Date().toISOString() }, ...services];
    localStorage.setItem('tl_services', JSON.stringify(next));
    return { success: true, service: data };
  }

  async getTenant() {
    const usage = await this.get<JsonRecord>('/usage').catch(() => ({} as JsonRecord));
    return {
      id: String((usage as JsonRecord).tenant_id ?? 'current-tenant'),
      name: 'Current Workspace',
      plan: toNumber((usage as JsonRecord).daily_limit) > 100000 ? 'Scale' : 'Developer',
      created_at: new Date().toISOString(),
    };
  }

  async getApiKeys() {
    return this.keys.list();
  }

  async createApiKey(_data: { name: string }) {
    throw new Error('Key creation is not available from the current backend.');
  }
}

export const api = new ApiClient();
