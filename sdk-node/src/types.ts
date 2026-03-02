export interface Span {
    span_id: string;
    parent_span_id: string | null;
    name: string;
    start_time: string; // ISO 8601
    end_time: string | null;
    attributes: Record<string, any>;
    input_payload: any | null;
    output_payload: any | null;
    error: string | null;
    status: 'success' | 'error';
}

export interface Trace {
    trace_id: string;
    tenant_id: string;
    start_time: string; // ISO 8601
    end_time: string | null;
    spans: Span[];
}

export interface Config {
    apiKey: string;
    url?: string;
    tenantId?: string; // Optional, resolved by token implicitly unless overriding
    flushIntervalMs?: number;
    maxBatchSize?: number;
    maxQueueSize?: number;
}
