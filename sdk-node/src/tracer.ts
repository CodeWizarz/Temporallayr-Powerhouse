import { AsyncLocalStorage } from 'async_hooks';
import { Span, ExecutionGraph, LLMResult } from './types';
import { TemporalLayrClient } from './client';
import { v4 as uuidv4 } from './uuid';

// LLM pricing table (per 1M tokens, USD)
const LLM_PRICING: Record<string, [number, number]> = {
    'gpt-4o': [2.5, 10.0],
    'gpt-4o-mini': [0.15, 0.6],
    'gpt-4-turbo': [10.0, 30.0],
    'claude-opus-4-6': [15.0, 75.0],
    'claude-sonnet-4-6': [3.0, 15.0],
    'claude-haiku-4-5': [0.8, 4.0],
    'gemini-1.5-pro': [1.25, 5.0],
    'gemini-1.5-flash': [0.075, 0.3],
};

function computeCost(model: string, prompt: number, completion: number): number | null {
    for (const [key, [inRate, outRate]] of Object.entries(LLM_PRICING)) {
        if (model.toLowerCase().includes(key)) {
            return (prompt * inRate + completion * outRate) / 1_000_000;
        }
    }
    return null;
}

interface TraceContext {
    graph: ExecutionGraph;
    parentSpanId: string | null;
}

const _store = new AsyncLocalStorage<TraceContext>();

export class Tracer {
    private client: TemporalLayrClient;

    constructor(client: TemporalLayrClient) {
        this.client = client;
    }

    /** Run a function inside a new trace context. Auto-flushes on completion. */
    async trace<T>(
        name: string,
        fn: (tracer: Tracer) => Promise<T>,
        tenantId?: string
    ): Promise<{ result: T; traceId: string; spans: Span[] }> {
        const graph: ExecutionGraph = {
            id: uuidv4(),
            tenant_id: tenantId ?? 'default',
            start_time: new Date().toISOString(),
            end_time: null,
            spans: [],
        };

        const ctx: TraceContext = { graph, parentSpanId: null };

        let result: T;
        const t0 = Date.now();

        result = await _store.run(ctx, () => fn(this));

        graph.end_time = new Date().toISOString();
        this.client.enqueue(graph);

        return { result: result!, traceId: graph.id, spans: graph.spans };
    }

    /** Wrap an arbitrary async function — captures timing, error, output. */
    async run<T>(name: string, fn: () => Promise<T>): Promise<T> {
        const ctx = _store.getStore();
        const spanId = uuidv4();
        const parentSpanId = ctx?.parentSpanId ?? null;
        const t0 = Date.now();
        let status: 'success' | 'error' = 'success';
        let errorMsg: string | null = null;
        let result: T;

        // Set this span as parent for nested calls
        const childCtx: TraceContext | undefined = ctx
            ? { graph: ctx.graph, parentSpanId: spanId }
            : undefined;

        try {
            if (childCtx) {
                result = await _store.run(childCtx, fn);
            } else {
                result = await fn();
            }
            return result!;
        } catch (err) {
            status = 'error';
            errorMsg = err instanceof Error ? err.message : String(err);
            throw err;
        } finally {
            const duration_ms = Date.now() - t0;
            const span: Span = {
                span_id: spanId,
                parent_span_id: parentSpanId,
                name,
                start_time: new Date(t0).toISOString(),
                end_time: new Date().toISOString(),
                duration_ms,
                status,
                error: errorMsg,
                attributes: { duration_ms },
            };
            ctx?.graph.spans.push(span);
        }
    }

    /** Wrap an LLM call — captures tokens, model, cost. */
    async llm<T extends LLMResult>(
        name: string,
        fn: () => Promise<T>
    ): Promise<T> {
        const ctx = _store.getStore();
        const spanId = uuidv4();
        const parentSpanId = ctx?.parentSpanId ?? null;
        const t0 = Date.now();
        let status: 'success' | 'error' = 'success';
        let errorMsg: string | null = null;
        let result: T;

        try {
            result = await fn();
            return result!;
        } catch (err) {
            status = 'error';
            errorMsg = err instanceof Error ? err.message : String(err);
            throw err;
        } finally {
            const duration_ms = Date.now() - t0;
            const model = (result! as any)?.model ?? 'unknown';
            const promptTokens = (result! as any)?.prompt_tokens ?? 0;
            const completionTokens = (result! as any)?.completion_tokens ?? 0;
            const totalTokens = (result! as any)?.total_tokens ?? (promptTokens + completionTokens);
            const cost = computeCost(model, promptTokens, completionTokens);

            const attrs: Record<string, unknown> = {
                'openinference.span.kind': 'LLM',
                'llm.model_name': model,
                duration_ms,
            };
            if (totalTokens > 0) {
                attrs['llm.token_count.prompt'] = promptTokens;
                attrs['llm.token_count.completion'] = completionTokens;
                attrs['llm.token_count.total'] = totalTokens;
            }
            if (cost !== null) attrs['cost_usd'] = cost;

            const span: Span = {
                span_id: spanId,
                parent_span_id: parentSpanId,
                name: `llm:${model}`,
                start_time: new Date(t0).toISOString(),
                end_time: new Date().toISOString(),
                duration_ms,
                status,
                error: errorMsg,
                attributes: attrs,
            };
            ctx?.graph.spans.push(span);
        }
    }

    /** Wrap a tool call — captures tool name, inputs, output. */
    async tool<T>(
        toolName: string,
        fn: () => Promise<T>,
        opts?: { description?: string; inputs?: unknown }
    ): Promise<T> {
        const ctx = _store.getStore();
        const spanId = uuidv4();
        const parentSpanId = ctx?.parentSpanId ?? null;
        const t0 = Date.now();
        let status: 'success' | 'error' = 'success';
        let errorMsg: string | null = null;
        let result: T;

        try {
            result = await fn();
            return result!;
        } catch (err) {
            status = 'error';
            errorMsg = err instanceof Error ? err.message : String(err);
            throw err;
        } finally {
            const duration_ms = Date.now() - t0;
            const span: Span = {
                span_id: spanId,
                parent_span_id: parentSpanId,
                name: `tool:${toolName}`,
                start_time: new Date(t0).toISOString(),
                end_time: new Date().toISOString(),
                duration_ms,
                status,
                error: errorMsg,
                attributes: {
                    'openinference.span.kind': 'TOOL',
                    'tool.name': toolName,
                    'tool.description': opts?.description ?? '',
                    duration_ms,
                    ...(opts?.inputs !== undefined && { inputs: opts.inputs }),
                    ...(result !== undefined && { output: result }),
                },
            };
            ctx?.graph.spans.push(span);
        }
    }
}
