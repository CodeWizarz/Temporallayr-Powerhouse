"""
SQLite backend implementation for temporallayr ExecutionStore.
"""

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from temporallayr.core.store import ExecutionStore
from temporallayr.models.execution import ExecutionGraph


class SQLiteStore(ExecutionStore):
    """
    Production-grade SQLite backend for execution graph persistence.
    Also persists incidents so they survive server restarts.
    """

    BASE_DIR = Path(".temporallayr")
    DB_PATH = BASE_DIR / "executions.db"

    def __init__(self) -> None:
        self.BASE_DIR.mkdir(parents=True, exist_ok=True)
        self._initialize_schema()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def _initialize_schema(self) -> None:
        """Idempotently bootstrap all tables."""
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS executions (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS api_keys (
                    id TEXT PRIMARY KEY,
                    key_hash TEXT NOT NULL UNIQUE,
                    tenant_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS incidents (
                    incident_id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    data TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            for alter in [
                "ALTER TABLE executions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'",
                "ALTER TABLE executions ADD COLUMN fingerprint TEXT",
            ]:
                try:
                    conn.execute(alter)
                except sqlite3.OperationalError:
                    pass

            conn.execute("CREATE INDEX IF NOT EXISTS idx_tenant_id ON executions (tenant_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_fingerprint ON executions (fingerprint)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_inc_tenant ON incidents (tenant_id)")
            conn.commit()

    # ── Execution CRUD ─────────────────────────────────────────────────

    def save_execution(self, graph: ExecutionGraph) -> None:
        self.bulk_save_executions([graph])

    def bulk_save_executions(self, graphs: list[ExecutionGraph]) -> None:
        if not graphs:
            return

        from temporallayr.core.fingerprint import Fingerprinter

        batch_payloads = []
        for g in graphs:
            fingerprint = Fingerprinter.fingerprint_execution(g)["fingerprint"]
            batch_payloads.append((g.id, g.tenant_id, fingerprint, g.model_dump_json()))

        with self._get_connection() as conn:
            conn.executemany(
                """
                INSERT OR REPLACE INTO executions (id, tenant_id, fingerprint, data)
                VALUES (?, ?, ?, ?)
                """,
                batch_payloads,
            )
            conn.commit()

    def load_execution(self, graph_id: str, tenant_id: str) -> ExecutionGraph:
        path = Path(graph_id)
        if path.exists() and path.is_file():
            content = path.read_text(encoding="utf-8")
            graph = ExecutionGraph.model_validate_json(content)
            if graph.tenant_id != tenant_id:
                raise FileNotFoundError(f"Execution not found for tenant {tenant_id}")
            return graph

        clean_id = graph_id.removesuffix(".json")

        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT data FROM executions WHERE id = ? AND tenant_id = ?",
                (clean_id, tenant_id),
            )
            row = cursor.fetchone()

        if row is None:
            raise FileNotFoundError(
                f"Execution graph '{clean_id}' not found for tenant '{tenant_id}'."
            )
        return ExecutionGraph.model_validate_json(row["data"])

    def list_executions(
        self, tenant_id: str, limit: int = 50, offset: int = 0
    ) -> tuple[int, list[str]]:
        with self._get_connection() as conn:
            total_cursor = conn.execute(
                "SELECT COUNT(*) FROM executions WHERE tenant_id = ?", (tenant_id,)
            )
            total = total_cursor.fetchone()[0]

            cursor = conn.execute(
                "SELECT id FROM executions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (tenant_id, limit, offset),
            )
            return total, [row["id"] for row in cursor.fetchall()]

    def delete_old_executions(self, cutoff: datetime) -> int:
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM executions WHERE created_at < ?", (cutoff.isoformat(),)
            )
            conn.commit()
            return cursor.rowcount

    # ── Incident persistence ──────────────────────────────────────────

    def save_incident(self, incident: dict[str, Any]) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO incidents (incident_id, tenant_id, data, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    incident["incident_id"],
                    incident.get("tenant_id", "default"),
                    json.dumps(incident),
                ),
            )
            conn.commit()

    def bulk_save_incidents(self, incidents: list[dict[str, Any]]) -> None:
        if not incidents:
            return
        with self._get_connection() as conn:
            conn.executemany(
                """
                INSERT OR REPLACE INTO incidents (incident_id, tenant_id, data, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """,
                [
                    (inc["incident_id"], inc.get("tenant_id", "default"), json.dumps(inc))
                    for inc in incidents
                ],
            )
            conn.commit()

    def load_incidents(
        self, tenant_id: str, limit: int = 50, offset: int = 0
    ) -> tuple[int, list[dict[str, Any]]]:
        with self._get_connection() as conn:
            total_cursor = conn.execute(
                "SELECT COUNT(*) FROM incidents WHERE tenant_id = ?", (tenant_id,)
            )
            total = total_cursor.fetchone()[0]

            cursor = conn.execute(
                "SELECT data FROM incidents WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                (tenant_id, limit, offset),
            )
            return total, [json.loads(row["data"]) for row in cursor.fetchall()]

    def load_all_incidents(self) -> list[dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT data FROM incidents ORDER BY updated_at DESC")
            return [json.loads(row["data"]) for row in cursor.fetchall()]
