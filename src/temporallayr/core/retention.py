"""
Data retention background job.
Runs every 6 hours via asyncio task started in server lifespan.
Deletes executions + audit log entries older than TEMPORALLAYR_RETENTION_DAYS.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import UTC, datetime, timedelta

logger = logging.getLogger(__name__)

_retention_task: asyncio.Task | None = None


def _get_retention_days() -> int:
    return int(os.getenv("TEMPORALLAYR_RETENTION_DAYS", "30"))


async def run_retention_once() -> dict[str, int]:
    """Run one retention sweep. Returns counts of deleted records."""
    days = _get_retention_days()
    cutoff = datetime.now(UTC) - timedelta(days=days)
    deleted: dict[str, int] = {}

    # SQLite store retention
    try:
        from temporallayr.core.store_sqlite import SQLiteStore

        store = SQLiteStore()
        n = store.delete_old_executions(cutoff)
        deleted["sqlite_executions"] = n
        logger.info(
            "Retention: deleted old SQLite executions",
            extra={"count": n, "cutoff": cutoff.isoformat()},
        )
    except Exception as e:
        logger.warning("Retention SQLite failed", extra={"error": str(e)})

    # Postgres store retention
    postgres_dsn = os.getenv("TEMPORALLAYR_POSTGRES_DSN")
    if postgres_dsn:
        try:
            from temporallayr.core.store_postgres import PostgresStore

            store_pg = PostgresStore()
            n = store_pg.delete_old_executions(cutoff)
            deleted["postgres_executions"] = n
            logger.info("Retention: deleted old Postgres executions", extra={"count": n})
        except Exception as e:
            logger.warning("Retention Postgres failed", extra={"error": str(e)})

    # Quota usage purge (keep 90 days of stats)
    try:
        from temporallayr.core.quotas import purge_old_usage

        n = purge_old_usage(days_to_keep=90)
        deleted["quota_records"] = n
    except Exception as e:
        logger.warning("Retention quota purge failed", extra={"error": str(e)})

    return deleted


async def _retention_loop() -> None:
    """Background loop — runs every 6 hours."""
    while True:
        try:
            await asyncio.sleep(6 * 3600)
            logger.info("Running scheduled data retention sweep")
            result = await run_retention_once()
            logger.info("Retention sweep complete", extra=result)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Retention loop error", extra={"error": str(e)})


def start_retention_job() -> asyncio.Task:
    global _retention_task
    _retention_task = asyncio.create_task(_retention_loop())
    logger.info(f"Data retention job started (policy: {_get_retention_days()} days)")
    return _retention_task


def stop_retention_job() -> None:
    if _retention_task and not _retention_task.done():
        _retention_task.cancel()
