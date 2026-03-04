# TemporalLayr

**Production-Grade Telemetry, Governance, and Observability for Autonomous AI Agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org)
[![Build Status](https://github.com/CodeWizarz/Temporallayr-Powerhouse/actions/workflows/ci.yml/badge.svg)](https://github.com/CodeWizarz/Temporallayr-Powerhouse/actions/workflows/ci.yml)

> **Not just request logging. The operational layer for autonomous AI.**

Standard observability tools see your LLM API calls. TemporalLayr sees your *agent's reasoning* — every decision branch, tool call, and failure, stitched into a queryable execution graph you can replay, diff, and audit.

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

### 1. Initialize

```python
import temporallayr

temporallayr.init(
    server_url="https://your-temporallayr.koyeb.app",
    api_key="your-tenant-key",
    tenant_id="your-tenant",
)
```

### 2. Instrument Your Agent

```python
from temporallayr.core.decorators import track, track_llm, track_tool, track_pipeline

@track_tool(name="fetch_user", description="Retrieve user profile from DB")
def fetch_user(user_id: str) -> dict:
    return {"id": user_id, "risk_score": 0.87}

@track_llm
async def run_risk_model(profile: dict) -> dict:
    # Your actual LLM call here — return includes token counts for cost tracking
    return {
        "output": "REJECT",
        "model": "gpt-4o",
        "prompt_tokens": 342,
        "completion_tokens": 28,
        "total_tokens": 370,
    }

@track_pipeline
async def decision_pipeline(user_id: str) -> str:
    profile = fetch_user(user_id)
    result = await run_risk_model(profile)
    return result["output"]
```

### 3. Record an Execution Graph

```python
from temporallayr.core.recorder import ExecutionRecorder

async with ExecutionRecorder() as recorder:
    decision = await decision_pipeline("usr_12345")

graph = recorder.graph
print(f"Captured {len(graph.spans)} spans — trace {graph.trace_id}")
# → Captured 3 spans — trace abc123...
```

### 4. Replay & Diff

```python
# Replay a production failure locally (no real LLM calls)
from temporallayr.core.replay import ReplayEngine
report = await ReplayEngine(graph).replay()
print(f"Deterministic: {report.is_deterministic}")

# Diff two runs
from temporallayr.core.diff_engine import ExecutionDiffer
diffs = ExecutionDiffer.diff(graph_a, graph_b)
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
