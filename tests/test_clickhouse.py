from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from temporallayr.core.store_clickhouse import ClickHouseAnalyticsStore
from temporallayr.export.clickhouse import ClickHouseBatchExporter
from temporallayr.models.execution import ExecutionGraph


class _FakeQueryResult:
    def __init__(self, rows: list[tuple[Any, ...]]) -> None:
        self.result_rows = rows


class _FakeClient:
    def __init__(self, *, fail_insert_attempts: int = 0) -> None:
        self.command_calls: list[str] = []
        self.inserted: dict[str, list[list[Any]]] = {
            "temporallayr_traces": [],
            "temporallayr_spans": [],
            "temporallayr_events": [],
            "temporallayr_usage": [],
        }
        self.fail_insert_attempts = fail_insert_attempts
        self.insert_calls = 0

    def command(self, sql: str) -> int:
        self.command_calls.append(sql)
        return 1

    def query(self, sql: str) -> _FakeQueryResult:
        if "SELECT trace_id FROM temporallayr_traces" in sql:
            return _FakeQueryResult([(row[1],) for row in self.inserted["temporallayr_traces"]])
        if "SELECT trace_id, span_id FROM temporallayr_spans" in sql:
            rows = [(row[1], row[2]) for row in self.inserted["temporallayr_spans"]]
            return _FakeQueryResult(rows)
        if "SELECT event_id FROM temporallayr_events" in sql:
            rows = [(row[1],) for row in self.inserted["temporallayr_events"]]
            return _FakeQueryResult(rows)
        if "SELECT usage_id FROM temporallayr_usage" in sql:
            rows = [(row[1],) for row in self.inserted["temporallayr_usage"]]
            return _FakeQueryResult(rows)
        if sql.strip() == "SELECT 1":
            return _FakeQueryResult([(1,)])
        return _FakeQueryResult([])

    def insert(
        self, table: str, rows: list[list[Any]], column_names: list[str] | None = None
    ) -> None:
        del column_names
        self.insert_calls += 1
        if self.fail_insert_attempts > 0:
            self.fail_insert_attempts -= 1
            raise RuntimeError("temporary insert failure")
        self.inserted[table].extend(rows)


def _make_graph(trace_id: str = "trace-1") -> ExecutionGraph:
    now = datetime.now(UTC)
    return ExecutionGraph(
        trace_id=trace_id,
        tenant_id="tenant-a",
        start_time=now,
        end_time=now,
        spans=[
            {
                "span_id": "span-1",
                "name": "tool:lookup",
                "start_time": now,
                "end_time": now,
                "attributes": {
                    "inputs": {"user_id": "u-1"},
                    "output": {"ok": True},
                    "duration_ms": 12.5,
                },
            }
        ],
    )


def test_batch_exporter_is_idempotent() -> None:
    client = _FakeClient()
    exporter = ClickHouseBatchExporter(client, max_retries=0, base_backoff=0.0, backoff_jitter=0.0)

    graph = _make_graph()
    first = exporter.insert_graphs([graph])
    second = exporter.insert_graphs([graph])

    assert first["traces_inserted"] == 1
    assert first["spans_inserted"] == 1
    assert first["events_inserted"] == 1
    assert first["usage_inserted"] == 1

    assert second["traces_inserted"] == 0
    assert second["spans_inserted"] == 0
    assert second["events_inserted"] == 0
    assert second["usage_inserted"] == 0


def test_batch_exporter_retries_transient_insert_errors() -> None:
    client = _FakeClient(fail_insert_attempts=1)
    exporter = ClickHouseBatchExporter(client, max_retries=2, base_backoff=0.0, backoff_jitter=0.0)

    result = exporter.insert_graphs([_make_graph("trace-2")])

    assert result["traces_inserted"] == 1
    assert client.insert_calls >= 2


def test_clickhouse_store_initializes_schema_and_batch_insert() -> None:
    store = ClickHouseAnalyticsStore(host="localhost", secure=False)
    fake_client = _FakeClient()
    store._client = fake_client

    store.initialize_schema()
    summary = store.insert_traces_batch([_make_graph("trace-3")])

    assert any("temporallayr_spans" in sql for sql in fake_client.command_calls)
    assert any("temporallayr_traces" in sql for sql in fake_client.command_calls)
    assert any("temporallayr_events" in sql for sql in fake_client.command_calls)
    assert any("temporallayr_usage" in sql for sql in fake_client.command_calls)

    assert summary["traces_inserted"] == 1
    assert summary["spans_inserted"] == 1
