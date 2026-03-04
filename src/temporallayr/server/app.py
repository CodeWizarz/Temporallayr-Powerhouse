"""
TemporalLayr FastAPI server.

Fixes applied:
  - asyncio.Lock around all _INCIDENTS mutations (race condition fix)
  - Tenant isolation: /v1/ingest validates Bearer token == X-Tenant-Id
  - Bearer token prefix stripping before hash lookup
  - Admin API: register tenant, rotate key, list tenants
  - Structured JSON logging replaces all print()
  - ClickHouse TLS defaults via config
  - OTLP export via config
  - Single-worker safe (SQLite) + PostgreSQL upgrade path
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from temporallayr.core.alerting import AlertEngine
from temporallayr.core.audit import AuditLogger
from temporallayr.core.diff_engine import ExecutionDiffer
from temporallayr.core.failure_cluster import FailureClusterEngine
from temporallayr.core.incidents import IncidentEngine
from temporallayr.core.logging import configure_logging
from temporallayr.core.otel_exporter import get_otlp_exporter
from temporallayr.core.replay import ReplayEngine
from temporallayr.core.store import get_default_store
from temporallayr.core.store_clickhouse import get_clickhouse_store
from temporallayr.core.store_sqlite import SQLiteStore
from temporallayr.models.execution import ExecutionGraph
from temporallayr.models.replay import ReplayReport
from temporallayr.server.auth import verify_admin_key, verify_api_key
from temporallayr.server.auth.api_keys import (
    generate_api_key,
    list_all_tenants,
    list_keys_for_tenant,
    map_api_key_to_tenant,
    revoke_keys_for_tenant,
    validate_api_key,
)

logger = logging.getLogger(__name__)

# ── Global incident state with lock ──────────────────────────────────
_INCIDENTS: list[dict[str, Any]] = []
_incidents_lock = asyncio.Lock()


def _get_sqlite_store() -> SQLiteStore:
    store = get_default_store()
    return store if isinstance(store, SQLiteStore) else SQLiteStore()


def _load_incidents() -> list[dict[str, Any]]:
    try:
        return _get_sqlite_store().load_all_incidents()
    except Exception as e:
        logger.warning("Failed to load incidents from SQLite", extra={"error": str(e)})
        return []


async def _persist_incidents_locked(incidents: list[dict[str, Any]]) -> None:
    """Must be called inside _incidents_lock."""
    try:
        _get_sqlite_store().bulk_save_incidents(incidents)
    except Exception as e:
        logger.warning("Failed to persist incidents", extra={"error": str(e)})


@asynccontextmanager
async def lifespan(app: FastAPI):
    from temporallayr.config import get_config
    cfg = get_config()

    configure_logging(cfg.log_level)
    logger.info("TemporalLayr server starting", extra={"log_level": cfg.log_level})

    if not cfg.admin_key:
        logger.warning("TEMPORALLAYR_ADMIN_KEY not set — admin endpoints are disabled")

    # Load persisted incidents
    global _INCIDENTS
    async with _incidents_lock:
        _INCIDENTS = _load_incidents()
    logger.info("Loaded incidents", extra={"count": len(_INCIDENTS)})

    # Init ClickHouse schema if configured
    ch = get_clickhouse_store()
    if ch:
        try:
            await asyncio.to_thread(ch.initialize_schema)
            logger.info("ClickHouse schema ready")
        except Exception as e:
            logger.warning("ClickHouse init failed — analytics disabled", extra={"error": str(e)})

    # Log OTLP status
    otlp = get_otlp_exporter()
    if otlp:
        logger.info("OTLP export enabled", extra={"endpoint": otlp.endpoint})

    retention_days = int(os.getenv("TEMPORALLAYR_RETENTION_DAYS", "30"))

    async def _retention_worker() -> None:
        while True:
            try:
                cutoff = datetime.now(UTC) - timedelta(days=retention_days)
                deleted = get_default_store().delete_old_executions(cutoff)
                if deleted:
                    logger.info("Retention GC complete", extra={"deleted": deleted})
            except Exception as e:
                logger.warning("Retention worker error", extra={"error": str(e)})
            await asyncio.sleep(3600)

    task = asyncio.create_task(_retention_worker())
    yield
    task.cancel()
    logger.info("TemporalLayr server shutting down")


app = FastAPI(
    title="TemporalLayr",
    description="Production-grade AI agent observability — execution graphs, clustering, replay, OTLP.",
    version="0.2.0",
    lifespan=lifespan,
)


class _AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any) -> Response:
        t0 = time.time()
        # Determine tenant from header (best-effort; auth validates properly)
        tenant_id = request.headers.get("X-Tenant-Id", "unknown")
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            status_code = 500
            raise e
        finally:
            AuditLogger.log_api_call(
                method=request.method,
                path=request.url.path,
                status_code=status_code,
                duration_ms=(time.time() - t0) * 1000,
                tenant_id=tenant_id,
            )
        return response


app.add_middleware(_AuditMiddleware)


# ── Health ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["ops"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready", tags=["ops"])
async def ready() -> dict[str, Any]:
    details: dict[str, str] = {}
    try:
        get_default_store().list_executions("__probe__")
        details["sqlite"] = "ok"
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"SQLite not ready: {e}") from e

    ch = get_clickhouse_store()
    if ch:
        try:
            await asyncio.to_thread(ch._get_client().command, "SELECT 1")
            details["clickhouse"] = "ok"
        except Exception as e:
            details["clickhouse"] = f"degraded: {e}"

    return {"status": "ready", "backends": details}


# ── Ingest (FIXED: tenant isolation) ─────────────────────────────────

class IngestRequest(BaseModel):
    events: list[dict[str, Any]]


async def _process_graph(graph: ExecutionGraph) -> None:
    """Post-ingest side-effects: OTLP, ClickHouse, incident detection."""
    otlp = get_otlp_exporter()
    if otlp:
        asyncio.create_task(otlp.export(graph))

    ch = get_clickhouse_store()
    if ch:
        try:
            await asyncio.to_thread(ch.insert_trace, graph)
        except Exception as e:
            logger.warning("ClickHouse insert failed", extra={"error": str(e)})

    try:
        clusters = FailureClusterEngine.cluster_failures([graph])
        if clusters:
            async with _incidents_lock:
                global _INCIDENTS
                _INCIDENTS = IncidentEngine.detect_incidents(clusters, _INCIDENTS)
                await _persist_incidents_locked(_INCIDENTS)
    except Exception as e:
        logger.warning("Incident detection error", extra={"error": str(e)})


@app.post("/v1/ingest", status_code=202, tags=["ingest"])
async def ingest_events(
    request: IngestRequest,
    authorization: str = Header(default=""),
    x_tenant_id: str = Header(default=""),
) -> dict[str, Any]:
    """
    Batch ingest endpoint for SDK transport.

    SECURITY: Validates that Bearer token's bound tenant matches X-Tenant-Id header.
    Prevents tenant A from writing into tenant B's namespace.
    """
    # Extract and strip Bearer prefix
    raw_token = ""
    if authorization.lower().startswith("bearer "):
        raw_token = authorization[7:].strip()
    elif authorization:
        raw_token = authorization.strip()

    # Validate token → tenant
    authed_tenant: str | None = None
    if raw_token:
        authed_tenant = validate_api_key(raw_token)
        # Fallback to env key map
        if not authed_tenant:
            keys_str = os.getenv("TEMPORALLAYR_API_KEYS", "")
            for pair in keys_str.split(","):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    if k.strip() == raw_token:
                        authed_tenant = v.strip()
                        break

    if authed_tenant is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )

    # TENANT ISOLATION: if X-Tenant-Id provided, it must match token's tenant
    if x_tenant_id and x_tenant_id != authed_tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tenant does not match X-Tenant-Id header",
        )

    effective_tenant = authed_tenant
    store = get_default_store()
    processed, errors = 0, 0

    for event in request.events:
        try:
            event = {**event, "tenant_id": effective_tenant}
            graph = ExecutionGraph.model_validate(event)
            store.save_execution(graph)
            asyncio.create_task(_process_graph(graph))
            processed += 1
        except Exception as e:
            logger.warning("Ingest event error", extra={"error": str(e)})
            errors += 1

    return {"processed": processed, "errors": errors}


# ── Executions ─────────────────────────────────────────────────────────

class DiffRequest(BaseModel):
    execution_a: str
    execution_b: str


@app.post("/executions", status_code=201, tags=["executions"])
async def create_execution(
    graph: ExecutionGraph,
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, str]:
    if graph.tenant_id != tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id mismatch")
    store = get_default_store()
    try:
        previous_ids = store.list_executions(tenant_id)
        previous_id = next((pid for pid in previous_ids if pid != graph.id), None)
        store.save_execution(graph)
        if previous_id:
            try:
                prev = store.load_execution(previous_id, tenant_id)
                alerts = AlertEngine.check_execution(graph, prev)
                if alerts:
                    logger.info("Alerts triggered", extra={"count": len(alerts), "graph_id": graph.id})
            except Exception as e:
                logger.warning("Alert check failed", extra={"error": str(e)})
        asyncio.create_task(_process_graph(graph))
        return {"execution_id": graph.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/executions", tags=["executions"])
async def list_executions(
    tenant_id: str = Depends(verify_api_key),
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    ids = get_default_store().list_executions(tenant_id)
    page = ids[offset: offset + limit]
    return {"items": page, "total": len(ids), "limit": limit, "offset": offset, "has_more": (offset + limit) < len(ids)}


@app.get("/executions/{execution_id}", response_model=ExecutionGraph, tags=["executions"])
async def get_execution(
    execution_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> ExecutionGraph:
    try:
        return get_default_store().load_execution(execution_id, tenant_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Execution '{execution_id}' not found") from None


@app.post("/executions/{execution_id}/replay", response_model=ReplayReport, tags=["executions"])
async def replay_execution(
    execution_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> ReplayReport:
    try:
        graph = get_default_store().load_execution(execution_id, tenant_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Execution '{execution_id}' not found") from None
    return await ReplayEngine(graph).replay()


@app.post("/executions/diff", response_model=dict[str, list[Any]], tags=["executions"])
async def diff_executions(
    request: DiffRequest,
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, list[Any]]:
    store = get_default_store()
    try:
        exec_a = store.load_execution(request.execution_a, tenant_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"'{request.execution_a}' not found") from None
    try:
        exec_b = store.load_execution(request.execution_b, tenant_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"'{request.execution_b}' not found") from None
    return ExecutionDiffer.diff(exec_a, exec_b)


# ── Clusters & Analytics ───────────────────────────────────────────────

@app.get("/clusters", tags=["analytics"])
async def get_clusters(
    tenant_id: str = Depends(verify_api_key),
    hours: int = 24,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    ch = get_clickhouse_store()
    if ch:
        try:
            items = ch.get_failure_clusters(tenant_id, hours=hours)
            page = items[offset: offset + limit]
            return {"items": page, "total": len(items), "limit": limit, "offset": offset, "has_more": (offset + limit) < len(items)}
        except Exception as e:
            logger.warning("ClickHouse cluster query failed, using SQLite fallback", extra={"error": str(e)})

    store = get_default_store()
    cutoff = datetime.now(UTC) - timedelta(hours=hours)
    ids = store.list_executions(tenant_id)
    recent: list[ExecutionGraph] = []
    for eid in ids:
        try:
            g = store.load_execution(eid, tenant_id)
            if g.created_at >= cutoff:
                recent.append(g)
        except Exception:
            pass
    items = FailureClusterEngine.cluster_failures(recent)
    page = items[offset: offset + limit]
    return {"items": page, "total": len(items), "limit": limit, "offset": offset, "has_more": (offset + limit) < len(items)}


@app.get("/analytics/latency", tags=["analytics"])
async def get_latency(
    tenant_id: str = Depends(verify_api_key),
    hours: int = 24,
    limit: int = 200,
    offset: int = 0,
) -> dict[str, Any]:
    ch = get_clickhouse_store()
    if not ch:
        raise HTTPException(status_code=503, detail="ClickHouse not configured. Set TEMPORALLAYR_CLICKHOUSE_HOST.")
    items = ch.get_latency_percentiles(tenant_id, hours=hours)
    page = items[offset: offset + limit]
    return {"items": page, "total": len(items), "limit": limit, "offset": offset, "has_more": (offset + limit) < len(items)}


@app.get("/analytics/trends", tags=["analytics"])
async def get_trends(
    tenant_id: str = Depends(verify_api_key),
    hours: int = 168,
) -> list[dict[str, Any]]:
    ch = get_clickhouse_store()
    if not ch:
        raise HTTPException(status_code=503, detail="ClickHouse not configured.")
    return ch.get_fingerprint_trends(tenant_id, hours=hours)


@app.get("/analytics/spans/{trace_id}", tags=["analytics"])
async def get_span_timeline(
    trace_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> list[dict[str, Any]]:
    ch = get_clickhouse_store()
    if not ch:
        raise HTTPException(status_code=503, detail="ClickHouse not configured.")
    return ch.get_span_timeline(trace_id, tenant_id)


# ── Incidents (FIXED: asyncio.Lock on all mutations) ──────────────────

@app.get("/incidents", tags=["incidents"])
async def get_incidents(
    tenant_id: str = Depends(verify_api_key),
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    async with _incidents_lock:
        tenant_incs = [i for i in _INCIDENTS if i.get("tenant_id") == tenant_id]
    page = tenant_incs[offset: offset + limit]
    return {"items": page, "total": len(tenant_incs), "limit": limit, "offset": offset, "has_more": (offset + limit) < len(tenant_incs)}


@app.post("/incidents/{incident_id}/ack", tags=["incidents"])
async def ack_incident(
    incident_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    async with _incidents_lock:
        for inc in _INCIDENTS:
            if inc["incident_id"] == incident_id and inc.get("tenant_id") == tenant_id:
                inc["status"] = "acknowledged"
                AuditLogger.log_incident_change(incident_id, "ack", tenant_id)
                await _persist_incidents_locked(_INCIDENTS)
                return inc
    raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found")


@app.post("/incidents/{incident_id}/resolve", tags=["incidents"])
async def resolve_incident(
    incident_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    async with _incidents_lock:
        for inc in _INCIDENTS:
            if inc["incident_id"] == incident_id and inc.get("tenant_id") == tenant_id:
                inc["status"] = "resolved"
                AuditLogger.log_incident_change(incident_id, "resolve", tenant_id)
                await _persist_incidents_locked(_INCIDENTS)
                return inc
    raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found")


# ── Admin API ─────────────────────────────────────────────────────────

class RegisterTenantRequest(BaseModel):
    tenant_id: str
    admin_email: str | None = None


@app.post("/admin/tenants/register", status_code=201, tags=["admin"])
async def register_tenant(
    req: RegisterTenantRequest,
    _: None = Depends(verify_admin_key),
) -> dict[str, Any]:
    """Create a new tenant and return their first API key."""
    new_key = generate_api_key()
    map_api_key_to_tenant(new_key, req.tenant_id)
    AuditLogger.log_config_change("tenant_register", req.tenant_id)
    logger.info("Tenant registered", extra={"tenant_id": req.tenant_id})
    return {
        "tenant_id": req.tenant_id,
        "api_key": new_key,
        "created_at": datetime.now(UTC).isoformat(),
    }


@app.post("/admin/tenants/{tenant_id}/rotate-key", tags=["admin"])
async def rotate_key(
    tenant_id: str,
    _: None = Depends(verify_admin_key),
) -> dict[str, Any]:
    """Revoke all existing keys for a tenant and issue a new one."""
    revoked = revoke_keys_for_tenant(tenant_id)
    new_key = generate_api_key()
    map_api_key_to_tenant(new_key, tenant_id)
    logger.info("Keys rotated", extra={"tenant_id": tenant_id, "revoked": revoked})
    return {"tenant_id": tenant_id, "api_key": new_key, "revoked_count": revoked}


@app.get("/admin/tenants", tags=["admin"])
async def list_tenants(_: None = Depends(verify_admin_key)) -> list[dict[str, Any]]:
    return list_all_tenants()


# ── Keys ───────────────────────────────────────────────────────────────

@app.get("/keys", tags=["auth"])
async def list_keys(tenant_id: str = Depends(verify_api_key)) -> list[dict[str, Any]]:
    return list_keys_for_tenant(tenant_id)
