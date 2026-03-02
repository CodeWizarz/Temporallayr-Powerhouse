"""
ClickHouse analytics store for TemporalLayr.

Complements SQLiteStore (writes/incidents) with OLAP-speed queries for:
  - Failure clustering (replaces Python-memory loop)
  - Latency percentiles per span name
  - Fingerprint frequency trends
  - Cross-tenant analytics

Uses clickhouse-connect (HTTP, no native driver needed).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

# DDL — run once at startup
_CREATE_SPANS_TABLE = """
CREATE TABLE IF NOT EXISTS temporallayr_spans (
    tenant_id       LowCardinality(String),
    trace_id        String,
    span_id         String,
    parent_span_id  Nullable(String),
    name            String,
    start_time      DateTime64(3, 'UTC'),
    end_time        Nullable(DateTime64(3, 'UTC')),
    duration_ms     Nullable(Float64),
    status          LowCardinality(String),
    error           Nullable(String),
    fingerprint     Nullable(String),
    input_keys      Array(String),
    output_type     LowCardinality(String),
    attributes      String   -- full JSON blob for ad-hoc queries
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(start_time))
ORDER BY (tenant_id, trace_id, start_time)
TTL start_time + toIntervalDay(90)
SETTINGS index_granularity = 8192
"""

_CREATE_TRACES_TABLE = """
CREATE TABLE IF NOT EXISTS temporallayr_traces (
    tenant_id    LowCardinality(String),
    trace_id     String,
    start_time   DateTime64(3, 'UTC'),
    end_time     Nullable(DateTime64(3, 'UTC')),
    span_count   UInt32,
    error_count  UInt32,
    fingerprint  Nullable(String)
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(start_time))
ORDER BY (tenant_id, start_time)
TTL start_time + toIntervalDay(90)
"""

# ── Queries ───────────────────────────────────────────────────────────

_FAILURE_CLUSTERS_QUERY = """
SELECT
    fingerprint,
    name                AS failing_span,
    count()             AS failure_count,
    groupArray(trace_id) AS affected_traces,
    min(start_time)     AS first_seen,
    max(start_time)     AS last_seen
FROM temporallayr_spans
WHERE tenant_id = {tenant_id:String}
  AND status = 'error'
  AND start_time >= {since:DateTime64}
GROUP BY fingerprint, name
ORDER BY failure_count DESC
LIMIT {limit:Int32} OFFSET {offset:Int32}
"""

_LATENCY_PERCENTILES_QUERY = """
SELECT
    name,
    count()                                        AS call_count,
    round(quantile(0.50)(duration_ms), 2)          AS p50_ms,
    round(quantile(0.95)(duration_ms), 2)          AS p95_ms,
    round(quantile(0.99)(duration_ms), 2)          AS p99_ms,
    round(avg(duration_ms), 2)                     AS avg_ms,
    countIf(status = 'error')                      AS error_count,
    round(countIf(status='error') / count() * 100, 2) AS error_rate_pct
FROM temporallayr_spans
WHERE tenant_id = {tenant_id:String}
  AND start_time >= {since:DateTime64}
  AND duration_ms IS NOT NULL
GROUP BY name
ORDER BY call_count DESC
LIMIT {limit:Int32} OFFSET {offset:Int32}
"""

_FINGERPRINT_TREND_QUERY = """
SELECT
    toStartOfHour(start_time)  AS hour,
    fingerprint,
    count()                    AS trace_count,
    countIf(error_count > 0)   AS error_trace_count
FROM temporallayr_traces
WHERE tenant_id = {tenant_id:String}
  AND start_time >= {since:DateTime64}
