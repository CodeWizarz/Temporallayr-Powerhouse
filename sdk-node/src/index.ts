/**
 * @temporallayr/sdk — TypeScript SDK for TemporalLayr
 *
 * Usage:
 *   import { TemporalLayr } from '@temporallayr/sdk'
 *
 *   const tl = new TemporalLayr({
 *     apiKey: process.env.TEMPORALLAYR_API_KEY!,
 *     serverUrl: process.env.TEMPORALLAYR_SERVER_URL!,
 *     tenantId: process.env.TEMPORALLAYR_TENANT_ID!,
 *   })
 *
 *   const { result, traceId } = await tl.tracer.trace('decision-pipeline', async (t) => {
 *     const user = await t.tool('fetchUser', () => fetchUser(userId))
 *     const decision = await t.llm('risk-model', () => callLLM(user))
 *     return decision
 *   })
 */

export { TemporalLayrClient } from './client';
export { Tracer } from './tracer';
export type { Span, ExecutionGraph, LLMResult, TemporalLayrConfig } from './types';

import { TemporalLayrClient } from './client';
import { Tracer } from './tracer';
import { TemporalLayrConfig } from './types';

export class TemporalLayr {
    readonly client: TemporalLayrClient;
    readonly tracer: Tracer;

    constructor(config: TemporalLayrConfig) {
        this.client = new TemporalLayrClient(config);
        this.tracer = new Tracer(this.client);
    }

    async shutdown(): Promise<void> {
        await this.client.shutdown();
    }
}

/** Convenience factory — reads from environment variables */
export function fromEnv(): TemporalLayr {
    const apiKey = process.env.TEMPORALLAYR_API_KEY;
    const serverUrl = process.env.TEMPORALLAYR_SERVER_URL;
    const tenantId = process.env.TEMPORALLAYR_TENANT_ID;

    if (!apiKey || !serverUrl || !tenantId) {
        throw new Error(
            'Missing required env vars: TEMPORALLAYR_API_KEY, TEMPORALLAYR_SERVER_URL, TEMPORALLAYR_TENANT_ID'
        );
    }

    return new TemporalLayr({ apiKey, serverUrl, tenantId });
}
