import { TemporalLayrClient } from '../src/client';
import { Tracer } from '../src/tracer';
import { ExecutionGraph } from '../src/types';

jest.mock('../src/uuid', () => ({
    v4: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
}));

describe('TemporalLayrClient', () => {
    let client: TemporalLayrClient;
    const mockFetch = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = mockFetch;
        client = new TemporalLayrClient({
            apiKey: 'test-key',
            serverUrl: 'http://localhost:8000',
            tenantId: 'test-tenant',
            batchSize: 10,
            flushIntervalMs: 100,
            maxRetries: 3,
            debug: false,
        });
    });

    afterEach(async () => {
        if (client) {
            try {
                await client.shutdown();
            } catch {
                // Ignore shutdown errors in tests
            }
        }
    });

    test('enqueue adds graph to queue', () => {
        const graph: ExecutionGraph = {
            id: 'trace-1',
            tenant_id: 'test-tenant',
            start_time: new Date().toISOString(),
            end_time: null,
            spans: [],
        };

        client.enqueue(graph);
        expect((client as any).queue.length).toBe(1);
    });

    test('flush sends batch when batchSize reached', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 202, text: async () => 'OK' });

        const graphs: ExecutionGraph[] = Array.from({ length: 10 }, (_, i) => ({
            id: `trace-${i}`,
            tenant_id: 'test-tenant',
            start_time: new Date().toISOString(),
            end_time: null,
            spans: [],
        }));

        graphs.forEach(g => client.enqueue(g));

        await new Promise(r => setTimeout(r, 50));

        expect(mockFetch).toHaveBeenCalled();
        const callArgs = mockFetch.mock.calls[0];
        expect(callArgs[0]).toBe('http://localhost:8000/v1/ingest');
    });

    test('shutdown flushes remaining queue', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 202, text: async () => 'OK' });

        const graph: ExecutionGraph = {
            id: 'trace-1',
            tenant_id: 'test-tenant',
            start_time: new Date().toISOString(),
            end_time: null,
            spans: [],
        };

        client.enqueue(graph);
        await client.shutdown();

        expect(mockFetch).toHaveBeenCalled();
    });
});

describe('Tracer', () => {
    let client: TemporalLayrClient;
    let tracer: Tracer;
    const mockFetch = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = mockFetch;
        client = new TemporalLayrClient({
            apiKey: 'test-key',
            serverUrl: 'http://localhost:8000',
            tenantId: 'test-tenant',
            batchSize: 100,
            flushIntervalMs: 10000,
            debug: false,
        });
        tracer = new Tracer(client);
    });

    afterEach(async () => {
        if (client) {
            try {
                await client.shutdown();
            } catch {
                // Ignore shutdown errors in tests
            }
        }
    });

    test('trace creates execution graph with spans', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 202, text: async () => 'OK' });

        const result = await tracer.trace('test-trace', async () => {
            return 'test-result';
        });

        expect(result.result).toBe('test-result');
        expect(result.traceId).toBeDefined();
        expect(result.spans).toHaveLength(0);
        
        // Verify graph was enqueued
        const queue = (client as any).queue;
        expect(queue.length).toBe(1);
        expect(queue[0].id).toBe(result.traceId);
    });

    test('run wraps function and captures span', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 202, text: async () => 'OK' });

        const result = await tracer.trace('outer-trace', async (t) => {
            return t.run('inner-span', async () => {
                await new Promise(r => setTimeout(r, 10));
                return 'inner-result';
            });
        });

        expect(result.result).toBe('inner-result');
        expect(result.spans).toHaveLength(1);
        expect(result.spans[0].name).toBe('inner-span');
        expect(result.spans[0].status).toBe('success');
    });

    test('llm captures tokens and cost', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 202, text: async () => 'OK' });

        const mockLLMResponse = {
            output: 'LLM response',
            model: 'gpt-4o',
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
        };

        const result = await tracer.trace('llm-trace', async (t) => {
            return t.llm('risk-model', async () => mockLLMResponse);
        });

        expect(result.spans).toHaveLength(1);
        expect(result.spans[0].name).toBe('llm:gpt-4o');
        expect(result.spans[0].attributes['llm.model_name']).toBe('gpt-4o');
        expect(result.spans[0].attributes['llm.token_count.total']).toBe(150);
    });

    test('tool captures tool name and inputs', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 202, text: async () => 'OK' });

        const result = await tracer.trace('tool-trace', async (t) => {
            return t.tool('fetchUser', async () => ({ id: 1, name: 'John' }), {
                description: 'Fetch user by ID',
                inputs: { userId: 123 },
            });
        });

        expect(result.spans).toHaveLength(1);
        expect(result.spans[0].name).toBe('tool:fetchUser');
        expect(result.spans[0].attributes['tool.name']).toBe('fetchUser');
        expect(result.spans[0].attributes['tool.description']).toBe('Fetch user by ID');
    });
});
