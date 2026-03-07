# TemporalLayr

**Production-Grade Telemetry, Governance, and Observability for Autonomous AI Agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org)
[![Build Status](https://github.com/CodeWizarz/Temporallayr-Powerhouse/actions/workflows/ci.yml/badge.svg)](https://github.com/CodeWizarz/Temporallayr-Powerhouse/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/github/CodeWizarz/Temporallayr-Powerhouse?label=coverage)](https://codecov.io/gh/CodeWizarz/Temporallayr-Powerhouse)

> **Not just request logging. The operational layer for autonomous AI.**

Standard observability tools see your LLM API calls. TemporalLayr sees your *agent's reasoning* — every decision branch, tool call, and failure, stitched into a queryable execution graph you can replay, diff, and audit.

---

## Engineering Quality

- Multi-platform CI on Linux and macOS for every push and pull request
- Automated lint (`ruff`), formatting checks (`black`), static typing (`mypy`), and test execution (`pytest`)
- Coverage gate enforced at **80% minimum** with XML + JUnit artifacts for pipeline diagnostics

---

## Why TemporalLayr vs Helicone/LangSmith?

| Capability | Helicone | LangSmith | **TemporalLayr** |
|---|---|---|---|
| LLM request logging | ✅ | ✅ | ✅ |
| Cost per token | ✅ | ✅ | ✅ (built-in table) |
| Multi-step agent DAG | ⚠️ sessions | ⚠️ shallow | ✅ **core engine** |
| Deterministic replay | ❌ | ❌ | ✅ **unique** |
| Semantic diff between runs | ❌ | ❌ | ✅ **unique** |
| Failure clustering by fingerprint | ❌ | ❌ | ✅ **unique** |
| Incident lifecycle | ❌ | ❌ | ✅ |
| ClickHouse OLAP analytics | ❌ | ❌ | ✅ |
| OTLP/Phoenix export | ❌ | ❌ | ✅ |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Your Agent (@track_llm, @track_tool, @track_pipeline)          │
│         │                                                        │
│  ExecutionRecorder (ContextVar-isolated, async-safe DAG)        │
└──────────────┬──────────────────────────────────────────────────┘
               │  async HTTP batch transport
┌──────────────▼──────────────────────────────────────────────────┐
│  TemporalLayr FastAPI Server                                     │
│  POST /v1/ingest  →  SQLite (local) or Postgres (prod)          │
│                   →  ClickHouse Cloud (analytics)               │
│                   →  OTLP export (Phoenix / Jaeger / Tempo)     │
│                   →  IncidentEngine (cluster → alert)           │
│                                                                  │
│  GET /executions/{id}/replay  →  ReplayEngine                   │
│  POST /executions/diff        →  DivergenceComparator           │
│  GET /clusters                →  FailureClusterEngine           │
│  GET /analytics/latency       →  P50/P95/P99 per span           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
pip install temporallayr
```

### 1. Instrument Your AI Agent

```python
import asyncio
import temporallayr as tl

# 1. Simulate RAG Search (Tool)
@tl.track_tool(name="search_knowledge_base")
async def search_knowledge_base(query: str) -> str:
    """Vector search enterprise documentation."""
    await asyncio.sleep(0.2)
    return "Enterprise tier includes 99.99% uptime SLA."

# 2. Simulate LLM Reasoning
@tl.track_llm
async def generate_response(context: str, query: str) -> dict:
    """LLM chain blending context with a system prompt."""
    await asyncio.sleep(0.8) # Simulate AI inference time
    return {
        "output": f"Based on your tier, your SLA is 99.99%.",
        "model": "gpt-4o",
        "prompt_tokens": 142,
        "completion_tokens": 38,
        "total_tokens": 180,
    }

# 3. Main Agent Pipeline
@tl.track_pipeline
async def support_agent(query: str) -> str:
    """The main entry point for the agent."""
    context = await search_knowledge_base(query)
    result = await generate_response(context, query)
    return result["output"]

async def main():
    print("Running Autonomous Support Agent...")
    
    # 4. Initialize SDK inside the event loop
    tl.init(
        server_url="https://cognitive-natalie-temporall-2ff73e17.koyeb.app",
        api_key="YOUR_API_KEY",
        tenant_id="temporallayr-prod"
    )
    
    # 5. Start the trace to isolate execution graph telemetry
    trace_id = tl.start_trace(trace_name="SupportAgentExecution")
    print(f"Tracking run under trace_id: {trace_id}")
    
    try:
        reply = await support_agent(query="What is my uptime SLA?")
        print(f"Agent Reply: {reply}")
    finally:
        # 6. Push telemetry securely before exiting
        await tl.flush()
        await tl.shutdown()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Decorators Reference

| Decorator | Captures | Span Kind |
|---|---|---|
| `@track` | inputs, output, error, latency | CHAIN |
| `@track_llm` | + model name, token counts, cost USD | LLM |
| `@track_tool` | + tool name, description | TOOL |
| `@track_pipeline` | same as `@track`, marks entry point | CHAIN |

---

## Server Deployment

### Koyeb (Free Tier) + Neon (Free Postgres)

```bash
# Deploy from GitHub in Koyeb dashboard
# Set env vars:
TEMPORALLAYR_API_KEY=<bootstrap-key>
TEMPORALLAYR_ADMIN_KEY=<admin-key>
TEMPORALLAYR_TENANT_ID=default

# Register your first tenant via admin API
curl -X POST https://your-app.koyeb.app/admin/tenants/register \
  -H "X-Admin-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "acme-corp"}'
```

### ClickHouse Cloud (Analytics)

```bash
# From ClickHouse Cloud console → Connect → Python
TEMPORALLAYR_CLICKHOUSE_HOST=abc123.us-east-1.aws.clickhouse.cloud
TEMPORALLAYR_CLICKHOUSE_PORT=8443
TEMPORALLAYR_CLICKHOUSE_SECURE=true
TEMPORALLAYR_CLICKHOUSE_USER=default
TEMPORALLAYR_CLICKHOUSE_PASSWORD=<from console>
```

Schema auto-creates on first server startup.

---

## Environment Variables

See [SETUP.md](./SETUP.md) for the full reference.

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `POST /v1/ingest` | Batch ingest from SDK |
| `POST /executions` | Create execution graph |
| `GET /executions` | List with pagination |
| `GET /executions/{id}` | Get single execution |
| `POST /executions/{id}/replay` | Deterministic replay |
| `POST /executions/diff` | Semantic diff two runs |
| `GET /clusters` | Failure clusters |
| `GET /incidents` | Active incidents |
| `POST /incidents/{id}/ack` | Acknowledge incident |
| `POST /incidents/{id}/resolve` | Resolve incident |
| `GET /analytics/latency` | P50/P95/P99 per span (ClickHouse) |
| `GET /analytics/trends` | Fingerprint volume trends |
| `GET /analytics/spans/{trace_id}` | Full span timeline |
| `POST /admin/tenants/register` | Create tenant + API key |
| `POST /admin/tenants/{id}/rotate-key` | Rotate tenant keys |
| `GET /admin/tenants` | List all tenants |

Interactive docs: `http://localhost:8000/docs`

---

**TemporalLayr** · Building the bedrock for reliable machine intelligence.
