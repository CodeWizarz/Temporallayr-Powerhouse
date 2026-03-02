import { Config } from './types';
import { AsyncHTTPTransport } from './transport';
import { setGlobalClient } from './tracer';

export class TemporalLayrClient {
    private config: Config;
    private transport: AsyncHTTPTransport;

    constructor(config: Config) {
        this.config = config;
        this.transport = new AsyncHTTPTransport(config);
        setGlobalClient(this);
    }

    start() {
        this.transport.start();
    }

    async shutdown() {
        await this.transport.shutdown();
    }

    getTransport(): AsyncHTTPTransport {
        return this.transport;
    }

    getTenantId(): string {
        return this.config.tenantId || 'default';
    }
}
