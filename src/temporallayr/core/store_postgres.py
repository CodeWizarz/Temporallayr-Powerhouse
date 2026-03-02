"""
PostgreSQL backend implementation for temporallayr ExecutionStore (asyncpg).
Bridged into the synchronous interface using a background asyncio event loop.
"""

import asyncio
import json
import threading
from datetime import datetime
from typing import Any

from temporallayr.core.store import ExecutionStore
from temporallayr.models.execution import ExecutionGraph


class PostgresStore(ExecutionStore):
    """
    Production-grade PostgreSQL backend for execution graph persistence.
    """

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, args=(self._loop,), daemon=True)
        self._thread.start()
        self._pool = None

        future = asyncio.run_coroutine_threadsafe(self._init_backend(), self._loop)
        future.result()

    def _run_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        asyncio.set_event_loop(loop)
        loop.run_forever()

    async def _init_backend(self) -> None:
        import asyncpg

        self._pool = await asyncpg.create_pool(self.dsn, min_size=2, max_size=10)
        await self._initialize_schema()

    async def _initialize_schema(self) -> None:
        """Idempotently bootstrap all tables."""
        async with self._pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS executions (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL DEFAULT 'default',
                    fingerprint TEXT,
                    data JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_tenant_id ON executions (tenant_id);
                CREATE INDEX IF NOT EXISTS idx_fingerprint ON executions (fingerprint);
                
                CREATE TABLE IF NOT EXISTS api_keys (
                    id TEXT PRIMARY KEY,
                    key_hash TEXT NOT NULL UNIQUE,
                    tenant_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS incidents (
                    incident_id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    data JSONB NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_inc_tenant ON incidents (tenant_id);
                """)

    def _run_sync(self, coro: Any) -> Any:
        """Run a coroutine blocking in the main thread."""
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future.result()

    # ── Execution CRUD ─────────────────────────────────────────────────

    def save_execution(self, graph: ExecutionGraph) -> None:
        self.bulk_save_executions([graph])

    async def _bulk_save_executions(self, graphs: list[ExecutionGraph]) -> None:
        if not graphs:
            return

        from temporallayr.core.fingerprint import Fingerprinter

        batch_payloads = []
        for g in graphs:
            fingerprint = Fingerprinter.fingerprint_execution(g)["fingerprint"]
            batch_payloads.append((g.id, g.tenant_id, fingerprint, g.model_dump_json()))

        query = """
        INSERT INTO executions (id, tenant_id, fingerprint, data)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (id) DO UPDATE SET 
            tenant_id = EXCLUDED.tenant_id,
            fingerprint = EXCLUDED.fingerprint,
            data = EXCLUDED.data;
        """
        async with self._pool.acquire() as conn:
            await conn.executemany(query, batch_payloads)

    def bulk_save_executions(self, graphs: list[ExecutionGraph]) -> None:
        self._run_sync(self._bulk_save_executions(graphs))

    async def _load_execution(self, clean_id: str, tenant_id: str) -> ExecutionGraph | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT data FROM executions WHERE id = $1 AND tenant_id = $2",
                clean_id,
                tenant_id,
            )
            if row is None:
                return None
            return ExecutionGraph.model_validate_json(row["data"])

    def load_execution(self, graph_id: str, tenant_id: str) -> ExecutionGraph:
        clean_id = graph_id.removesuffix(".json")
        graph = self._run_sync(self._load_execution(clean_id, tenant_id))
        if graph is None:
            raise FileNotFoundError(
                f"Execution graph '{clean_id}' not found for tenant '{tenant_id}'."
            )
        return graph

    async def _list_executions(
        self, tenant_id: str, limit: int = 50, offset: int = 0
    ) -> tuple[int, list[str]]:
        async with self._pool.acquire() as conn:
            total_row = await conn.fetchrow(
                "SELECT COUNT(*) FROM executions WHERE tenant_id = $1", tenant_id
            )
            total = total_row[0]

            rows = await conn.fetch(
                "SELECT id FROM executions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                tenant_id,
                limit,
                offset,
            )
            return total, [row["id"] for row in rows]

    def list_executions(
        self, tenant_id: str, limit: int = 50, offset: int = 0
    ) -> tuple[int, list[str]]:
        return self._run_sync(self._list_executions(tenant_id, limit, offset))

    async def _delete_old_executions(self, cutoff: datetime) -> int:
        async with self._pool.acquire() as conn:
            result = await conn.execute("DELETE FROM executions WHERE created_at < $1", cutoff)
            # result is of format "DELETE N"
            return int(result.split(" ")[-1])

    def delete_old_executions(self, cutoff: datetime) -> int:
        return self._run_sync(self._delete_old_executions(cutoff))

    # ── Incident persistence ──────────────────────────────────────────

    async def _save_incident(self, incident: dict[str, Any]) -> None:
        query = """
        INSERT INTO incidents (incident_id, tenant_id, data, updated_at)
        VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (incident_id) DO UPDATE SET 
            tenant_id = EXCLUDED.tenant_id,
            data = EXCLUDED.data,
            updated_at = CURRENT_TIMESTAMP;
        """
        async with self._pool.acquire() as conn:
            await conn.execute(
                query,
                incident["incident_id"],
                incident.get("tenant_id", "default"),
                json.dumps(incident),
            )

    def save_incident(self, incident: dict[str, Any]) -> None:
        self._run_sync(self._save_incident(incident))

    async def _bulk_save_incidents(self, incidents: list[dict[str, Any]]) -> None:
        if not incidents:
            return
        query = """
        INSERT INTO incidents (incident_id, tenant_id, data, updated_at)
        VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (incident_id) DO UPDATE SET 
            tenant_id = EXCLUDED.tenant_id,
            data = EXCLUDED.data,
            updated_at = CURRENT_TIMESTAMP;
        """
        batch = [
            (inc["incident_id"], inc.get("tenant_id", "default"), json.dumps(inc))
            for inc in incidents
        ]
        async with self._pool.acquire() as conn:
            await conn.executemany(query, batch)

    def bulk_save_incidents(self, incidents: list[dict[str, Any]]) -> None:
        self._run_sync(self._bulk_save_incidents(incidents))

    async def _load_incidents(
        self, tenant_id: str, limit: int = 50, offset: int = 0
    ) -> tuple[int, list[dict[str, Any]]]:
        async with self._pool.acquire() as conn:
            total_row = await conn.fetchrow(
                "SELECT COUNT(*) FROM incidents WHERE tenant_id = $1", tenant_id
            )
            total = total_row[0]

            rows = await conn.fetch(
                "SELECT data FROM incidents WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3",
                tenant_id,
                limit,
                offset,
            )
            return total, [json.loads(row["data"]) for row in rows]

    def load_incidents(
        self, tenant_id: str, limit: int = 50, offset: int = 0
    ) -> tuple[int, list[dict[str, Any]]]:
        return self._run_sync(self._load_incidents(tenant_id, limit, offset))

    async def _load_all_incidents(self) -> list[dict[str, Any]]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch("SELECT data FROM incidents ORDER BY updated_at DESC")
            return [json.loads(row["data"]) for row in rows]

    def load_all_incidents(self) -> list[dict[str, Any]]:
        return self._run_sync(self._load_all_incidents())
