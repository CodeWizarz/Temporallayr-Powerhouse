"""
ClickHouse analytics store for TemporalLayr.

Default port/secure settings are for ClickHouse Cloud (HTTPS, port 8443).
For self-hosted HTTP: set secure=False, port=8123.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

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
    attributes      String
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

_CREATE_UPTIME_TABLE = """
CREATE TABLE IF NOT EXISTS temporallayr_uptime_events (
    timestamp   DateTime64(3, 'UTC'),
    service     String,
    status      LowCardinality(String),
    latency_ms  Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (service, timestamp)
TTL timestamp + toIntervalDay(30)
"""


class ClickHouseAnalyticsStore:
    def __init__(
        self,
        host: str = "localhost",
        port: int = 8443,  # FIXED: default 8443 for ClickHouse Cloud
        database: str = "default",
        username: str = "default",
        password: str = "",
        secure: bool = True,  # FIXED: default True for ClickHouse Cloud
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
                import clickhouse_connect

                self._client = clickhouse_connect.get_client(
                    host=self._host,
                    port=self._port,
                    database=self._database,
                    username=self._username,
                    password=self._password,
                    secure=self._secure,
                )
            except ImportError as e:
                raise RuntimeError(
                    "clickhouse-connect not installed. Run: pip install clickhouse-connect"
                ) from e
            except Exception as e:
                raise RuntimeError(f"Failed to connect to ClickHouse: {e}") from e

    def initialize_schema(self) -> None:
        client = self._get_client()
        client.command(_CREATE_SPANS_TABLE)
        client.command(_CREATE_TRACES_TABLE)
        client.command(_CREATE_UPTIME_TABLE)

    def insert_uptime_event(self, service: str, status: str, latency_ms: float) -> None:
        client = self._get_client()
        client.insert(
            "temporallayr_uptime_events",
            [[datetime.now(UTC), service, status, latency_ms]],
            column_names=["timestamp", "service", "status", "latency_ms"],
        )
        logger.info("ClickHouse schema initialised")

    def insert_trace(self, graph: Any) -> None:
        try:
            from temporallayr.core.fingerprint import Fingerprinter

            fp_data = Fingerprinter.fingerprint_execution(graph)
            fingerprint: str | None = fp_data["fingerprint"]
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

            duration_ms: float | None = attrs.get("duration_ms")
            if duration_ms is None and span.end_time and span.start_time:
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
                    json.dumps(
                        {
                            k: (
                                str(v)
                                if not isinstance(v, (str, int, float, bool, type(None)))
                                else v
                            )
                            for k, v in attrs.items()
                        }
                    ),
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

        start_t = graph.start_time if hasattr(graph, "start_time") else graph.created_at
        end_t = getattr(graph, "end_time", None)

        client.insert(
            "temporallayr_traces",
            [
                [
                    graph.tenant_id,
                    graph.trace_id,
                    start_t,
                    end_t,
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

    def bulk_insert_traces(self, graphs: list[Any]) -> None:
        """Bulk-insert an entire batch of ExecutionGraphs in exactly 2 ClickHouse calls.

        This is far more efficient than calling insert_trace() in a loop because
        ClickHouse performs best with large batches — a single INSERT outperforms
        N individual INSERTs by a wide margin.
        """
        if not graphs:
            return

        all_span_rows: list[list[Any]] = []
        all_trace_rows: list[list[Any]] = []

        for graph in graphs:
            try:
                from temporallayr.core.fingerprint import Fingerprinter

                fp_data = Fingerprinter.fingerprint_execution(graph)
                fingerprint: str | None = fp_data["fingerprint"]
            except Exception:
                fingerprint = None

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

                duration_ms: float | None = attrs.get("duration_ms")
                if duration_ms is None and span.end_time and span.start_time:
                    duration_ms = (span.end_time - span.start_time).total_seconds() * 1000

                all_span_rows.append(
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
                        json.dumps(
                            {
                                k: (
                                    str(v)
                                    if not isinstance(v, (str, int, float, bool, type(None)))
                                    else v
                                )
                                for k, v in attrs.items()
                            }
                        ),
                    ]
                )

            start_t = graph.start_time if hasattr(graph, "start_time") else graph.created_at
            end_t = getattr(graph, "end_time", None)
            all_trace_rows.append(
                [
                    graph.tenant_id,
                    graph.trace_id,
                    start_t,
                    end_t,
                    len(graph.spans),
                    error_count,
                    fingerprint,
                ]
            )

        client = self._get_client()

        _SPAN_COLUMNS = [
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
        ]
        _TRACE_COLUMNS = [
            "tenant_id",
            "trace_id",
            "start_time",
            "end_time",
            "span_count",
            "error_count",
            "fingerprint",
        ]

        if all_span_rows:
            client.insert("temporallayr_spans", all_span_rows, column_names=_SPAN_COLUMNS)
        if all_trace_rows:
            client.insert("temporallayr_traces", all_trace_rows, column_names=_TRACE_COLUMNS)

        logger.info(
            "Bulk insert complete",
            extra={"graphs": len(graphs), "spans": len(all_span_rows)},
        )

    def list_executions(self, tenant_id: str, limit: int = 100) -> list[str]:
        client = self._get_client()
        result = client.query(
            "SELECT trace_id FROM temporallayr_traces WHERE tenant_id = {tenant_id:String} ORDER BY start_time DESC LIMIT {limit:UInt32}",
            parameters={"tenant_id": tenant_id, "limit": limit},
        )
        return [row[0] for row in result.result_rows]

    def get_failure_clusters(self, tenant_id: str, hours: int = 24) -> list[dict[str, Any]]:
        since = datetime.now(UTC) - timedelta(hours=hours)
        client = self._get_client()
        result = client.query(
            """
            SELECT fingerprint, name AS failing_span, count() AS failure_count,
                   groupArray(trace_id) AS affected_traces,
                   min(start_time) AS first_seen, max(start_time) AS last_seen
            FROM temporallayr_spans
            WHERE tenant_id = {tenant_id:String} AND status = 'error'
              AND start_time >= {since:DateTime64}
            GROUP BY fingerprint, name
            ORDER BY failure_count DESC LIMIT 100
            """,
            parameters={"tenant_id": tenant_id, "since": since},
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
        return clusters

    def get_latency_percentiles(self, tenant_id: str, hours: int = 24) -> list[dict[str, Any]]:
        since = datetime.now(UTC) - timedelta(hours=hours)
        client = self._get_client()
        result = client.query(
            """
            SELECT name, count() AS call_count,
                   round(quantile(0.50)(duration_ms), 2) AS p50_ms,
                   round(quantile(0.95)(duration_ms), 2) AS p95_ms,
                   round(quantile(0.99)(duration_ms), 2) AS p99_ms,
                   round(avg(duration_ms), 2) AS avg_ms,
                   countIf(status = 'error') AS error_count,
                   round(countIf(status='error') / count() * 100, 2) AS error_rate_pct
            FROM temporallayr_spans
            WHERE tenant_id = {tenant_id:String} AND start_time >= {since:DateTime64}
              AND duration_ms IS NOT NULL
            GROUP BY name ORDER BY call_count DESC LIMIT 200
            """,
            parameters={"tenant_id": tenant_id, "since": since},
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
        return [dict(zip(cols, row, strict=True)) for row in result.result_rows]

    def get_fingerprint_trends(self, tenant_id: str, hours: int = 168) -> list[dict[str, Any]]:
        since = datetime.now(UTC) - timedelta(hours=hours)
        client = self._get_client()
        result = client.query(
            """
            SELECT toStartOfHour(start_time) AS hour, fingerprint,
                   count() AS trace_count, countIf(error_count > 0) AS error_trace_count
            FROM temporallayr_traces
            WHERE tenant_id = {tenant_id:String} AND start_time >= {since:DateTime64}
            GROUP BY hour, fingerprint ORDER BY hour ASC, trace_count DESC
            """,
            parameters={"tenant_id": tenant_id, "since": since},
        )
        cols = ["hour", "fingerprint", "trace_count", "error_trace_count"]
        return [dict(zip(cols, row, strict=True)) for row in result.result_rows]

    def get_error_trends(self, tenant_id: str, hours: int = 168) -> list[dict[str, Any]]:
        """Return per-hour error counts grouped by fingerprint for charting."""
        since = datetime.now(UTC) - timedelta(hours=hours)
        client = self._get_client()
        result = client.query(
            """
            SELECT toStartOfHour(start_time) AS hour,
                   fingerprint,
                   count() AS span_count,
                   countIf(status = 'error') AS error_count,
                   round(countIf(status = 'error') / count() * 100, 2) AS error_rate_pct
            FROM temporallayr_spans
            WHERE tenant_id = {tenant_id:String}
              AND start_time >= {since:DateTime64}
            GROUP BY hour, fingerprint
            ORDER BY hour ASC, error_count DESC
            LIMIT 500
            """,
            parameters={"tenant_id": tenant_id, "since": since},
        )
        cols = ["hour", "fingerprint", "span_count", "error_count", "error_rate_pct"]
        return [dict(zip(cols, row, strict=True)) for row in result.result_rows]

    def set_retention(self, table: str, days: int) -> None:
        """Alter the TTL on an existing ClickHouse table at runtime.

        Args:
            table: One of 'temporallayr_spans', 'temporallayr_traces',
                   or 'temporallayr_uptime_events'.
            days: Retention period in days.
        """
        _ALLOWED = {"temporallayr_spans", "temporallayr_traces", "temporallayr_uptime_events"}
        if table not in _ALLOWED:
            raise ValueError(f"Unknown table '{table}'. Allowed: {_ALLOWED}")
        if days < 1:
            raise ValueError("Retention days must be >= 1")

        ts_col = "timestamp" if table == "temporallayr_uptime_events" else "start_time"
        sql = f"ALTER TABLE {table} MODIFY TTL {ts_col} + toIntervalDay({days})"
        client = self._get_client()
        client.command(sql)
        logger.info("Retention updated", extra={"table": table, "days": days})

    def get_span_timeline(self, trace_id: str, tenant_id: str) -> list[dict[str, Any]]:
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
            d = dict(zip(cols, row, strict=True))
            try:
                d["attributes"] = json.loads(d["attributes"] or "{}")
            except Exception:
                pass
            rows.append(d)
        return rows


_ch_store: ClickHouseAnalyticsStore | None = None


def get_clickhouse_store() -> ClickHouseAnalyticsStore | None:
    global _ch_store
    if _ch_store is None:
        from temporallayr.config import get_config

        cfg = get_config()
        if cfg.clickhouse_host:
            _ch_store = ClickHouseAnalyticsStore(
                host=cfg.clickhouse_host,
                port=cfg.clickhouse_port,
                database=cfg.clickhouse_db,
                username=cfg.clickhouse_user,
                password=cfg.clickhouse_password,
                secure=cfg.clickhouse_secure,
            )
    return _ch_store


def configure_clickhouse(
    host: str,
    port: int = 8443,
    database: str = "default",
    username: str = "default",
    password: str = "",
    secure: bool = True,
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
