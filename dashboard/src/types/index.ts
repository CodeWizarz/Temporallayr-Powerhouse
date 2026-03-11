/* ───────── Core Domain Types ───────── */

export interface Span {
  span_id: string;
  parent_span_id: string | null;
  name: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  status: 'OK' | 'ERROR' | 'TIMEOUT';
  error: string | null;
  attributes: Record<string, unknown>;
  service_name?: string;
}

export interface Trace {
  trace_id: string;
  tenant_id: string;
  start_time: string;
  end_time: string;
  spans: Span[];
}

export interface TraceRow {
  id: string;
  status: string;
  tenant_id: string;
  span_count: number;
  error_count: number;
  duration_ms: number;
  created_at: string;
}

export interface Incident {
  incident_id: string;
  tenant_id: string;
  cluster_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'acknowledged' | 'resolved';
  count: number;
  first_seen: string;
  last_seen: string;
  failing_node: string;
  error_type?: string;
  message?: string;
}

export interface Cluster {
  cluster_id: string;
  fingerprint: string;
  failing_node: string;
  error_type: string;
  count: number;
  executions: string[];
}

export interface LatencyRow {
  name: string;
  call_count: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  avg_ms: number;
  error_count: number;
  error_rate_pct: number;
}

export interface ReplayResult {
  node_name: string;
  original: string;
  replayed: string;
  match: boolean;
}

export interface ReplayReport {
  graph_id: string;
  total_nodes: number;
  nodes_replayed: number;
  divergences_found: number;
  is_deterministic: boolean;
  results: ReplayResult[];
}

export interface DiffReport {
  trace_a: string;
  trace_b: string;
  structural_match: boolean;
  divergences: Array<{
    node: string;
    field: string;
    value_a: string;
    value_b: string;
  }>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  channels: string[];
  created_at: string;
  last_triggered?: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  record_count: number;
  size_bytes: number;
  retention_days: number;
  created_at: string;
  updated_at: string;
}

export interface DatasetSchema {
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
}

export interface CostSummary {
  total_cost: number;
  period: string;
  breakdown: Array<{
    model: string;
    cost: number;
    calls: number;
  }>;
}

export interface CostTrend {
  date: string;
  cost: number;
  calls: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  uptime_seconds: number;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency_ms: number;
  message?: string;
}

export interface StreamEvent {
  id: string;
  type: string;
  tenant_id: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface StreamStats {
  events_per_second: number;
  total_events: number;
  active_connections: number;
}

/* ───────── API Types ───────── */

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ApiError {
  detail: string;
  status: number;
}

/* ───────── Component Types ───────── */

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';
export type SpanStatus = 'OK' | 'ERROR' | 'TIMEOUT';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: number;
}

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

/* ───────── Span Tree ───────── */

export interface SpanNode extends Span {
  children: SpanNode[];
  depth: number;
}

/* ───────── Dataset Field Types ───────── */

export interface DatasetField {
  name: string;
  type: string;
  description?: string;
}

/* ───────── API Key Types ───────── */

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  scopes: string[];
}

/* ───────── Cost Tracking Types ───────── */

export interface CostBreakdownItem {
  name: string;
  cost: number;
  percentage: number;
  trend: number;
}

export interface CostBreakdown {
  items: CostBreakdownItem[];
  total: number;
}

export interface CostForecast {
  projected_cost: number;
  confidence_low: number;
  confidence_high: number;
  trend: number;
  data: Array<{ date: string; actual?: number; projected?: number }>;
}
