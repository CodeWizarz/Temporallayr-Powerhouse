"""
SQLite backend implementation for temporallayr ExecutionStore.
"""

import json
import sqlite3
from datetime import datetime, UTC
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
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT,
                    event_type TEXT,
                    tenant_id TEXT,
                    details TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tenant_quotas (
                    tenant_id TEXT PRIMARY KEY,
                    daily_span_limit INT DEFAULT 100000,
                    monthly_span_limit INT DEFAULT 2000000
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tenant_usage (
                    tenant_id TEXT,
                    date TEXT,
                    span_count INT DEFAULT 0,
                    trace_count INT DEFAULT 0,
                    PRIMARY KEY (tenant_id, date)
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
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs (tenant_id)")
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

    # ── Audit Logs persistence ──────────────────────────────────────────

    def save_audit_log(self, entry: dict[str, Any]) -> None:
        import uuid

        log_id = str(uuid.uuid4())
        timestamp = entry.get("timestamp", datetime.now().isoformat())
        event_type = entry.get("event_type", "unknown")
        tenant_id = entry.get("tenant_id", "unknown")
        details = json.dumps(entry)

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO audit_logs (id, timestamp, event_type, tenant_id, details)
                VALUES (?, ?, ?, ?, ?)
                """,
                (log_id, timestamp, event_type, tenant_id, details),
            )
            conn.commit()

    def query_audit_logs(
        self,
        tenant_id: str | None,
        limit: int = 50,
        offset: int = 0,
        event_type: str | None = None,
        since: str | None = None,
    ) -> tuple[int, list[dict[str, Any]]]:
        conditions = []
        params = []

        if tenant_id is not None:
            conditions.append("tenant_id = ?")
            params.append(tenant_id)

        if event_type is not None:
            conditions.append("event_type = ?")
            params.append(event_type)

        if since is not None:
            conditions.append("timestamp >= ?")
            params.append(since)

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        with self._get_connection() as conn:
            total_query = f"SELECT COUNT(*) FROM audit_logs {where_clause}"
            total_cursor = conn.execute(total_query, params)
            total = total_cursor.fetchone()[0]

            query = f"SELECT details FROM audit_logs {where_clause} ORDER BY timestamp DESC LIMIT ? OFFSET ?"
            cursor = conn.execute(query, params + [limit, offset])

            return total, [json.loads(row["details"]) for row in cursor.fetchall()]

    # ── Quotas and Usage ──────────────────────────────────────────────

    def get_quota(self, tenant_id: str) -> dict[str, int]:
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT daily_span_limit, monthly_span_limit FROM tenant_quotas WHERE tenant_id = ?",
                (tenant_id,),
            )
            row = cursor.fetchone()
            if row:
                return {
                    "daily_span_limit": row["daily_span_limit"],
                    "monthly_span_limit": row["monthly_span_limit"],
                }
            return {"daily_span_limit": 100000, "monthly_span_limit": 2000000}

    def upsert_quota(self, tenant_id: str, daily: int, monthly: int) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO tenant_quotas (tenant_id, daily_span_limit, monthly_span_limit)
                VALUES (?, ?, ?)
                ON CONFLICT(tenant_id) DO UPDATE SET 
                    daily_span_limit = excluded.daily_span_limit,
                    monthly_span_limit = excluded.monthly_span_limit
                """,
                (tenant_id, daily, monthly),
            )
            conn.commit()

    def increment_usage(self, tenant_id: str, spans: int, traces: int) -> None:
        date_str = datetime.now(UTC).strftime("%Y-%m-%d")
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO tenant_usage (tenant_id, date, span_count, trace_count)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(tenant_id, date) DO UPDATE SET 
                    span_count = span_count + excluded.span_count,
                    trace_count = trace_count + excluded.trace_count
                """,
                (tenant_id, date_str, spans, traces),
            )
            conn.commit()

    def get_usage(self, tenant_id: str, date: str) -> dict[str, int]:
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT span_count, trace_count FROM tenant_usage WHERE tenant_id = ? AND date = ?",
                (tenant_id, date),
            )
            row = cursor.fetchone()
            if row:
                return {"span_count": row["span_count"], "trace_count": row["trace_count"]}
            return {"span_count": 0, "trace_count": 0}
