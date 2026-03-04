"""
ClickHouse analytics store for TemporalLayr.

Default port/secure settings are for ClickHouse Cloud (HTTPS, port 8443).
For self-hosted HTTP: set secure=False, port=8123.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Any

from temporallayr.export.clickhouse import ClickHouseBatchExporter

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
ORDER BY (tenant_id, trace_id, span_id, start_time)
TTL start_time + toIntervalDay(90)
SETTINGS index_granularity = 8192
"""

_CREATE_EVENTS_TABLE = """
CREATE TABLE IF NOT EXISTS temporallayr_events (
    tenant_id    LowCardinality(String),
    event_id     String,
    trace_id     String,
    span_id      String,
    event_type   LowCardinality(String),
    occurred_at  DateTime64(3, 'UTC'),
    payload      String
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(occurred_at))
ORDER BY (tenant_id, event_id, occurred_at)
TTL occurred_at + toIntervalDay(30)
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
    fingerprint  Nullable(String),
    ingested_at  DateTime64(3, 'UTC')
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(start_time))
ORDER BY (tenant_id, trace_id, start_time)
TTL start_time + toIntervalDay(90)
"""

_CREATE_USAGE_TABLE = """
CREATE TABLE IF NOT EXISTS temporallayr_usage (
    tenant_id       LowCardinality(String),
    usage_id        String,
    trace_id        String,
    usage_date      Date,
    spans_ingested  UInt32,
    error_spans     UInt32,
    ingested_at     DateTime64(3, 'UTC')
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(usage_date))
ORDER BY (tenant_id, usage_date, usage_id)
TTL usage_date + toIntervalDay(365)
SETTINGS index_granularity = 8192
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
        self._exporter: ClickHouseBatchExporter | None = None
        self._last_insert_summary: dict[str, int] = {
            "traces_inserted": 0,
            "spans_inserted": 0,
            "events_inserted": 0,
            "usage_inserted": 0,
        }

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
            except ImportError as exc:
                raise RuntimeError(
                    "clickhouse-connect not installed. Run: pip install clickhouse-connect"
                ) from exc
        return self._client

    def _get_exporter(self) -> ClickHouseBatchExporter:
        if self._exporter is None:
            client = self._get_client()
            self._exporter = ClickHouseBatchExporter(
                client,
                max_retries=int(os.getenv("TEMPORALLAYR_CLICKHOUSE_MAX_RETRIES", "3")),
                base_backoff=float(os.getenv("TEMPORALLAYR_CLICKHOUSE_BASE_BACKOFF", "0.2")),
                backoff_jitter=float(os.getenv("TEMPORALLAYR_CLICKHOUSE_BACKOFF_JITTER", "0.1")),
                insert_chunk_size=int(
                    os.getenv("TEMPORALLAYR_CLICKHOUSE_INSERT_CHUNK_SIZE", "500")
                ),
                lookup_chunk_size=int(
                    os.getenv("TEMPORALLAYR_CLICKHOUSE_LOOKUP_CHUNK_SIZE", "500")
                ),
            )
        return self._exporter

    def initialize_schema(self) -> None:
        client = self._get_client()
        client.command(_CREATE_SPANS_TABLE)
        client.command(_CREATE_EVENTS_TABLE)
        client.command(_CREATE_TRACES_TABLE)
        client.command(_CREATE_USAGE_TABLE)
        logger.info("ClickHouse schema initialised")

    def insert_trace(self, graph: Any) -> None:
        self.insert_traces_batch([graph])

    def insert_traces_batch(self, graphs: list[Any]) -> dict[str, int]:
        exporter = self._get_exporter()
        self._last_insert_summary = exporter.insert_graphs(graphs)
        return self._last_insert_summary

    def health(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "status": "unknown",
            "host": self._host,
            "port": self._port,
            "database": self._database,
            "secure": self._secure,
            "last_insert": self._last_insert_summary,
        }
        try:
            result = self._get_client().query("SELECT 1")
            rows = getattr(result, "result_rows", [])
            payload["status"] = "ok" if rows and rows[0][0] == 1 else "degraded"
        except Exception as exc:  # noqa: BLE001
            payload["status"] = "degraded"
            payload["error"] = str(exc)
        return payload

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
        return [dict(zip(cols, row, strict=False)) for row in result.result_rows]

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
        return [dict(zip(cols, row, strict=False)) for row in result.result_rows]

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
            d = dict(zip(cols, row, strict=False))
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
