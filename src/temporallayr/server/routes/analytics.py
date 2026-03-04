"""Analytics-specific API routes backed by ClickHouse."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from temporallayr.core.store_clickhouse import get_clickhouse_store
from temporallayr.server.auth import verify_api_key
from temporallayr.workers.clickhouse_worker import get_clickhouse_worker

router = APIRouter(tags=["analytics"])


@router.get("/analytics/p50")
async def get_latency_percentile_rollup(
    tenant_id: str = Depends(verify_api_key),
    hours: int = 24,
    limit: int = 200,
    offset: int = 0,
) -> dict[str, Any]:
    ch = get_clickhouse_store()
    if ch is None:
        raise HTTPException(
            status_code=503,
            detail="ClickHouse not configured. Set TEMPORALLAYR_CLICKHOUSE_HOST.",
        )

    items: list[dict[str, Any]] = list(ch.get_latency_percentiles(tenant_id, hours=hours))
    page: list[dict[str, Any]] = list(items[offset : offset + limit])

    summary = {
        "p50_ms": round(_mean(page, "p50_ms"), 2),
        "p95_ms": round(_mean(page, "p95_ms"), 2),
        "p99_ms": round(_mean(page, "p99_ms"), 2),
        "avg_ms": round(_mean(page, "avg_ms"), 2),
        "error_rate_pct": round(_mean(page, "error_rate_pct"), 2),
        "span_groups": len(page),
        "calls": sum(int(row.get("call_count", 0)) for row in page),
    }

    return {
        "items": page,
        "total": len(items),
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < len(items),
        "summary": summary,
    }


@router.get("/_internal/clickhouse/health", tags=["ops"])
async def clickhouse_health() -> dict[str, Any]:
    ch = get_clickhouse_store()
    worker = get_clickhouse_worker()

    payload: dict[str, Any] = {
        "enabled": ch is not None,
        "status": "disabled",
        "clickhouse": None,
        "worker": worker.health() if worker else {"running": False},
    }

    if ch is None:
        return payload

    try:
        ch_status = await asyncio.to_thread(ch.health)
        payload["status"] = ch_status.get("status", "unknown")
        payload["clickhouse"] = ch_status
    except Exception as exc:  # noqa: BLE001
        payload["status"] = "degraded"
        payload["clickhouse"] = str(exc)

    return payload


def _mean(rows: list[dict[str, Any]], field: str) -> float:
    if not rows:
        return 0.0
    values = [float(row.get(field, 0) or 0) for row in rows]
    return sum(values) / len(values)
