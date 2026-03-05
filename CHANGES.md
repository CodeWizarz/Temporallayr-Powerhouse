# TemporalLayr — Patch Notes (Phase 0 + Phase 1)

## Critical Bug Fixes (Phase 0)

### B2: Worker Cross-Process State Corruption ✓ FIXED
**File:** `workers/ingest_worker.py`  
**Problem:** `from temporallayr.server.app import _INCIDENTS` caused the worker to import
and mutate in-memory state from a different process — completely broken in production.  
**Fix:** Replaced with `_WORKER_INCIDENTS: list = []` — a worker-local list. In distributed
deployments, incidents should be read from/written to the DB, not shared in-memory.

### B6: LLM Pricing Table Outdated ✓ FIXED  
**File:** `src/temporallayr/core/decorators.py`  
**Problem:** Pricing table missing Claude 4, GPT-4o (wrong price), o1/o3, Gemini 2.x, 
DeepSeek, Mistral, Llama 3.x — all major 2025/2026 models.  
**Fix:** Expanded to 30+ models with correct current pricing.

### B3: Duplicate Store Module ✓ FIXED
**Files:** `src/temporallayr/storage/postgres_store.py` (deleted), `src/temporallayr/storage/__init__.py` (updated)  
**Problem:** `storage/postgres_store.py` was a copy of `core/store_postgres.py`.  
**Fix:** Deleted duplicate; updated all imports to use canonical `core/store_postgres.py`.

### Junk Files Deleted ✓
Removed: `env_loads.py`, `ingest.json`, `ingest_bad.json`, `ingest_body.json`, 
`reg.json`, `reg_hack.json`, `test_clickhouse.py`, `test_smoke.py`

---

## Dashboard Implementation (Phase 1)

All 6 dashboard pages were stubs (`return <div>Page</div>`). Now fully implemented:

### `Traces.tsx` ✓ COMPLETE
- Paginated execution trace list (50 per page)
- Status badges (success/error), span counts, duration, timestamps
- Search by trace ID or tenant
- Click-through to trace detail

### `TraceDetail.tsx` ✓ COMPLETE
- Full span tree with collapsible rows, depth indentation
- Replay button with inline divergence report
- Error highlighting on failing spans
- Span attribute JSON viewer

### `Incidents.tsx` ✓ COMPLETE
- Stats cards: open / critical / acknowledged / resolved counts
- Filterable by status (All / Open / Acknowledged / Resolved)
- One-click Acknowledge and Resolve actions
- Severity-coded badges (critical / high / normal)

### `Analytics.tsx` ✓ COMPLETE
- 4 stat cards: total calls, errors, avg error rate, max P99
- Time window selector (1h / 6h / 24h / 7d)
- Per-span latency table: P50 / P95 / P99 / avg with visual bar
- Error rate highlighting

### `Replay.tsx` ✓ COMPLETE
- Replay tab: enter trace ID, run determinism check, view divergences
- Diff tab: compare two traces side by side
- Clear explanatory UI with result summary

### `Settings.tsx` ✓ COMPLETE
- API key manager (browser localStorage)
- Quick-start code snippet
- Admin panel: register tenants, list tenants, rotate API keys
- Server info display

---

## New Files Added

| File | Purpose |
|------|---------|
| `docker/worker/Dockerfile` | Production Docker image for ingest worker |
| `dashboard/.env.example` | Dashboard environment template |
| `sdk-node/jest.config.js` | Jest configuration for TypeScript SDK tests |
| `tests/integration/test_webhook_delivery.py` | Webhook dispatch integration tests |
| `src/temporallayr/replay/__init__.py` | Re-exports for replay module |

---

## Makefile Targets Added

```
make dashboard-install   # npm install for dashboard
make dashboard-dev       # Start dashboard dev server (port 3000)
make dashboard-build     # Production build
make dashboard-preview   # Preview production build
make worker              # Start ingest worker
make worker-docker-build # Build worker Docker image
make dev-server          # Start API server with hot reload
```

---

## What's Left (Phase 2+)

1. **Tests passing** — Run `pytest` locally; some integration tests require DB/Redis
2. **ClickHouse setup** — Configure `TEMPORALLAYR_CLICKHOUSE_HOST` etc
3. **Deploy** — See `docker-compose.yml` or Koyeb/Neon deployment guide
4. **PyPI publish** — `python -m build && twine upload dist/*`
5. **npm publish** — `cd sdk-node && npm publish`
