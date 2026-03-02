import * as https from 'node:https';
import * as http from 'node:http';
import { Config, Trace } from './types';

export class AsyncHTTPTransport {
    private queue: Trace[] = [];
    private flushIntervalMs: number;
    private maxBatchSize: number;
    private maxQueueSize: number;
    private flushTimer: NodeJS.Timeout | null = null;
    private apiKey: string;
    private url: string;
    private tenantId?: string;
    private isShuttingDown = false;

    constructor(config: Config) {
        this.apiKey = config.apiKey;
        this.url = config.url || 'http://localhost:8000/v1/ingest';
        this.tenantId = config.tenantId;
        this.flushIntervalMs = config.flushIntervalMs || 1000;
        this.maxBatchSize = config.maxBatchSize || 50;
        this.maxQueueSize = config.maxQueueSize || 2000;
    }

    start() {
        if (this.flushTimer) return;
        this.flushTimer = setInterval(() => {
            this.flush().catch(() => { }); // Suppress background flush errors
        }, this.flushIntervalMs);
    }

    async shutdown() {
        this.isShuttingDown = true;
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        await this.flush();
    }

    record(trace: Trace) {
        if (this.isShuttingDown) return;

        // Drop newest over quota
        if (this.queue.length >= this.maxQueueSize) {
            return;
        }
        this.queue.push(trace);
    }

    async flush() {
        if (this.queue.length === 0) return;

        const batch = this.queue.splice(0, this.maxBatchSize);
        let attempts = 0;
        let delay = 100;

        while (attempts < 3) {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                };

                if (this.tenantId) {
                    headers['X-Tenant-Id'] = this.tenantId;
                }

                const bodyStr = JSON.stringify({ events: batch });
                headers['Content-Length'] = Buffer.byteLength(bodyStr).toString();

                const isHttps = this.url.startsWith('https:');
                const client = isHttps ? https : http;

                const res = await new Promise<{ status?: number; ok: boolean }>((resolve, reject) => {
                    const req = client.request(this.url, {
                        method: 'POST',
                        headers
                    }, (response) => {
                        resolve({
                            status: response.statusCode,
                            ok: response.statusCode ? response.statusCode >= 200 && response.statusCode < 300 : false
                        });
                    });

                    req.on('error', reject);
                    req.write(bodyStr);
                    req.end();
                });

                if (res.ok || res.status === 429 || res.status === 401) {
                    // Success or irrecoverable explicit API fault (e.g., quota or auth), drop batch natively
                    return;
                }
            } catch (err) {
                // Network error, fallthrough to backoff
            }

            attempts++;
            if (attempts < 3) {
                await new Promise(r => setTimeout(r, delay));
                delay *= 2; // Exponential backoff
            }
        }

        // On complete failure, enqueue the batch back if there is room
        if (!this.isShuttingDown) {
            const remainingRoom = this.maxQueueSize - this.queue.length;
            if (remainingRoom > 0) {
                this.queue.unshift(...batch.slice(0, remainingRoom));
            }
        }
    }
}
