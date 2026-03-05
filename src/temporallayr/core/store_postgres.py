"""
PostgreSQL async store — production backend.
Uses asyncpg directly (no ORM, full control).

Set TEMPORALLAYR_POSTGRES_DSN=postgresql://user:pass@host/db
and the server auto-selects this over SQLite.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from temporallayr.core.store import ExecutionStore
from temporallayr.models.execution import ExecutionGraph

logger = logging.getLogger(__name__)

_pool = None  # asyncpg pool, initialised lazily


async def _get_pool():
    global _pool
    if _pool is None:
        try:
            import asyncpg  # type: ignore[import-untyped]
        except ImportError as exc:
            raise RuntimeError(
                "asyncpg not installed. Run: pip install temporallayr[postgres]"
            ) from exc
        import os

        dsn = os.environ["TEMPORALLAYR_POSTGRES_DSN"]
        _pool = await asyncpg.create_pool(dsn, min_size=2, max_size=10)
        logger.info("PostgreSQL connection pool created")
    return _pool


_SCHEMA = """
CREATE TABLE IF NOT EXISTS executions (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    fingerprint TEXT,
    data        JSONB NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exec_tenant ON executions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_exec_fp     ON executions (fingerprint);
CREATE INDEX IF NOT EXISTS idx_exec_time   ON executions (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS api_keys (
    id          TEXT PRIMARY KEY,
    key_hash    TEXT NOT NULL UNIQUE,
    tenant_id   TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
    incident_id TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    data        JSONB NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inc_tenant ON incidents (tenant_id);

CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ DEFAULT NOW(),
    event_type  TEXT NOT NULL,
    tenant_id   TEXT,
    payload     JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log (timestamp DESC);
"""


async def init_schema() -> None:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(_SCHEMA)
    logger.info("PostgreSQL schema initialised")


class PostgresStore(ExecutionStore):
    """
    Async-native PostgreSQL store.
    Note: save_execution() is intentionally sync-compatible via asyncio.run_coroutine_threadsafe
    but the server should call save_execution_async() directly for best performance.
    """

    def __init__(self, dsn: str | None = None) -> None:
        if dsn is not None:
            import os

            os.environ["TEMPORALLAYR_POSTGRES_DSN"] = dsn

    # ── Executions ──────────────────────────────────────────────────

    def save_execution(self, graph: ExecutionGraph) -> None:
        """Sync wrapper — runs async version in event loop. Use save_execution_async() in async contexts."""
        import asyncio

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're inside an async context (FastAPI) — schedule as task
                asyncio.create_task(self.save_execution_async(graph))
            else:
                loop.run_until_complete(self.save_execution_async(graph))
        except Exception as e:
            logger.warning("PostgreSQL save_execution failed", extra={"error": str(e)})

    def bulk_save_executions(self, graphs: list[ExecutionGraph]) -> None:
        import asyncio

        if not graphs:
            return

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(self._bulk_save_executions_async(graphs))
            else:
                loop.run_until_complete(self._bulk_save_executions_async(graphs))
        except Exception as e:
            logger.warning("PostgreSQL bulk_save_executions failed", extra={"error": str(e)})

    async def _bulk_save_executions_async(self, graphs: list[ExecutionGraph]) -> None:
        for graph in graphs:
            await self.save_execution_async(graph)

    async def save_execution_async(self, graph: ExecutionGraph) -> None:
        from temporallayr.core.fingerprint import Fingerprinter

        try:
            fp = Fingerprinter.fingerprint_execution(graph)["fingerprint"]
        except Exception:
            fp = None

        pool = await _get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO executions (id, tenant_id, fingerprint, data)
                VALUES ($1, $2, $3, $4::jsonb)
                ON CONFLICT (id) DO UPDATE
                  SET fingerprint = EXCLUDED.fingerprint,
                      data = EXCLUDED.data
                """,
                graph.id,
                graph.tenant_id,
                fp,
                graph.model_dump_json(),
            )

    def load_execution(self, graph_id: str, tenant_id: str) -> ExecutionGraph:
        import asyncio

        return asyncio.get_event_loop().run_until_complete(
            self.load_execution_async(graph_id, tenant_id)
        )

    async def load_execution_async(self, graph_id: str, tenant_id: str) -> ExecutionGraph:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT data FROM executions WHERE id = $1 AND tenant_id = $2",
                graph_id,
                tenant_id,
            )
        if row is None:
            raise FileNotFoundError(f"Execution '{graph_id}' not found for tenant '{tenant_id}'")
        return ExecutionGraph.model_validate_json(json.dumps(dict(row["data"])))

    def list_executions(self, tenant_id: str, limit: int = 1000, offset: int = 0) -> list[str]:
        import asyncio

        return asyncio.get_event_loop().run_until_complete(
            self.list_executions_async(tenant_id, limit, offset)
        )

    async def list_executions_async(
        self, tenant_id: str, limit: int = 50, offset: int = 0
    ) -> list[str]:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT id FROM executions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                tenant_id,
                limit,
                offset,
            )
        return [r["id"] for r in rows]

    def delete_old_executions(self, cutoff: datetime) -> int:
        import asyncio

        return asyncio.get_event_loop().run_until_complete(self._delete_old_async(cutoff))

    async def _delete_old_async(self, cutoff: datetime) -> int:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute("DELETE FROM executions WHERE created_at < $1", cutoff)
        return int(result.split()[-1])

    # ── Incidents ────────────────────────────────────────────────────

    def save_incident(self, incident: dict[str, Any]) -> None:
        import asyncio

        try:
            asyncio.create_task(self._save_incident_async(incident))
        except RuntimeError:
            asyncio.get_event_loop().run_until_complete(self._save_incident_async(incident))

    async def _save_incident_async(self, incident: dict[str, Any]) -> None:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO incidents (incident_id, tenant_id, data, updated_at)
                VALUES ($1, $2, $3::jsonb, NOW())
                ON CONFLICT (incident_id) DO UPDATE
                  SET data = EXCLUDED.data, updated_at = NOW()
                """,
                incident["incident_id"],
                incident.get("tenant_id", "default"),
                json.dumps(incident),
            )

    def bulk_save_incidents(self, incidents: list[dict[str, Any]]) -> None:
        import asyncio

        try:
            asyncio.create_task(self._bulk_incidents_async(incidents))
        except RuntimeError:
            asyncio.get_event_loop().run_until_complete(self._bulk_incidents_async(incidents))

    async def _bulk_incidents_async(self, incidents: list[dict[str, Any]]) -> None:
        if not incidents:
            return
        pool = await _get_pool()
        async with pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO incidents (incident_id, tenant_id, data, updated_at)
                VALUES ($1, $2, $3::jsonb, NOW())
                ON CONFLICT (incident_id) DO UPDATE
                  SET data = EXCLUDED.data, updated_at = NOW()
                """,
                [
                    (i["incident_id"], i.get("tenant_id", "default"), json.dumps(i))
                    for i in incidents
                ],
            )

    def load_incidents(self, tenant_id: str) -> list[dict[str, Any]]:
        import asyncio

        return asyncio.get_event_loop().run_until_complete(self._load_incidents_async(tenant_id))

    async def _load_incidents_async(self, tenant_id: str) -> list[dict[str, Any]]:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT data FROM incidents WHERE tenant_id = $1 ORDER BY updated_at DESC",
                tenant_id,
            )
        return [dict(r["data"]) for r in rows]

    def load_all_incidents(self) -> list[dict[str, Any]]:
        import asyncio

        return asyncio.get_event_loop().run_until_complete(self._load_all_incidents_async())

    async def _load_all_incidents_async(self) -> list[dict[str, Any]]:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT data FROM incidents ORDER BY updated_at DESC")
        return [dict(r["data"]) for r in rows]
