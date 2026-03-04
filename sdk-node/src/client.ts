import { ExecutionGraph, TemporalLayrConfig } from './types';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class TemporalLayrClient {
    private config: Required<TemporalLayrConfig>;
    private queue: ExecutionGraph[] = [];
    private flushTimer: ReturnType<typeof setInterval> | null = null;

    constructor(config: TemporalLayrConfig) {
        this.config = {
            batchSize: 50,
            flushIntervalMs: 2000,
            maxRetries: 3,
            debug: false,
            ...config,
        };
        this._startFlushTimer();
    }

    private _log(msg: string, data?: unknown): void {
        if (this.config.debug) {
            console.log(`[TemporalLayr] ${msg}`, data ?? '');
        }
    }

    enqueue(graph: ExecutionGraph): void {
        this.queue.push(graph);
        if (this.queue.length >= this.config.batchSize) {
            void this.flush();
        }
    }

    async flush(): Promise<void> {
        if (this.queue.length === 0) return;
        const batch = this.queue.splice(0, this.config.batchSize);
        this._log(`Flushing ${batch.length} graphs`);
        await this._send(batch);
    }

    private async _send(graphs: ExecutionGraph[], attempt = 1): Promise<void> {
        const url = `${this.config.serverUrl}/v1/ingest`;
        const body = JSON.stringify({ events: graphs });

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'X-Tenant-Id': this.config.tenantId,
                },
                body,
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            }

            this._log(`Flushed ${graphs.length} graphs OK`);
        } catch (err) {
            if (attempt < this.config.maxRetries) {
                const delay = Math.min(1000 * 2 ** attempt, 30000);
                this._log(`Retry ${attempt}/${this.config.maxRetries} in ${delay}ms`, err);
                await sleep(delay);
                return this._send(graphs, attempt + 1);
            }
            // Silently drop after max retries — never crash the host app
            this._log('Max retries exceeded, dropping batch', err);
        }
    }

    private _startFlushTimer(): void {
        this.flushTimer = setInterval(() => {
            void this.flush();
        }, this.config.flushIntervalMs);
        // Don't keep the process alive just for flushing
        if (this.flushTimer.unref) {
            this.flushTimer.unref();
        }
    }

    async shutdown(): Promise<void> {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        await this.flush();
    }
}
