"""
Analytics API routes for TemporalLayr.

GET /analytics/latency          — p50/p95/p99 per span name
GET /analytics/latency/percentiles — same, with richer breakdown
GET /analytics/errors/trends    — per-hour error rate by fingerprint
GET /analytics/trends           — fingerprint trace volume over time
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from temporallayr.core.store_clickhouse import get_clickhouse_store
from temporallayr.server.auth import verify_api_key

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _require_ch() -> Any:
    ch = get_clickhouse_store()
    if ch is None:
        raise HTTPException(status_code=503, detail="ClickHouse not configured")
    return ch


@router.get("/latency")
async def latency_overview(
    hours: int = Query(24, ge=1, le=8760),
    limit: int = Query(200, ge=1, le=1000),
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Latency percentiles (p50/p95/p99) per span name."""
    ch = _require_ch()
    import asyncio

    rows = await asyncio.to_thread(ch.get_latency_percentiles, tenant_id, hours)
    return {"tenant_id": tenant_id, "hours": hours, "items": rows[:limit], "total": len(rows)}


@router.get("/latency/percentiles")
async def latency_percentiles(
    hours: int = Query(24, ge=1, le=8760),
    limit: int = Query(200, ge=1, le=1000),
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Alias for /analytics/latency — returns p50/p95/p99 in a standardised envelope."""
    ch = _require_ch()
    import asyncio

    rows = await asyncio.to_thread(ch.get_latency_percentiles, tenant_id, hours)
    return {
        "tenant_id": tenant_id,
        "hours": hours,
        "percentiles": ["p50", "p95", "p99"],
        "items": rows[:limit],
        "total": len(rows),
    }


@router.get("/errors/trends")
async def error_trends(
    hours: int = Query(168, ge=1, le=8760),
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Per-hour error counts grouped by fingerprint — use for incident charts."""
    ch = _require_ch()
    import asyncio

    rows = await asyncio.to_thread(ch.get_error_trends, tenant_id, hours)
    return {"tenant_id": tenant_id, "hours": hours, "items": rows}


@router.get("/trends")
async def fingerprint_trends(
    hours: int = Query(168, ge=1, le=8760),
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Fingerprint trace volume over time (hourly buckets)."""
    ch = _require_ch()
    import asyncio

    rows = await asyncio.to_thread(ch.get_fingerprint_trends, tenant_id, hours)
    return {"tenant_id": tenant_id, "hours": hours, "items": rows}