GROUP BY hour, fingerprint
ORDER BY hour ASC, trace_count DESC
LIMIT {limit:Int32} OFFSET {offset:Int32}
"""


class ClickHouseAnalyticsStore:
    """
    Analytics companion to SQLiteStore.
    Write spans via insert_trace(); query via the analytics methods.
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 8123,
        database: str = "default",
        username: str = "default",
        password: str = "",
        secure: bool = False,
    ) -> None:
        self._host = host
        self._port = port
        self._database = database
        self._username = username
        self._password = password
        self._secure = secure
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            try:
                import clickhouse_connect  # type: ignore[import]

                self._client = clickhouse_connect.get_client(
                    host=self._host,
                    port=self._port,
                    database=self._database,
                    username=self._username,
                    password=self._password,
                    secure=self._secure,
                )
            except ImportError:
                raise RuntimeError(
                    "clickhouse-connect not installed. Run: pip install clickhouse-connect"
                )
        return self._client

    def initialize_schema(self) -> None:
        """Create tables if they don't exist. Call once at server startup."""
        client = self._get_client()
        client.command(_CREATE_SPANS_TABLE)
        client.command(_CREATE_TRACES_TABLE)
        logger.info("ClickHouse schema initialized.")

    # ── Write path ────────────────────────────────────────────────────

    def insert_trace(self, graph: Any) -> None:
        """
        Insert all spans from an ExecutionGraph/Trace into ClickHouse.
        'graph' is a Trace/ExecutionGraph instance.
        """
        from temporallayr.core.fingerprint import Fingerprinter

        try:
            fp_data = Fingerprinter.fingerprint_execution(graph)
            fingerprint = fp_data["fingerprint"]
        except Exception:
            fingerprint = None

        span_rows = []
        error_count = 0

        for span in graph.spans:
            attrs = span.attributes if hasattr(span, "attributes") else {}
            input_dict = attrs.get("inputs", {})
            input_keys = sorted(input_dict.keys()) if isinstance(input_dict, dict) else []
            output_val = attrs.get("output", attrs.get("error"))
            output_type = type(output_val).__name__ if output_val is not None else "NoneType"

            has_error = bool(span.error or attrs.get("error"))
            if has_error:
                error_count += 1

            duration_ms: float | None = None
            if span.end_time and span.start_time:
                duration_ms = (span.end_time - span.start_time).total_seconds() * 1000

            span_rows.append(
                [
                    graph.tenant_id,
                    graph.trace_id,
                    span.span_id,
                    span.parent_span_id,
                    span.name,
                    span.start_time,
                    span.end_time,
                    duration_ms,
                    "error" if has_error else "success",
                    str(span.error or attrs.get("error", "")) if has_error else None,
                    fingerprint,
                    input_keys,
                    output_type,
                    json.dumps(attrs),
                ]
            )

        client = self._get_client()

        if span_rows:
            client.insert(
                "temporallayr_spans",
                span_rows,
                column_names=[
                    "tenant_id",
                    "trace_id",
                    "span_id",
                    "parent_span_id",
                    "name",
                    "start_time",
                    "end_time",
                    "duration_ms",
                    "status",
                    "error",
                    "fingerprint",
                    "input_keys",
                    "output_type",
                    "attributes",
                ],
            )

        # Write trace-level summary row
        client.insert(
            "temporallayr_traces",
            [
                [
                    graph.tenant_id,
                    graph.trace_id,
                    graph.start_time,
                    graph.end_time,
                    len(graph.spans),
                    error_count,
                    fingerprint,
                ]
            ],
            column_names=[
                "tenant_id",
                "trace_id",
                "start_time",
                "end_time",
                "span_count",
                "error_count",
                "fingerprint",
            ],
        )

    # ── Analytics queries ─────────────────────────────────────────────

    def get_failure_clusters(
        self, tenant_id: str, hours: int = 24, limit: int = 50, offset: int = 0
    ) -> tuple[int, list[dict[str, Any]]]:
        """
        SQL-powered failure clustering — replaces Python-memory FailureClusterEngine
        for production scale. Returns (total, items). Total is estimated here just as item bounds.
        """
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        client = self._get_client()

        # Simple separate total proxy for OLAP
        total_q = "SELECT COUNT(DISTINCT fingerprint) FROM temporallayr_spans WHERE tenant_id={tenant_id:String} AND status='error' AND start_time >= {since:DateTime64}"
        total_res = client.query(total_q, parameters={"tenant_id": tenant_id, "since": since})
        total = total_res.result_rows[0][0] if total_res.result_rows else 0

        result = client.query(
            _FAILURE_CLUSTERS_QUERY,
            parameters={"tenant_id": tenant_id, "since": since, "limit": limit, "offset": offset},
        )
        clusters = []
        for row in result.result_rows:
            fingerprint, failing_span, failure_count, affected_traces, first_seen, last_seen = row
            clusters.append(
                {
                    "fingerprint": fingerprint or "",
                    "failing_node": failing_span,
                    "count": failure_count,
                    "executions": list(affected_traces),
                    "first_seen": str(first_seen),
                    "last_seen": str(last_seen),
                    "tenant_id": tenant_id,
                }
            )
        return total, clusters

    def get_latency_percentiles(
        self, tenant_id: str, hours: int = 24, limit: int = 50, offset: int = 0
    ) -> tuple[int, list[dict[str, Any]]]:
        """P50/P95/P99 latency per span name. Zero Python loops."""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        client = self._get_client()

        total_q = "SELECT COUNT(DISTINCT name) FROM temporallayr_spans WHERE tenant_id={tenant_id:String} AND start_time >= {since:DateTime64} AND duration_ms IS NOT NULL"
        total_res = client.query(total_q, parameters={"tenant_id": tenant_id, "since": since})
        total = total_res.result_rows[0][0] if total_res.result_rows else 0

        result = client.query(
            _LATENCY_PERCENTILES_QUERY,
            parameters={"tenant_id": tenant_id, "since": since, "limit": limit, "offset": offset},
        )
        cols = [
            "name",
            "call_count",
            "p50_ms",
            "p95_ms",
            "p99_ms",
            "avg_ms",
            "error_count",
            "error_rate_pct",
        ]
        return total, [dict(zip(cols, row)) for row in result.result_rows]

    def get_fingerprint_trends(
        self, tenant_id: str, hours: int = 168, limit: int = 50, offset: int = 0
    ) -> tuple[int, list[dict[str, Any]]]:
        """Hourly breakdown of trace volume + error rate per fingerprint."""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        client = self._get_client()

        total_q = "SELECT COUNT(DISTINCT fingerprint) FROM temporallayr_traces WHERE tenant_id={tenant_id:String} AND start_time >= {since:DateTime64}"
        total_res = client.query(total_q, parameters={"tenant_id": tenant_id, "since": since})
        total = total_res.result_rows[0][0] if total_res.result_rows else 0

        result = client.query(
            _FINGERPRINT_TREND_QUERY,
            parameters={"tenant_id": tenant_id, "since": since, "limit": limit, "offset": offset},
        )
        cols = ["hour", "fingerprint", "trace_count", "error_trace_count"]
        return total, [dict(zip(cols, row)) for row in result.result_rows]

    def get_span_timeline(self, trace_id: str, tenant_id: str) -> list[dict[str, Any]]:
        """Fetch all spans for a single trace in start_time order."""
        client = self._get_client()
        result = client.query(
            """
            SELECT span_id, parent_span_id, name, start_time, end_time,
                   duration_ms, status, error, attributes
            FROM temporallayr_spans
            WHERE tenant_id = {tenant_id:String} AND trace_id = {trace_id:String}
            ORDER BY start_time ASC
            """,
            parameters={"tenant_id": tenant_id, "trace_id": trace_id},
        )
        cols = [
            "span_id",
            "parent_span_id",
            "name",
            "start_time",
            "end_time",
            "duration_ms",
            "status",
            "error",
            "attributes",
        ]
        rows = []
        for row in result.result_rows:
            d = dict(zip(cols, row))
            try:
                d["attributes"] = json.loads(d["attributes"] or "{}")
            except Exception:
                pass
            rows.append(d)
        return rows


