import * as https from 'node:https';
import { AsyncHTTPTransport } from '../src/transport';
import { Trace } from '../src/types';
import { EventEmitter } from 'node:events';

jest.mock('node:https', () => ({
    request: jest.fn()
}));

describe('AsyncHTTPTransport', () => {

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    const generateTrace = (id: string): Trace => ({
        trace_id: id,
        tenant_id: 'default',
        start_time: '2026-01-01T00:00:00Z',
        end_time: null,
        spans: []
    });

    test('batches traces up to maxBatchSize automatically dropping overflow', async () => {
        const transport = new AsyncHTTPTransport({
            apiKey: 'test-key',
            url: 'https://test/v1/ingest',
            maxBatchSize: 2,
            maxQueueSize: 3,
            flushIntervalMs: 1000
        });

        transport.record(generateTrace('1'));
        transport.record(generateTrace('2'));
        transport.record(generateTrace('3'));
        transport.record(generateTrace('4')); // Should drop newest correctly

        (https.request as jest.Mock).mockImplementation((url: any, options: any, callback: any) => {
            callback({ statusCode: 200 });
            const req = new EventEmitter() as any;
            req.write = jest.fn();
            req.end = jest.fn();
            return req;
        });

        // Force flush
        await transport.flush();

        expect(https.request).toHaveBeenCalledTimes(1);

        // First batch should be 2 items
        const reqInstance = (https.request as jest.Mock).mock.results[0].value;
        const requestBodyStr = reqInstance.write.mock.calls[0][0];
        const requestBody = JSON.parse(requestBodyStr);
        expect(requestBody.events.length).toBe(2);
        expect(requestBody.events[0].trace_id).toBe('1');
        expect(requestBody.events[1].trace_id).toBe('2');

        // Flush remaining
        await transport.flush();
        expect(https.request).toHaveBeenCalledTimes(2);

        const reqInstance2 = (https.request as jest.Mock).mock.results[1].value;
        const requestBodyStr2 = reqInstance2.write.mock.calls[0][0];
        const requestBody2 = JSON.parse(requestBodyStr2);
        expect(requestBody2.events.length).toBe(1);
        expect(requestBody2.events[0].trace_id).toBe('3');
    });

    test('exponential backoff retries API seamlessly over network faults', async () => {
        const transport = new AsyncHTTPTransport({
            apiKey: 'test-key',
            url: 'https://test',
            maxBatchSize: 10
        });

        let calls = 0;
        (https.request as jest.Mock).mockImplementation((url: any, options: any, callback: any) => {
            calls++;
            const req = new EventEmitter() as any;
            req.write = jest.fn();
            req.end = jest.fn();

            if (calls < 3) {
                setTimeout(() => req.emit('error', new Error(`Network fault ${calls}`)), 0);
            } else {
                setTimeout(() => callback({ statusCode: 200 }), 0);
            }
            return req;
        });

        transport.record(generateTrace('1'));

        const flushPromise = transport.flush();

        // Advance timers to resolve exponential backoff setTimeouts and network fault setTimeouts
        await jest.runAllTimersAsync();
        await flushPromise;

        expect(https.request).toHaveBeenCalledTimes(3);
    });
});
