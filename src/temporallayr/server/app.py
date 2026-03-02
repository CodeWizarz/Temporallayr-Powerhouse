"""
FastAPI ingestion and replay server for Temporallayr.
"""

import asyncio
import os
import time
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
    has_more: bool


class RegisterTenantRequest(BaseModel):
    tenant_id: str
    admin_email: str


from temporallayr.core.alerting import AlertEngine
from temporallayr.core.audit import AuditLogger
from temporallayr.core.diff_engine import ExecutionDiffer
from temporallayr.core.failure_cluster import FailureClusterEngine
from temporallayr.core.fingerprint import Fingerprinter
from temporallayr.core.incidents import IncidentEngine
from temporallayr.core.otel_exporter import get_otlp_exporter
from temporallayr.core.replay import ReplayEngine
from temporallayr.core.store import get_default_store
from temporallayr.core.store_clickhouse import get_clickhouse_store
from temporallayr.core.store_sqlite import SQLiteStore
from temporallayr.core.logging import configure_logging
from temporallayr.models.execution import ExecutionGraph
from temporallayr.models.replay import ReplayReport
from temporallayr.server.auth import verify_admin_key, verify_api_key
from temporallayr.server.auth.api_keys import (
    delete_keys_for_tenant,
    generate_api_key,
    list_all_tenants,
    list_keys_for_tenant,
    map_api_key_to_tenant,
    validate_api_key,
)
from temporallayr.server.ratelimit import limiter, rate_limit_exceeded_handler
from temporallayr.server.quota import QuotaExceededException, check_and_increment_quota
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)


def _get_sqlite_store() -> SQLiteStore:
    store = get_default_store()
    return store if isinstance(store, SQLiteStore) else SQLiteStore()


def _load_incidents() -> list[dict[str, Any]]:
    try:
        return _get_sqlite_store().load_all_incidents()
    except Exception:
        logger.error("Failed to load incidents from SQLite.", exc_info=True)
        return []


