"""Server lifespan hooks with explicit async startup and shutdown behavior."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

logger = logging.getLogger(__name__)


@asynccontextmanager
async def server_lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Initialize and tear down server resources without blocking exits."""
    from temporallayr.config import get_config
    from temporallayr.core.logging import configure_logging
    from temporallayr.core.otel_exporter import get_otlp_exporter
    from temporallayr.core.retention import start_retention_job, stop_retention_job
    from temporallayr.core.store_clickhouse import get_clickhouse_store

    cfg = get_config()
    configure_logging(cfg.log_level)
    logger.info("TemporalLayr server starting", extra={"log_level": cfg.log_level})

    ch = get_clickhouse_store()
    if ch is not None:
        try:
            await asyncio.to_thread(ch.initialize_schema)
            logger.info("ClickHouse schema ready")
        except Exception as exc:
            logger.exception("ClickHouse schema initialization failed")
            raise RuntimeError("ClickHouse schema initialization failed") from exc

    if cfg.postgres_dsn:
        try:
            from temporallayr.core.store_postgres import init_schema

            await init_schema()
            logger.info("PostgreSQL schema ready")
        except Exception as exc:
            logger.exception("PostgreSQL schema initialization failed")
            raise RuntimeError("PostgreSQL schema initialization failed") from exc

    otlp = get_otlp_exporter()
    if otlp is not None:
        logger.info("OTLP export enabled", extra={"endpoint": otlp.endpoint})

    start_retention_job()
    logger.info("Data retention job started")

    try:
        yield
    finally:
        stop_retention_job()
        logger.info("TemporalLayr server shutting down")
