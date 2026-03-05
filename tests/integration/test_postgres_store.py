from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from temporallayr.core.store_postgres import PostgresStore, normalize_database_url
from temporallayr.models.execution import ExecutionGraph, Span


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.external
@pytest.mark.skipif(
    os.getenv("TEMPORALLAYR_RUN_EXTERNAL_TESTS") != "1",
    reason="Set TEMPORALLAYR_RUN_EXTERNAL_TESTS=1 to run external Postgres store tests.",
)
def test_postgres_store_round_trip_with_testcontainer() -> None:
    try:
        from testcontainers.postgres import PostgresContainer
    except ImportError as exc:
        pytest.skip(f"testcontainers not installed: {exc}")

    with PostgresContainer("postgres:16-alpine") as postgres:
        dsn = postgres.get_connection_url().replace(
            "postgresql+psycopg2://", "postgresql://"
        )
        os.environ["TEMPORALLAYR_POSTGRES_DSN"] = dsn
        tenant_id = f"tenant-{uuid4().hex[:8]}"
        trace_id = f"trace-{uuid4().hex[:8]}"

        store = PostgresStore()
        graph = ExecutionGraph(
            trace_id=trace_id,
            tenant_id=tenant_id,
            spans=[
                Span(
                    span_id="span-1",
                    name="root",
                    start_time=datetime.now(UTC),
                    attributes={"inputs": {"x": 1}, "output": {"ok": True}},
                )
            ],
        )

        store.save_execution(graph)

        loaded = store.load_execution(trace_id, tenant_id)
        assert loaded.trace_id == trace_id
        assert loaded.tenant_id == tenant_id
        assert len(loaded.spans) == 1

        listed = store.list_executions(tenant_id)
        assert trace_id in listed

        deleted = store.delete_old_executions(datetime.now(UTC) + timedelta(days=1))
        assert deleted >= 1

        with pytest.raises(FileNotFoundError):
            store.load_execution(trace_id, tenant_id)
