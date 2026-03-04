"""
Status and health check API routes.

Provides /status endpoint with service health, uptime, and component status.
"""

from __future__ import annotations

import asyncio
import os
import platform
import sys
from collections import deque
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter

try:
    from importlib.metadata import version

    temporallayr_version: str = version("temporallayr")
except Exception:
    temporallayr_version = "0.2.1"

from temporallayr.core.store import get_default_store
from temporallayr.core.store_clickhouse import get_clickhouse_store
from temporallayr.monitoring.prometheus import get_uptime_human, get_uptime_seconds

router = APIRouter(tags=["ops"])

_uptime_history: deque[dict[str, Any]] = deque(maxlen=60)


def _record_health(check_time: str, status: str) -> None:
    """Record a health check result in the rolling window."""
    _uptime_history.append({"time": check_time, "status": status})


async def _check_sqlite_health() -> dict[str, Any]:
    """Check SQLite/Default store health."""
    try:
        store = get_default_store()
        store.list_executions("__probe__")
        return {"status": "ok", "type": "sqlite"}
    except Exception as e:
        return {"status": "error", "type": "sqlite", "error": str(e)}


async def _check_clickhouse_health() -> dict[str, Any] | None:
    """Check ClickHouse health if configured."""
    ch = get_clickhouse_store()
    if ch is None:
        return None
    try:
        await asyncio.to_thread(ch._get_client().command, "SELECT 1")
        return {"status": "ok", "type": "clickhouse", "host": ch._host}
    except Exception as e:
        return {"status": "error", "type": "clickhouse", "host": ch._host, "error": str(e)}


async def _check_redis_health() -> dict[str, Any] | None:
    """Check Redis health if configured."""
    redis_url = os.getenv("TEMPORALLAYR_REDIS_URL")
    if not redis_url:
        return None
    try:
        from temporallayr.core.queue import get_redis_client

        redis = get_redis_client()
        if redis:
            redis.ping()
            return {"status": "ok", "type": "redis"}
    except Exception as e:
        return {"status": "error", "type": "redis", "error": str(e)}
    return None


@router.get("/status")
async def get_status() -> dict[str, Any]:
    """
    Get service status including uptime, version, and component health.

    Returns:
        JSON with uptime, version, python version, platform, and component health.
    """
    now = datetime.now(UTC)
    check_time = now.isoformat()

    sqlite_health = await _check_sqlite_health()
    ch_health = await _check_clickhouse_health()
    redis_health = await _check_redis_health()

    components = {"sqlite": sqlite_health}
    if ch_health:
        components["clickhouse"] = ch_health
    if redis_health:
        components["redis"] = redis_health

    overall_status = "ok"
    if any(c.get("status") == "error" for c in components.values()):
        overall_status = "degraded"

    _record_health(check_time, overall_status)

    return {
        "status": overall_status,
        "version": temporallayr_version,
        "uptime_seconds": round(get_uptime_seconds(), 2),
        "uptime_human": get_uptime_human(),
        "started_at": now.isoformat(),
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "platform": platform.system(),
        "components": components,
        "metrics": "/metrics",
    }


@router.get("/status/history")
async def get_status_history() -> dict[str, Any]:
    """Get recent health check history for uptime visualization."""
    return {
        "history": list(_uptime_history),
        "max_points": 60,
    }
