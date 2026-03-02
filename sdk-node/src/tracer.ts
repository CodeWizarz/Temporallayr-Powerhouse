import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Span, Trace } from './types';
import { TemporalLayrClient } from './client';

export interface TraceContext {
    trace: Trace;
    currentSpanId: string | null;
}

export const traceStorage = new AsyncLocalStorage<TraceContext>();

let globalClient: TemporalLayrClient | null = null;

export function setGlobalClient(client: TemporalLayrClient) {
    globalClient = client;
}

export function startTrace<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const trace: Trace = {
        trace_id: randomUUID(),
        tenant_id: globalClient?.getTenantId() || 'default',
        start_time: new Date().toISOString(),
        end_time: null,
        spans: [],
    };

    const context: TraceContext = { trace, currentSpanId: null };

    return traceStorage.run(context, async () => {
        try {
            const result = await fn();
            trace.end_time = new Date().toISOString();
            globalClient?.getTransport()?.record(trace);
            return result;
        } catch (err: any) {
            trace.end_time = new Date().toISOString();
            globalClient?.getTransport()?.record(trace);
            throw err;
        }
    });
}

export function startSpan<T>(name: string, attrs: Record<string, any> = {}, fn: () => Promise<T> | T): Promise<T> {
    const context = traceStorage.getStore();
    if (!context) {
        // If no context, just run the function without tracing.
        return Promise.resolve(fn());
    }

    const spanId = randomUUID();
    const parentSpanId = context.currentSpanId;

    const span: Span = {
        span_id: spanId,
        parent_span_id: parentSpanId,
        name,
        start_time: new Date().toISOString(),
        end_time: null,
        attributes: attrs,
        input_payload: null,
        output_payload: null,
        error: null,
        status: 'success',
    };

    context.trace.spans.push(span);

    return traceStorage.run({ ...context, currentSpanId: spanId }, async () => {
        try {
            const result = await fn();
            span.end_time = new Date().toISOString();
            return result;
        } catch (err: any) {
            span.end_time = new Date().toISOString();
            span.status = 'error';
            span.error = err instanceof Error ? err.message : String(err);
            throw err;
        }
    });
}

// Low level API if manual wrapping is preferred
export function recordEvent(name: string, payload: any = null) {
    const context = traceStorage.getStore();
    if (!context || !context.currentSpanId) return;

    const span = context.trace.spans.find(s => s.span_id === context.currentSpanId);
    if (span) {
        span.attributes[name] = payload;
    }
}

export function endSpan(spanId: string, output: any = null) {
    const context = traceStorage.getStore();
    if (!context) return;

    const span = context.trace.spans.find(s => s.span_id === spanId);
    if (span && !span.end_time) {
        span.end_time = new Date().toISOString();
        if (output !== null) {
            span.output_payload = output;
        }
    }
}
