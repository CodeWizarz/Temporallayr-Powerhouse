export interface Span {
    span_id: string;
    parent_span_id: string | null;
    name: string;
    start_time: string;  // ISO-8601
    end_time: string | null;
    duration_ms: number | null;
    status: 'success' | 'error';
    error: string | null;
    attributes: Record<string, unknown>;
}

export interface ExecutionGraph {
    id: string;
    tenant_id: string;
    start_time: string;
    end_time: string | null;
    spans: Span[];
}

export interface LLMResult {
    output: unknown;
    model?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
}

export interface TemporalLayrConfig {
    apiKey: string;
    serverUrl: string;
    tenantId: string;
    batchSize?: number;       // default 50
    flushIntervalMs?: number; // default 2000
    maxRetries?: number;      // default 3
    debug?: boolean;
}

export interface TraceContext {
    traceId: string;
    spans: Span[];
    startTime: Date;
}
