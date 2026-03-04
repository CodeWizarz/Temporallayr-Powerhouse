from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from temporallayr.models.execution import ExecutionGraph, Span
from temporallayr.storage.postgres_store import PostgresStore, normalize_database_url


@pytest.mark.integration
@pytest.mark.postgres
def test_normalize_database_url_neon_compatibility() -> None:
    url = "postgres://user:pass@ep-example.neon.tech/neondb?sslmode=require"
    normalized = normalize_database_url(url)

    assert normalized.startswith("postgresql://")
    assert "sslmode=require" in normalized


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
        dsn = normalize_database_url(
            postgres.get_connection_url().replace("postgresql+psycopg2://", "postgresql://")
        )
        tenant_id = f"tenant-{uuid4().hex[:8]}"
        trace_id = f"trace-{uuid4().hex[:8]}"

        store = PostgresStore(dsn=dsn)
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

        try:
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
        finally:
            store.close()
