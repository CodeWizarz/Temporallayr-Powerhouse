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


@router.get("/latency/rolling")
async def rolling_averages(
    hours: int = Query(168, ge=1, le=8760),
    window_hours: int = Query(24, ge=1, le=168),
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Rolling averages of latency metrics over time windows."""
    ch = _require_ch()
    import asyncio

    rows = await asyncio.to_thread(ch.get_rolling_averages, tenant_id, hours, window_hours)
    return {"tenant_id": tenant_id, "hours": hours, "window_hours": window_hours, "items": rows}


@router.get("/latency/distribution")
async def latency_distribution(
    hours: int = Query(24, ge=1, le=8760),
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Get detailed latency distribution (min, p01, p05, p25, p50, p75, p95, p99, max)."""
    ch = _require_ch()
    import asyncio

    rows = await asyncio.to_thread(ch.get_trace_duration_distribution, tenant_id, hours)
    return {"tenant_id": tenant_id, "hours": hours, "items": rows}


@router.get("/anomalies")
async def anomaly_detection(
    hours: int = Query(168, ge=1, le=8760),
    threshold: float = Query(3.0, ge=1.0, le=10.0),
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Detect anomalies in latency patterns using statistical methods."""
    ch = _require_ch()
    import asyncio

    rows = await asyncio.to_thread(ch.get_anomaly_detection, tenant_id, hours, threshold)
    return {"tenant_id": tenant_id, "hours": hours, "threshold": threshold, "items": rows}


@router.get("/capacity")
async def capacity_planning(
    days: int = Query(30, ge=1, le=365),
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Capacity planning metrics - daily volumes, peak times, growth trends."""
    ch = _require_ch()
    import asyncio

    rows = await asyncio.to_thread(ch.get_capacity_planning, tenant_id, days)
    return {"tenant_id": tenant_id, "days": days, "items": rows}


@router.get("/peak-hours")
async def peak_usage_hours(
    days: int = Query(7, ge=1, le=30),
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Identify peak usage hours for capacity planning."""
    ch = _require_ch()
    import asyncio

    rows = await asyncio.to_thread(ch.get_peak_usage_hours, tenant_id, days)
    return {"tenant_id": tenant_id, "days": days, "items": rows}


@router.get("/errors/by-fingerprint")
async def errors_by_fingerprint(
    hours: int = Query(24, ge=1, le=8760),
    min_count: int = Query(10, ge=1, le=1000),
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Get error rates grouped by fingerprint, sorted by severity."""
    ch = _require_ch()
    import asyncio

    rows = await asyncio.to_thread(ch.get_error_rate_by_fingerprint, tenant_id, hours, min_count)
    return {"tenant_id": tenant_id, "hours": hours, "min_count": min_count, "items": rows}


@router.get("/trace/{trace_id}")
async def trace_execution_flow(
    trace_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Get detailed execution flow for a specific trace."""
    ch = _require_ch()
    import asyncio

    rows = await asyncio.to_thread(ch.get_trace_execution_flow, tenant_id, trace_id)
    return {"tenant_id": tenant_id, "trace_id": trace_id, "spans": rows}
