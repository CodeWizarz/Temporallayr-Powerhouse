"""Asyncpg-backed PostgreSQL store used as a drop-in execution store."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
from collections.abc import Coroutine
from concurrent.futures import Future
from datetime import datetime
from typing import Any, TypeVar, cast

from temporallayr.core.store import ExecutionStore
from temporallayr.models.execution import ExecutionGraph

logger = logging.getLogger(__name__)

T = TypeVar("T")

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id        TEXT PRIMARY KEY,
    metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS traces (
    trace_id         TEXT PRIMARY KEY,
    tenant_id        TEXT NOT NULL,
    fingerprint      TEXT,
    trace_payload    JSONB NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_traces_tenant_created
    ON traces (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_fingerprint
    ON traces (fingerprint);

CREATE TABLE IF NOT EXISTS spans (
    id               BIGSERIAL PRIMARY KEY,
    trace_id         TEXT NOT NULL,
    tenant_id        TEXT NOT NULL,
    span_id          TEXT NOT NULL,
    parent_span_id   TEXT,
    name             TEXT NOT NULL,
    start_time       TIMESTAMPTZ,
    end_time         TIMESTAMPTZ,
    status           TEXT,
    error            TEXT,
    attributes       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (trace_id) REFERENCES traces(trace_id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE (trace_id, span_id)
);

CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans (trace_id);
CREATE INDEX IF NOT EXISTS idx_spans_tenant_time ON spans (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quotas (
    tenant_id        TEXT PRIMARY KEY,
    daily_spans_limit BIGINT NOT NULL DEFAULT 100000,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
    id               BIGSERIAL PRIMARY KEY,
    event_type       TEXT NOT NULL,
    tenant_id        TEXT,
    payload          JSONB NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
    incident_id      TEXT PRIMARY KEY,
    tenant_id        TEXT NOT NULL,
    data             JSONB NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents (tenant_id, updated_at DESC);
"""


def normalize_database_url(database_url: str) -> str:
    """Normalize postgres URL formats used by Neon and testcontainers."""
    if database_url.startswith("postgres://"):
        return "postgresql://" + database_url[len("postgres://") :]
    return database_url


def resolve_database_url(explicit: str | None = None) -> str:
    """Resolve database URL from explicit arg, DATABASE_URL, or legacy env var."""
    value = explicit or os.getenv("DATABASE_URL") or os.getenv("TEMPORALLAYR_POSTGRES_DSN")
    if not value:
        raise ValueError("DATABASE_URL or TEMPORALLAYR_POSTGRES_DSN must be set for PostgresStore")
    return normalize_database_url(value)


class _AsyncLoopRunner:
    """Dedicated event loop thread for asyncpg operations from sync callsites."""

    def __init__(self) -> None:
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(
            target=self._run,
            name="TemporalLayrPostgresStoreLoop",
            daemon=True,
        )
        self._thread.start()

    def _run(self) -> None:
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    def run(self, coro: Coroutine[Any, Any, T]) -> T:
        future: Future[T] = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future.result()

    def close(self) -> None:
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._thread.join(timeout=5)