def _persist_incidents() -> None:
    global _INCIDENTS
    try:
        from temporallayr.core.store import get_default_store

        store = get_default_store()
        store.bulk_save_incidents(_INCIDENTS)
    except Exception as e:
        logger.error(f"Failed to persist incidents: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    from temporallayr.config import get_config

    config = get_config()
    configure_logging(level=config.log_level)
    logger.info("Initializing TemporalLayr API Services")

    AuditLogger.log_config_change(
        "TEMPORALLAYR_RETENTION_DAYS", os.getenv("TEMPORALLAYR_RETENTION_DAYS", "30")
    )
    AuditLogger.log_config_change(
        "TEMPORALLAYR_API_KEYS", os.getenv("TEMPORALLAYR_API_KEYS", "configured")
    )

    store = get_default_store()
    global _INCIDENTS
    async with _incidents_lock:
        _INCIDENTS = store.load_all_incidents()
        logger.info(
            f"Loaded {len(_INCIDENTS)} active incidents globally.",
            extra={"incident_count": len(_INCIDENTS)},
        )

    ch_store = get_clickhouse_store()
    if ch_store:
        try:
            ch_store.ensure_schema()
            logger.info("ClickHouse OLAP Analytics engine native schema loaded dynamically.")
        except Exception as e:
            logger.warning(f"ClickHouse schema initialization skipped: {e}", exc_info=True)

    from temporallayr.core.store import init_otlp_batcher

    otlp = init_otlp_batcher()
    if otlp:
        logger.info(f"OTLP Trace routing actively bound internally: {otlp.endpoint}")

    async def _retention_loop() -> None:
        while True:
            await asyncio.sleep(60 * 60)  # Check every hour
            try:
                from temporallayr.core.store import get_default_store

                store = get_default_store()
                if hasattr(store, "_store_dir"):  # Only for SQLiteStore
                    deleted = store.retention_cleanup()
                    if deleted > 0:
                        logger.info(
                            f"Database Retention worker dropped {deleted} historical objects."
                        )
            except Exception as e:
                logger.error(f"Retention background pipeline fault: {e}", exc_info=True)
            await asyncio.sleep(3600)  # Wait for another hour after cleanup attempt

    task = asyncio.create_task(_retention_loop())
    yield
    task.cancel()


# Start application
app = FastAPI(title="Temporallayr API", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


@app.exception_handler(QuotaExceededException)
async def quota_exceeded_exception_handler(request: Request, exc: QuotaExceededException):
    return JSONResponse(
        status_code=429,
        content={
            "error": "quota_exceeded",
            "limit": exc.limit,
            "used": exc.used,
            "resets_at": exc.resets_at,
        },
    )


_INCIDENTS: list[dict[str, Any]] = []
_incidents_lock = asyncio.Lock()


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any) -> Response:
        start_time = time.time()
        tenant_id = request.headers.get("X-Tenant-Id", "unknown")
        if tenant_id == "unknown" and request.headers.get("Authorization"):
            tenant_id = "bearer_token_pending_eval"
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            status_code = 500
            logger.error(f"API call error: {e}", exc_info=True)
            raise e
        finally:
            AuditLogger.log_api_call(
                method=request.method,
                path=request.url.path,
                status_code=status_code,
                duration_ms=(time.time() - start_time) * 1000,
                tenant_id=tenant_id,
            )
        return response


app.add_middleware(AuditLoggingMiddleware)


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
        logger.error(f"SQLite not ready: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"SQLite not ready: {e}") from e
    ch = get_clickhouse_store()
    if ch:
        try:
            ch._get_client().command("SELECT 1")
            details["clickhouse"] = "ok"
        except Exception as e:
            details["clickhouse"] = f"degraded: {e}"
            logger.warning(f"ClickHouse degraded: {e}", exc_info=True)
    return {"status": "ready", "backends": details}


# ── Keys ───────────────────────────────────────────────────────────────


class CreateKeyRequest(BaseModel):
    tenant_id: str


@app.post("/keys/create", response_model=dict[str, str], tags=["auth"])
async def create_api_key(
    req: CreateKeyRequest, active_tenant: str = Depends(verify_admin_key)
) -> dict[str, str]:
    new_key = generate_api_key()
    map_api_key_to_tenant(new_key, req.tenant_id)
    logger.info(f"API key created for tenant: {req.tenant_id}")
    return {"api_key": new_key, "tenant_id": req.tenant_id}


@app.get("/keys/list", response_model=list[dict[str, Any]], tags=["auth"])
async def list_api_keys(tenant_id: str = Depends(verify_api_key)) -> list[dict[str, Any]]:
    return list_keys_for_tenant(tenant_id)


# ── Ingest ─────────────────────────────────────────────────────────────


class IngestRequest(BaseModel):
    events: list[dict[str, Any]]


async def _process_graph(graph: ExecutionGraph, tenant_id: str) -> None:
    """Post-ingest side effects: fingerprint, cluster, OTLP export, ClickHouse."""
    # OTLP export (Phoenix, Jaeger, etc.)
    otlp = get_otlp_exporter()
    if otlp:
        asyncio.create_task(otlp.export(graph))

    # ClickHouse analytics write
    ch_store = get_clickhouse_store()
    if ch_store:
        try:
            await asyncio.to_thread(ch_store.record_spans, tenant_id, graph)
        except Exception as e:
            logger.warning(f"ClickHouse insertion block aborted: {e}", exc_info=True)

    # Incident detection
    try:
        clusters = FailureClusterEngine.cluster_failures([graph])
        if clusters:
            global _INCIDENTS
            async with _incidents_lock:
                new_incidents = IncidentEngine.detect_incidents(clusters, _INCIDENTS)
                if new_incidents:
                    _INCIDENTS.extend(new_incidents)
                    _persist_incidents()
                    logger.info(
                        f"Detected {len(new_incidents)} new incidents for tenant {tenant_id}."
                    )
    except Exception as e:
        logger.error(f"Evaluation anomaly processing internal fault mapping: {e}", exc_info=True)


@app.post("/v1/ingest", status_code=202, tags=["ingest"])
@limiter.limit("1000/minute")
async def ingest_batch(
    request: Request,
    authorization: str = Header(default=""),
    x_tenant_id: str = Header(default=""),
) -> dict[str, Any]:
    """Batch ingest endpoint for SDK transport (AsyncHTTPTransport + sdk_api)."""
    if not authorization.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"error": "unauthorized"})

    token = authorization[7:].strip()
    token_tenant_id = validate_api_key(token)

    if not token_tenant_id:
        return JSONResponse(status_code=401, content={"error": "unauthorized"})

    if x_tenant_id and token_tenant_id != x_tenant_id:
        return JSONResponse(status_code=401, content={"error": "tenant_mismatch"})

    store = get_default_store()
    processed, errors = 0, 0

    # We must read JSON manually since Request takes over body reading
    try:
        data = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "invalid json body"})

    events = data.get("events", []) if isinstance(data, dict) else []

    # Enforce quota globally mapping attributes explicitly
    span_count = sum(len(e.get("spans", [])) for e in events)
    check_and_increment_quota(token_tenant_id, span_count, trace_count=len(events))

    for event in events:
        try:
            if "tenant_id" not in event and x_tenant_id:
                event = {**event, "tenant_id": x_tenant_id}
            if not event.get("tenant_id"):
                event = {**event, "tenant_id": "default"}

            graph = ExecutionGraph.model_validate(event)
            store.save_execution(graph)
            asyncio.create_task(_process_graph(graph, graph.tenant_id))
            processed += 1
        except Exception as e:
            logger.error(f"Ingest event error: {e}", exc_info=True)
            errors += 1

    return {"processed": processed, "errors": errors}


