# @temporallayr/sdk

A zero-dependency Node.js native tracker for Temporallayr built entirely around `node:async_hooks` AsyncLocalStorage.

## Installation

```bash
npm install @temporallayr/sdk
```

## Quick Start (10 Lines)

```typescript
import { TemporalLayrClient, startTrace, startSpan, recordEvent } from '@temporallayr/sdk';

const client = new TemporalLayrClient({ apiKey: 'your-api-key', tenantId: 'my-tenant' });
client.start();

await startTrace('hello-world-trace', async () => {
  await startSpan('my-first-span', { myCustomTag: 123 }, async () => {
    recordEvent('user_signup', { userId: '123' });
    console.log('Doing some work...');
  });
});

await client.shutdown();
```

## Usage Notes

The SDK uses `AsyncLocalStorage` implicitly under the hood so you do not need to explicitly pass `Context` variables anywhere inside your spans! Simply wrap your logical scopes mapping execution trees perfectly without modifications!
