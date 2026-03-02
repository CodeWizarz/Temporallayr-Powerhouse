import { startTrace, startSpan, endSpan, recordEvent, setGlobalClient, traceStorage } from '../src/tracer';
import { TemporalLayrClient } from '../src/client';
import { AsyncHTTPTransport } from '../src/transport';

jest.mock('../src/transport');

describe('Tracer', () => {
    let mockClient: TemporalLayrClient;
    let mockTransport: jest.Mocked<AsyncHTTPTransport>;

    beforeEach(() => {
        mockTransport = new AsyncHTTPTransport({ apiKey: 'test' }) as jest.Mocked<AsyncHTTPTransport>;
        mockTransport.record = jest.fn();

        mockClient = {
            getTenantId: () => 'test-tenant',
            getTransport: () => mockTransport
        } as unknown as TemporalLayrClient;

        setGlobalClient(mockClient);
    });

    afterEach(() => {
        setGlobalClient(null as any);
        jest.clearAllMocks();
    });

    test('startTrace captures function execution and records perfectly', async () => {
        const result = await startTrace('testTrace', async () => {
            return 'traced';
        });

        expect(result).toBe('traced');
        expect(mockTransport.record).toHaveBeenCalledTimes(1);

        const recordedTrace = mockTransport.record.mock.calls[0][0];
        expect(recordedTrace.tenant_id).toBe('test-tenant');
        expect(recordedTrace.spans.length).toBe(0);
        expect(recordedTrace.start_time).toBeDefined();
        expect(recordedTrace.end_time).toBeDefined();
        expect(new Date(recordedTrace.start_time).getTime()).toBeLessThanOrEqual(new Date(recordedTrace.end_time!).getTime());
    });

    test('startSpan seamlessly propagates Context bindings inside trace runs', async () => {
        await startTrace('parentTrace', async () => {
            await startSpan('childSpan', { customAttr: 'value' }, async () => {
                const context = traceStorage.getStore();
                expect(context).toBeDefined();
                expect(context?.currentSpanId).toBeDefined();
            });
        });

        expect(mockTransport.record).toHaveBeenCalledTimes(1);
        const trace = mockTransport.record.mock.calls[0][0];
        expect(trace.spans.length).toBe(1);

        const span = trace.spans[0];
        expect(span.name).toBe('childSpan');
        expect(span.attributes).toEqual({ customAttr: 'value' });
        expect(span.end_time).toBeDefined();
        expect(span.status).toBe('success');
    });

    test('startSpan handles errors gracefully recording trace context faults', async () => {
        try {
            await startTrace('root', async () => {
                await startSpan('faultySpan', {}, async () => {
                    throw new Error('Test fault');
                });
            });
        } catch (e) {
            // Expected
        }

        expect(mockTransport.record).toHaveBeenCalledTimes(1);
        const trace = mockTransport.record.mock.calls[0][0];
        expect(trace.spans.length).toBe(1);

        const span = trace.spans[0];
        expect(span.status).toBe('error');
        expect(span.error).toBe('Test fault');
        expect(span.end_time).toBeDefined();
    });

    test('recordEvent and endSpan API works seamlessly applying manual context boundaries', async () => {
        await startTrace('trace', async () => {
            await startSpan('manualSpan', {}, async () => {
                const context = traceStorage.getStore();

                recordEvent('userAction', { click: true });
                endSpan(context!.currentSpanId!, { done: true });

                const span = context!.trace.spans[0];
                expect(span.attributes['userAction']).toEqual({ click: true });
                expect(span.output_payload).toEqual({ done: true });
                expect(span.end_time).toBeDefined();
            });
        });
    });
});
