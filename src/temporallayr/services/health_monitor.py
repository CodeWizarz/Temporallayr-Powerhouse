"""
Service health monitoring logic.
Performs periodic checks on API, Redis, ClickHouse, and Workers.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import UTC, datetime
from typing import Any

from temporallayr.core import metrics
from temporallayr.core.queue import get_redis_client
from temporallayr.core.store_clickhouse import get_clickhouse_store

logger = logging.getLogger(__name__)


class HealthMonitor:
    def __init__(self):
        self._last_results: dict[str, Any] = {}
        self._lock = asyncio.Lock()

    async def check_all(self) -> dict[str, Any]:
        """Run all health checks and return results."""
        results = {
            "api": await self.check_api(),
            "redis": await self.check_redis(),
            "clickhouse": await self.check_clickhouse(),
            "worker_queue": await self.check_worker_queue(),
            "timestamp": datetime.now(UTC).isoformat(),
        }
        async with self._lock:
            self._last_results = results
        return results

    async def check_api(self) -> dict[str, Any]:
        t0 = time.time()
        # Basic check — if we're running this, API is somewhat alive
        latency = (time.time() - t0) * 1000
        return {"status": "ok", "latency_ms": round(latency, 2)}

    async def check_redis(self) -> dict[str, Any]:
        t0 = time.time()
        client = get_redis_client()
        if not client:
            return {"status": "unconfigured", "latency_ms": 0}
        try:
            await client.ping()  # type: ignore[misc]
            latency = (time.time() - t0) * 1000
            return {"status": "ok", "latency_ms": round(latency, 2)}
        except Exception as e:
            return {"status": "down", "error": str(e), "latency_ms": 0}
        finally:
            await client.aclose()

    async def check_clickhouse(self) -> dict[str, Any]:
        t0 = time.time()
        ch = get_clickhouse_store()
        if not ch:
            return {"status": "unconfigured", "latency_ms": 0}
        try:
            # Simple probe
            await asyncio.to_thread(ch._get_client().command, "SELECT 1")
            latency = (time.time() - t0) * 1000
            return {"status": "ok", "latency_ms": round(latency, 2)}
        except Exception as e:
            return {"status": "degraded", "error": str(e), "latency_ms": 0}

    async def check_worker_queue(self) -> dict[str, Any]:
        t0 = time.time()
        client = get_redis_client()
        if not client:
            return {"status": "unconfigured", "latency_ms": 0}
        try:
            size: int = await client.llen("temporallayr:ingest_queue")  # type: ignore[misc]
            latency = (time.time() - t0) * 1000
            status = "ok" if size < 10000 else "backlogged"
            return {"status": status, "queue_size": size, "latency_ms": round(latency, 2)}
        except Exception as e:
            return {"status": "unknown", "error": str(e), "latency_ms": 0}
        finally:
            await client.aclose()

    def get_latest(self) -> dict[str, Any]:
        return self._last_results

    async def run_forever(self, interval: int = 60) -> None:
        """Background loop to update health metrics."""
        logger.info("Health monitoring loop started", extra={"interval": interval})
        while True:
            try:
                results = await self.check_all()

                # Update metrics
                metrics.queue_size.set(results.get("worker_queue", {}).get("queue_size", 0))

                # Persist to ClickHouse if available
                ch = get_clickhouse_store()
                if ch:
                    for service, data in results.items():
                        if service in ["api", "redis", "clickhouse", "worker_queue"]:
                            try:
                                await asyncio.to_thread(
                                    ch.insert_uptime_event,
                                    service,
                                    data.get("status", "unknown"),
                                    data.get("latency_ms", 0.0),
                                )
                            except Exception as e:
                                logger.warning(
                                    f"Failed to persist uptime event for {service}",
                                    extra={"error": str(e)},
                                )

            except Exception as e:
                logger.error("Health monitor loop error", extra={"error": str(e)})

            await asyncio.sleep(interval)


# Global instance
monitor = HealthMonitor()
_monitor_task: asyncio.Task | None = None


def start_monitoring(interval: int = 60) -> None:
    global _monitor_task
    if _monitor_task is None:
        _monitor_task = asyncio.create_task(monitor.run_forever(interval))


def stop_monitoring() -> None:
    global _monitor_task
    if _monitor_task:
        _monitor_task.cancel()
        _monitor_task = None