class PostgresStore(ExecutionStore):
    """Drop-in execution store implemented on top of asyncpg."""

    def __init__(
        self,
        dsn: str | None = None,
        min_pool_size: int = 1,
        max_pool_size: int = 10,
        auto_initialize_schema: bool = True,
    ) -> None:
        self._dsn = resolve_database_url(dsn)
        self._min_pool_size = min_pool_size
        self._max_pool_size = max_pool_size
        self._runner = _AsyncLoopRunner()
        self._pool: Any | None = None

        if auto_initialize_schema:
            self.initialize_schema()

    def _run_sync(self, coro: Coroutine[Any, Any, T]) -> T:
        return self._runner.run(coro)

    async def _ensure_pool(self) -> Any:
        if self._pool is not None:
            return self._pool

        try:
            import asyncpg  # type: ignore[import-untyped]
        except ImportError as exc:
            raise RuntimeError(
                "asyncpg not installed. Install dependencies with `pip install -e .[postgres]`."
            ) from exc

        self._pool = await asyncpg.create_pool(
            dsn=self._dsn,
            min_size=self._min_pool_size,
            max_size=self._max_pool_size,
        )
        return self._pool

    def initialize_schema(self) -> None:
        self._run_sync(self.initialize_schema_async())

    async def initialize_schema_async(self) -> None:
        pool = await self._ensure_pool()
        async with pool.acquire() as conn:
            await conn.execute(_SCHEMA_SQL)

    async def _ensure_tenant(self, tenant_id: str) -> None:
        pool = await self._ensure_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO tenants (tenant_id)
                VALUES ($1)
                ON CONFLICT (tenant_id) DO NOTHING
                """,
                tenant_id,
            )

    def save_execution(self, graph: ExecutionGraph) -> None:
        self._run_sync(self.save_execution_async(graph))

    async def save_execution_async(self, graph: ExecutionGraph) -> None:
        from temporallayr.core.fingerprint import Fingerprinter

        await self._ensure_tenant(graph.tenant_id)

        try:
            fingerprint = Fingerprinter.fingerprint_execution(graph)["fingerprint"]
        except Exception:
            fingerprint = None

        pool = await self._ensure_pool()
        trace_payload = json.dumps(graph.model_dump(mode="json"))
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    """
                    INSERT INTO traces (trace_id, tenant_id, fingerprint, trace_payload, updated_at)
                    VALUES ($1, $2, $3, $4::jsonb, NOW())
                    ON CONFLICT (trace_id) DO UPDATE
                      SET tenant_id = EXCLUDED.tenant_id,
                          fingerprint = EXCLUDED.fingerprint,
                          trace_payload = EXCLUDED.trace_payload,
                          updated_at = NOW()
                    """,
                    graph.trace_id,
                    graph.tenant_id,
                    fingerprint,
                    trace_payload,
                )

                await conn.execute(
                    "DELETE FROM spans WHERE trace_id = $1 AND tenant_id = $2",
                    graph.trace_id,
                    graph.tenant_id,
                )

                if graph.spans:
                    await conn.executemany(
                        """
                        INSERT INTO spans (
                            trace_id,
                            tenant_id,
                            span_id,
                            parent_span_id,
                            name,
                            start_time,
                            end_time,
                            status,
                            error,
                            attributes
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
                        """,
                        [
                            (
                                graph.trace_id,
                                graph.tenant_id,
                                span.span_id,
                                span.parent_span_id,
                                span.name,
                                span.start_time,
                                span.end_time,
                                span.status,
                                span.error,
                                json.dumps(span.attributes),
                            )
                            for span in graph.spans
                        ],
                    )

    def bulk_save_executions(self, graphs: list[ExecutionGraph]) -> None:
        self._run_sync(self.bulk_save_executions_async(graphs))

    async def bulk_save_executions_async(self, graphs: list[ExecutionGraph]) -> None:
        if not graphs:
            return
        for graph in graphs:
            await self.save_execution_async(graph)

    def load_execution(self, graph_id: str, tenant_id: str) -> ExecutionGraph:
        return self._run_sync(self.load_execution_async(graph_id, tenant_id))

    async def load_execution_async(self, graph_id: str, tenant_id: str) -> ExecutionGraph:
        pool = await self._ensure_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT trace_payload
                FROM traces
                WHERE trace_id = $1 AND tenant_id = $2
                """,
                graph_id,
                tenant_id,
            )

        if row is None:
            raise FileNotFoundError(f"Execution '{graph_id}' not found for tenant '{tenant_id}'")

        payload = cast(dict[str, Any] | str, row["trace_payload"])
        if isinstance(payload, str):
            return ExecutionGraph.model_validate_json(payload)
        return ExecutionGraph.model_validate(payload)

    def list_executions(self, tenant_id: str, limit: int = 1000, offset: int = 0) -> list[str]:
        return self._run_sync(self.list_executions_async(tenant_id, limit=limit, offset=offset))

    async def list_executions_async(
        self, tenant_id: str, limit: int = 1000, offset: int = 0
    ) -> list[str]:
        pool = await self._ensure_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT trace_id
                FROM traces
                WHERE tenant_id = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                """,
                tenant_id,
                limit,
                offset,
            )
        return [cast(str, row["trace_id"]) for row in rows]

    def delete_old_executions(self, cutoff: datetime) -> int:
        return self._run_sync(self.delete_old_executions_async(cutoff))

    async def delete_old_executions_async(self, cutoff: datetime) -> int:
        pool = await self._ensure_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                DELETE FROM traces
                WHERE created_at < $1
                RETURNING trace_id
                """,
                cutoff,
            )
        return len(rows)

    def save_incident(self, incident: dict[str, Any]) -> None:
        self._run_sync(self.save_incident_async(incident))

    async def save_incident_async(self, incident: dict[str, Any]) -> None:
        tenant_id = str(incident.get("tenant_id", "default"))
        await self._ensure_tenant(tenant_id)

        pool = await self._ensure_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO incidents (incident_id, tenant_id, data, updated_at)
                VALUES ($1, $2, $3::jsonb, NOW())
                ON CONFLICT (incident_id) DO UPDATE
                  SET data = EXCLUDED.data,
                      tenant_id = EXCLUDED.tenant_id,
                      updated_at = NOW()
                """,
                str(incident["incident_id"]),
                tenant_id,
                json.dumps(incident),
            )

    def bulk_save_incidents(self, incidents: list[dict[str, Any]]) -> None:
        self._run_sync(self.bulk_save_incidents_async(incidents))

    async def bulk_save_incidents_async(self, incidents: list[dict[str, Any]]) -> None:
        for incident in incidents:
            await self.save_incident_async(incident)

    def load_incidents(self, tenant_id: str) -> list[dict[str, Any]]:
        return self._run_sync(self.load_incidents_async(tenant_id))

    async def load_incidents_async(self, tenant_id: str) -> list[dict[str, Any]]:
        pool = await self._ensure_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT data
                FROM incidents
                WHERE tenant_id = $1
                ORDER BY updated_at DESC
                """,
                tenant_id,
            )
        return [cast(dict[str, Any], row["data"]) for row in rows]

    def load_all_incidents(self) -> list[dict[str, Any]]:
        return self._run_sync(self.load_all_incidents_async())

    async def load_all_incidents_async(self) -> list[dict[str, Any]]:
        pool = await self._ensure_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT data FROM incidents ORDER BY updated_at DESC")
        return [cast(dict[str, Any], row["data"]) for row in rows]

    def append_audit_log(
        self, event_type: str, payload: dict[str, Any], tenant_id: str | None
    ) -> None:
        self._run_sync(self.append_audit_log_async(event_type, payload, tenant_id))

    async def append_audit_log_async(
        self,
        event_type: str,
        payload: dict[str, Any],
        tenant_id: str | None,
    ) -> None:
        pool = await self._ensure_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO audit_log (event_type, tenant_id, payload)
                VALUES ($1, $2, $3::jsonb)
                """,
                event_type,
                tenant_id,
                json.dumps(payload),
            )

    def close(self) -> None:
        self._run_sync(self.close_async())
        self._runner.close()

    async def close_async(self) -> None:
        if self._pool is None:
            return
        await self._pool.close()
        self._pool = None
