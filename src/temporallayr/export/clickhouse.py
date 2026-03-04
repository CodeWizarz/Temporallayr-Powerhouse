"""ClickHouse batch exporter with retries and idempotent writes."""

from __future__ import annotations

import json
import logging
import random
import time
from collections import defaultdict
from collections.abc import Iterable, Sequence
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)

TRACE_COLUMNS = [
    "tenant_id",
    "trace_id",
    "start_time",
    "end_time",
    "span_count",
    "error_count",
    "fingerprint",
    "ingested_at",
]

SPAN_COLUMNS = [
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

EVENT_COLUMNS = [
    "tenant_id",
    "event_id",
    "trace_id",
    "span_id",
    "event_type",
    "occurred_at",
    "payload",
]

USAGE_COLUMNS = [
    "tenant_id",
    "usage_id",
    "trace_id",
    "usage_date",
    "spans_ingested",
    "error_spans",
    "ingested_at",
]


class ClickHouseBatchExporter:
    """
    Efficient ClickHouse batch exporter.

    The exporter accepts a ClickHouse HTTP client (clickhouse-connect) or a compatible
    native-driver adapter exposing ``insert`` and ``query`` methods.
    """

    def __init__(
        self,
        client: Any,
        *,
        max_retries: int = 3,
        base_backoff: float = 0.2,
        backoff_jitter: float = 0.1,
        insert_chunk_size: int = 500,
        lookup_chunk_size: int = 500,
    ) -> None:
        self._client = client
        self._max_retries = max_retries
        self._base_backoff = base_backoff
        self._backoff_jitter = backoff_jitter
        self._insert_chunk_size = max(1, insert_chunk_size)
        self._lookup_chunk_size = max(1, lookup_chunk_size)

    def insert_graphs(self, graphs: Sequence[Any]) -> dict[str, int]:
        if not graphs:
            return {
                "traces_inserted": 0,
                "spans_inserted": 0,
                "events_inserted": 0,
                "usage_inserted": 0,
            }

        prepared = self._prepare_rows(graphs)
        summary = {
            "traces_inserted": 0,
            "spans_inserted": 0,
            "events_inserted": 0,
            "usage_inserted": 0,
        }

        for tenant_id, rows in prepared.items():
            trace_ids = {row[1] for row in rows["traces"]}
            existing_trace_ids = self._existing_trace_ids(tenant_id, trace_ids)

            existing_span_keys = self._existing_span_keys(tenant_id, trace_ids)

            event_ids = {row[1] for row in rows["events"]}
            existing_event_ids = self._existing_event_ids(tenant_id, event_ids)

            usage_ids = {row[1] for row in rows["usage"]}
            existing_usage_ids = self._existing_usage_ids(tenant_id, usage_ids)

            traces_to_insert = self._dedupe_rows(
                rows["traces"],
                existing_trace_ids,
                key_fn=lambda row: row[1],
            )
            spans_to_insert = self._dedupe_rows(
                rows["spans"],
                existing_span_keys,
                key_fn=lambda row: f"{row[1]}:{row[2]}",
            )
            events_to_insert = self._dedupe_rows(
                rows["events"],
                existing_event_ids,
                key_fn=lambda row: row[1],
            )
            usage_to_insert = self._dedupe_rows(
                rows["usage"],
                existing_usage_ids,
                key_fn=lambda row: row[1],
            )

            self._insert_rows("temporallayr_traces", traces_to_insert, TRACE_COLUMNS)
            self._insert_rows("temporallayr_spans", spans_to_insert, SPAN_COLUMNS)
            self._insert_rows("temporallayr_events", events_to_insert, EVENT_COLUMNS)
            self._insert_rows("temporallayr_usage", usage_to_insert, USAGE_COLUMNS)

            summary["traces_inserted"] += len(traces_to_insert)
            summary["spans_inserted"] += len(spans_to_insert)
            summary["events_inserted"] += len(events_to_insert)
            summary["usage_inserted"] += len(usage_to_insert)

            logger.debug(
                "ClickHouse batch inserted",
                extra={
                    "tenant_id": tenant_id,
                    "traces": len(traces_to_insert),
                    "spans": len(spans_to_insert),
                    "events": len(events_to_insert),
                    "usage": len(usage_to_insert),
                },
            )

        return summary

    def _prepare_rows(self, graphs: Sequence[Any]) -> dict[str, dict[str, list[list[Any]]]]:
        by_tenant: dict[str, dict[str, list[list[Any]]]] = defaultdict(
            lambda: {
                "traces": [],
                "spans": [],
                "events": [],
                "usage": [],
            }
        )

        for graph in graphs:
            tenant_id = str(getattr(graph, "tenant_id", "default"))
            trace_id = str(getattr(graph, "trace_id", ""))
            if not trace_id:
                logger.debug("Skipping graph with missing trace_id")
                continue

            fingerprint = self._fingerprint(graph)
            start_t = _to_utc_datetime(
                getattr(graph, "start_time", None) or getattr(graph, "created_at", None)
            )
            if start_t is None:
                start_t = datetime.now(UTC)
            end_t = _to_utc_datetime(getattr(graph, "end_time", None))
            ingested_at = datetime.now(UTC)

            spans = list(getattr(graph, "spans", []) or [])
            span_rows: list[list[Any]] = []
            event_rows: list[list[Any]] = []
            error_count = 0

            for idx, span in enumerate(spans):
                attrs = _safe_dict(getattr(span, "attributes", {}))
                span_id = str(getattr(span, "span_id", "") or f"span-{idx}")
                span_start = _to_utc_datetime(getattr(span, "start_time", None)) or start_t
                span_end = _to_utc_datetime(getattr(span, "end_time", None))
                duration_ms = attrs.get("duration_ms")
                if duration_ms is None and span_end and span_start:
                    duration_ms = (span_end - span_start).total_seconds() * 1000

                input_dict = attrs.get("inputs", {})
                input_keys = sorted(input_dict.keys()) if isinstance(input_dict, dict) else []
                output_val = attrs.get("output", attrs.get("error"))
                output_type = type(output_val).__name__ if output_val is not None else "NoneType"
                has_error = bool(getattr(span, "error", None) or attrs.get("error"))
                if has_error:
                    error_count += 1

                span_rows.append(
                    [
                        tenant_id,
                        trace_id,
                        span_id,
                        getattr(span, "parent_span_id", None),
                        str(getattr(span, "name", "unknown")),
                        span_start,
                        span_end,
                        duration_ms,
                        "error" if has_error else "success",
                        (
                            str(getattr(span, "error", None) or attrs.get("error", ""))
                            if has_error
                            else None
                        ),
                        fingerprint,
                        input_keys,
                        output_type,
                        _json_dump(attrs),
                    ]
                )

                event_rows.append(
                    [
                        tenant_id,
                        f"{trace_id}:{span_id}",
                        trace_id,
                        span_id,
                        "span_ingested",
                        span_start,
                        _json_dump(
                            {
                                "status": "error" if has_error else "success",
                                "duration_ms": duration_ms,
                            }
                        ),
                    ]
                )

            by_tenant[tenant_id]["traces"].append(
                [
                    tenant_id,
                    trace_id,
                    start_t,
                    end_t,
                    len(spans),
                    error_count,
                    fingerprint,
                    ingested_at,
                ]
            )
            by_tenant[tenant_id]["spans"].extend(span_rows)
            by_tenant[tenant_id]["events"].extend(event_rows)
            by_tenant[tenant_id]["usage"].append(
                [
                    tenant_id,
                    trace_id,
                    trace_id,
                    start_t.date(),
                    len(spans),
                    error_count,
                    ingested_at,
                ]
            )

        return dict(by_tenant)

    def _dedupe_rows(
        self,
        rows: Sequence[list[Any]],
        existing_keys: set[str],
        *,
        key_fn: Any,
    ) -> list[list[Any]]:
        unique: list[list[Any]] = []
        seen: set[str] = set()
        for row in rows:
            key = str(key_fn(row))
            if key in existing_keys or key in seen:
                continue
            seen.add(key)
            unique.append(row)
        return unique

    def _insert_rows(self, table: str, rows: Sequence[list[Any]], columns: Sequence[str]) -> None:
        if not rows:
            return
        for chunk in _chunked(rows, self._insert_chunk_size):
            self._with_retry(
                f"insert:{table}", lambda c=chunk: self._insert_chunk(table, c, columns)
            )

    def _insert_chunk(self, table: str, rows: list[list[Any]], columns: Sequence[str]) -> None:
        try:
            self._client.insert(table, rows, column_names=list(columns))
        except TypeError:
            self._client.insert(table, rows)

    def _existing_trace_ids(self, tenant_id: str, trace_ids: Iterable[str]) -> set[str]:
        return self._existing_single_key(
            table="temporallayr_traces",
            key_column="trace_id",
            tenant_id=tenant_id,
            values=trace_ids,
        )

    def _existing_event_ids(self, tenant_id: str, event_ids: Iterable[str]) -> set[str]:
        return self._existing_single_key(
            table="temporallayr_events",
            key_column="event_id",
            tenant_id=tenant_id,
            values=event_ids,
        )

    def _existing_usage_ids(self, tenant_id: str, usage_ids: Iterable[str]) -> set[str]:
        return self._existing_single_key(
            table="temporallayr_usage",
            key_column="usage_id",
            tenant_id=tenant_id,
            values=usage_ids,
        )

    def _existing_single_key(
        self,
        *,
        table: str,
        key_column: str,
        tenant_id: str,
        values: Iterable[str],
    ) -> set[str]:
        incoming = sorted({str(v) for v in values if v})
        if not incoming:
            return set()

        existing: set[str] = set()
        for chunk in _chunked(incoming, self._lookup_chunk_size):
            sql = (
                f"SELECT {key_column} FROM {table} "
                f"WHERE tenant_id = {_sql_quote(tenant_id)} "
                f"AND {key_column} IN ({_sql_csv(chunk)})"
            )
            rows = self._query_rows(sql, op_name=f"lookup:{table}:{key_column}")
            for row in rows:
                if row and row[0] is not None:
                    existing.add(str(row[0]))
        return existing

    def _existing_span_keys(self, tenant_id: str, trace_ids: Iterable[str]) -> set[str]:
        traces = sorted({str(t) for t in trace_ids if t})
        if not traces:
            return set()

        existing: set[str] = set()
        for chunk in _chunked(traces, self._lookup_chunk_size):
            sql = (
                "SELECT trace_id, span_id FROM temporallayr_spans "
                f"WHERE tenant_id = {_sql_quote(tenant_id)} "
                f"AND trace_id IN ({_sql_csv(chunk)})"
            )
            rows = self._query_rows(sql, op_name="lookup:temporallayr_spans")
            for row in rows:
                if len(row) < 2:
                    continue
                existing.add(f"{row[0]}:{row[1]}")
        return existing

    def _query_rows(self, sql: str, *, op_name: str) -> list[tuple[Any, ...]]:
        result = self._with_retry(op_name, lambda: self._client.query(sql))
        if hasattr(result, "result_rows"):
            return [tuple(row) for row in result.result_rows]
        if isinstance(result, list):
            return [tuple(row) if isinstance(row, (list, tuple)) else (row,) for row in result]
        return []

    def _with_retry(self, operation: str, fn: Any) -> Any:
        last_error: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                return fn()
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt >= self._max_retries:
                    break
                delay = self._base_backoff * (2**attempt)
                delay += random.random() * self._backoff_jitter
                logger.warning(
                    "ClickHouse %s failed (attempt %d/%d): %s",
                    operation,
                    attempt + 1,
                    self._max_retries + 1,
                    exc,
                )
                time.sleep(delay)

        assert last_error is not None
        raise last_error

    def _fingerprint(self, graph: Any) -> str | None:
        try:
            from temporallayr.core.fingerprint import Fingerprinter

            fp_data = Fingerprinter.fingerprint_execution(graph)
            return fp_data.get("fingerprint")
        except Exception:
            return None


def _chunked(items: Sequence[Any], size: int) -> Iterable[list[Any]]:
    for index in range(0, len(items), size):
        yield list(items[index : index + size])


def _to_utc_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
    return None


def _safe_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _json_dump(payload: dict[str, Any]) -> str:
    normalised = {}
    for key, value in payload.items():
        if isinstance(value, (str, int, float, bool, type(None), list, dict)):
            normalised[key] = value
        else:
            normalised[key] = str(value)
    return json.dumps(normalised, default=str)


def _sql_quote(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"


def _sql_csv(values: Sequence[str]) -> str:
    return ",".join(_sql_quote(value) for value in values)