# ── Executions ─────────────────────────────────────────────────────────


class ExecutionDiffRequest(BaseModel):
    execution_a: str
    execution_b: str


@app.get("/executions", response_model=PaginatedResponse[str], tags=["executions"])
@limiter.limit("200/minute")
async def list_executions(
    request: Request,
    tenant_id: str = Depends(verify_api_key),
    limit: int = 50,
    offset: int = 0,
) -> Any:
    try:
        total, items = get_default_store().list_executions(tenant_id, limit=limit, offset=offset)
        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/executions", status_code=201, tags=["executions"])
async def create_execution(graph: ExecutionGraph, x_tenant_id: str = Header(...)) -> dict[str, str]:
    if graph.tenant_id != x_tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id mismatch")

    check_and_increment_quota(x_tenant_id, span_count=len(graph.spans), trace_count=1)

    try:
        store = get_default_store()
        previous_ids = store.list_executions(x_tenant_id)
        previous_id = next((pid for pid in previous_ids if pid != graph.id), None)
        store.save_execution(graph)

        if previous_id:
            try:
                prev = store.load_execution(previous_id, x_tenant_id)
                alerts = AlertEngine.check_execution(graph, prev)
                if alerts:
                    logger.info(
                        f"Triggered {len(alerts)} alerts for {graph.id}",
                        extra={"alert_count": len(alerts), "execution_id": graph.id},
                    )
            except Exception as e:
                logger.error(f"Alert check failed: {e}", exc_info=True)

        asyncio.create_task(_process_graph(graph, graph.tenant_id))
        return {"execution_id": graph.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/executions/{execution_id}", response_model=ExecutionGraph, tags=["executions"])
async def get_execution(
    execution_id: str, tenant_id: str = Depends(verify_api_key)
) -> ExecutionGraph:
    try:
        return get_default_store().load_execution(execution_id, tenant_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404, detail=f"Execution '{execution_id}' not found."
        ) from None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/executions/{execution_id}/replay", response_model=ReplayReport, tags=["executions"])
async def replay_execution(
    execution_id: str, tenant_id: str = Depends(verify_api_key)
) -> ReplayReport:
    try:
        graph = get_default_store().load_execution(execution_id, tenant_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404, detail=f"Execution '{execution_id}' not found."
        ) from None
    try:
        return await ReplayEngine(graph).replay()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Replay failed: {e!s}") from e


@app.post("/executions/diff", response_model=dict[str, list[Any]], tags=["executions"])
async def diff_executions(
    request: ExecutionDiffRequest, tenant_id: str = Depends(verify_api_key)
) -> dict[str, list[Any]]:
    store = get_default_store()
    try:
        exec_a = store.load_execution(request.execution_a, tenant_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"'{request.execution_a}' not found.") from None
    try:
        exec_b = store.load_execution(request.execution_b, tenant_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"'{request.execution_b}' not found.") from None
    try:
        return ExecutionDiffer.diff(exec_a, exec_b)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diff failed: {e!s}") from e


# ── Clusters & Analytics ───────────────────────────────────────────────


@app.get("/clusters", response_model=PaginatedResponse[dict[str, Any]], tags=["analytics"])
async def get_clusters(
    tenant_id: str = Depends(verify_api_key),
    limit: int = 50,
    offset: int = 0,
) -> Any:
    """Failure clusters. Uses ClickHouse if configured, SQLite fallback."""
    ch = get_clickhouse_store()
    if ch:
        try:
            total, clusters = ch.get_failure_clusters(
                tenant_id, hours=24, limit=limit, offset=offset
            )
            return {
                "items": clusters,
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total,
            }
        except Exception as e:
            logger.warning(
                f"ClickHouse cluster query failed, falling back to SQLite: {e}", exc_info=True
            )

    # SQLite fallback
    store = get_default_store()
    try:
        cutoff = datetime.now(UTC) - timedelta(hours=24)
        _, ids = store.list_executions(tenant_id, limit=1000)  # overfetch for manual clustering
        recent = []
        for eid in ids:
            try:
                g = store.load_execution(eid, tenant_id)
                if g.created_at >= cutoff:
                    recent.append(g)
            except Exception:
                pass
        clusters = FailureClusterEngine.cluster_failures(recent)
        total = len(clusters)
        paginated_clusters = clusters[offset : offset + limit]
        return {
            "items": paginated_clusters,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clustering failed: {e!s}") from e


@app.get("/analytics/latency", response_model=PaginatedResponse[dict[str, Any]], tags=["analytics"])
@limiter.limit("100/minute")
async def get_latency(
    request: Request,
    tenant_id: str = Depends(verify_api_key),
    hours: int = 24,
    limit: int = 50,
    offset: int = 0,
) -> Any:
    """P50/P95/P99 latency per span. Requires ClickHouse."""
    ch = get_clickhouse_store()
    if not ch:
        raise HTTPException(
            status_code=503, detail="ClickHouse not configured. Set TEMPORALLAYR_CLICKHOUSE_HOST."
        )
    try:
        total, items = ch.get_latency_percentiles(
            tenant_id, hours=hours, limit=limit, offset=offset
        )
        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/analytics/trends", response_model=PaginatedResponse[dict[str, Any]], tags=["analytics"])
@limiter.limit("100/minute")
async def get_trends(
    request: Request,
    tenant_id: str = Depends(verify_api_key),
    hours: int = 168,
    limit: int = 50,
    offset: int = 0,
) -> Any:
    """Get span kind trending analytics globally."""
    store = get_default_store()
    if not hasattr(store, "_analytics_store"):
        return {"items": [], "total": 0, "limit": limit, "offset": offset, "has_more": False}

    total, items = store.get_fingerprint_trends(
        tenant_id=tenant_id,
        hours=hours,
        limit=limit,
        offset=offset,
    )
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total,
    }


# =================================================================================
# Admin API
# =================================================================================


@app.post("/admin/tenants/register", status_code=201, tags=["admin"])
async def register_tenant(
    req: RegisterTenantRequest,
    _=Depends(verify_admin_key),
) -> dict[str, Any]:
    """Register a new active tenant natively."""
    from datetime import datetime, UTC

    new_key = generate_api_key()
    map_api_key_to_tenant(new_key, req.tenant_id)
    return {
        "tenant_id": req.tenant_id,
        "api_key": new_key,
        "created_at": datetime.now(UTC).isoformat(),
    }


@app.post("/admin/tenants/{tenant_id}/rotate-key", status_code=200, tags=["admin"])
async def rotate_tenant_api_key(
    tenant_id: str,
    _=Depends(verify_admin_key),
) -> dict[str, Any]:
    """Invalidate immediately and rotate all access blocks linked to a tenant."""
    delete_keys_for_tenant(tenant_id)
    new_key = generate_api_key()
    map_api_key_to_tenant(new_key, tenant_id)
    return {"api_key": new_key}


@app.get("/admin/tenants", tags=["admin"])
async def list_registered_tenants(_=Depends(verify_admin_key)) -> list[dict[str, Any]]:
    """Yield all distinct active tenants inside the namespace."""
    return list_all_tenants()


@app.get("/analytics/spans/{trace_id}", response_model=list[dict[str, Any]], tags=["analytics"])
async def get_span_timeline(
    trace_id: str, tenant_id: str = Depends(verify_api_key)
) -> list[dict[str, Any]]:
    """Full span timeline for a trace. Requires ClickHouse."""
    ch = get_clickhouse_store()
    if not ch:
        raise HTTPException(status_code=503, detail="ClickHouse not configured.")
    try:
        return ch.get_span_timeline(trace_id, tenant_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


class QuotaRequest(BaseModel):
    daily_span_limit: int
    monthly_span_limit: int


@app.post("/admin/tenants/{tenant_id}/quota", status_code=200, tags=["admin"])
async def set_tenant_quota(
    tenant_id: str, req: QuotaRequest, _=Depends(verify_admin_key)
) -> dict[str, str]:
    store = _get_sqlite_store()
    store.upsert_quota(tenant_id, req.daily_span_limit, req.monthly_span_limit)
    return {"status": "success"}


@app.get("/usage", tags=["analytics"])
async def get_tenant_usage(tenant_id: str = Depends(verify_api_key)) -> dict[str, Any]:
    store = _get_sqlite_store()
    quota = store.get_quota(tenant_id)

    date_str = datetime.now(UTC).strftime("%Y-%m-%d")
    today_usage = store.get_usage(tenant_id, date_str)

    # Very crude approximation of monthly natively mapping exactly
    # Just return zeroes for monthly until proper SQL aggregations are demanded
    return {
        "today": {"spans": today_usage["span_count"], "traces": today_usage["trace_count"]},
        "this_month": {"spans": 0, "traces": 0},
        "limits": {"daily": quota["daily_span_limit"], "monthly": quota["monthly_span_limit"]},
    }


# ── Incidents ──────────────────────────────────────────────────────────


@app.get("/incidents", response_model=PaginatedResponse[dict[str, Any]], tags=["incidents"])
async def get_incidents(
    tenant_id: str = Depends(verify_api_key),
    limit: int = 50,
    offset: int = 0,
) -> Any:
    async with _incidents_lock:
        all_tenant_incs = [inc for inc in _INCIDENTS if inc.get("tenant_id") == tenant_id]
        total = len(all_tenant_incs)
        items = all_tenant_incs[offset : offset + limit]
        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total,
        }


@app.post("/incidents/{incident_id}/ack", response_model=dict[str, Any], tags=["incidents"])
async def ack_incident(
    incident_id: str, tenant_id: str = Depends(verify_api_key)
) -> dict[str, Any]:
    global _INCIDENTS
    async with _incidents_lock:
        for inc in _INCIDENTS:
            if inc["incident_id"] == incident_id and inc.get("tenant_id") == tenant_id:
                inc["status"] = "acknowledged"
                AuditLogger.log_incident_change(
                    incident_id, "ack", tenant_id, {"status": "acknowledged"}
                )
                _persist_incidents()
                return inc
    raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found.")


@app.post("/incidents/{incident_id}/resolve", response_model=dict[str, Any], tags=["incidents"])
async def resolve_incident(
    incident_id: str, tenant_id: str = Depends(verify_api_key)
) -> dict[str, Any]:
    global _INCIDENTS
    async with _incidents_lock:
        for inc in _INCIDENTS:
            if inc["incident_id"] == incident_id and inc.get("tenant_id") == tenant_id:
                inc["status"] = "resolved"
                AuditLogger.log_incident_change(
                    incident_id, "resolve", tenant_id, {"status": "resolved"}
                )
                _persist_incidents()
                return inc
    raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found.")


# ── Audit Logs ─────────────────────────────────────────────────────────


@app.get("/audit-log", response_model=PaginatedResponse[dict[str, Any]], tags=["audit"])
async def get_audit_logs(
    tenant_id: str = Depends(verify_api_key),
    limit: int = 50,
    offset: int = 0,
    event_type: str | None = None,
    since: str | None = None,
) -> Any:
    try:
        store = _get_sqlite_store()
        total, items = store.query_audit_logs(
            tenant_id=tenant_id, limit=limit, offset=offset, event_type=event_type, since=since
        )
        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get(
    "/admin/audit-log", response_model=PaginatedResponse[dict[str, Any]], tags=["admin", "audit"]
)
async def get_admin_audit_logs(
    _=Depends(verify_admin_key),
    limit: int = 50,
    offset: int = 0,
    event_type: str | None = None,
    since: str | None = None,
) -> Any:
    try:
        store = _get_sqlite_store()
        total, items = store.query_audit_logs(
            tenant_id=None, limit=limit, offset=offset, event_type=event_type, since=since
        )
        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