# ── Global optional store ─────────────────────────────────────────────
_ch_store: ClickHouseAnalyticsStore | None = None


def get_clickhouse_store() -> ClickHouseAnalyticsStore | None:
    import os

    global _ch_store
    if _ch_store is None:
        host = os.getenv("TEMPORALLAYR_CLICKHOUSE_HOST")
        if host:
            _ch_store = ClickHouseAnalyticsStore(
                host=host,
                port=int(os.getenv("TEMPORALLAYR_CLICKHOUSE_PORT", "8123")),
                database=os.getenv("TEMPORALLAYR_CLICKHOUSE_DB", "default"),
                username=os.getenv("TEMPORALLAYR_CLICKHOUSE_USER", "default"),
                password=os.getenv("TEMPORALLAYR_CLICKHOUSE_PASSWORD", ""),
                secure=os.getenv("TEMPORALLAYR_CLICKHOUSE_SECURE", "false").lower() == "true",
            )
    return _ch_store


def configure_clickhouse(
    host: str,
    port: int = 8123,
    database: str = "default",
    username: str = "default",
    password: str = "",
    secure: bool = False,
) -> ClickHouseAnalyticsStore:
    global _ch_store
    _ch_store = ClickHouseAnalyticsStore(
        host=host,
        port=port,
        database=database,
        username=username,
        password=password,
        secure=secure,
    )
    return _ch_store
