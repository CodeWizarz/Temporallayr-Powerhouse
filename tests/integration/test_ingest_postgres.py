from __future__ import annotations

import asyncio
import os
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

pytestmark = [pytest.mark.integration, pytest.mark.postgres, pytest.mark.external]


@pytest.mark.asyncio
@pytest.mark.skipif(
    os.getenv("TEMPORALLAYR_RUN_EXTERNAL_TESTS") != "1",
    reason="Set TEMPORALLAYR_RUN_EXTERNAL_TESTS=1 to run Postgres integration tests.",
)
async def test_v1_ingest_persists_execution_in_postgres(monkeypatch: pytest.MonkeyPatch) -> None:
    try:
        from testcontainers.postgres import PostgresContainer
    except ImportError as exc:
        pytest.skip(f"testcontainers not installed: {exc}")

    import asyncpg

    from temporallayr.core import store as store_module
    from temporallayr.core import store_postgres as postgres_module
    from temporallayr.core.store_postgres import PostgresStore
    from temporallayr.server.app import app

    with PostgresContainer("postgres:16-alpine") as postgres:
        dsn = postgres.get_connection_url()
        dsn = dsn.replace("postgresql+psycopg2://", "postgresql://")

        monkeypatch.setenv("TEMPORALLAYR_POSTGRES_DSN", dsn)
        monkeypatch.setenv("TEMPORALLAYR_API_KEYS", "pg-int-key=pg-int-tenant")
        monkeypatch.setenv("TEMPORALLAYR_DEFAULT_QUOTA", "100000")

        postgres_module._pool = None
        await postgres_module.init_schema()

        previous_store = store_module._default_store
        store_module.set_default_store(PostgresStore())

        trace_id = f"pg-int-{uuid4()}"
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/v1/ingest",
                    headers={
                        "Authorization": "Bearer pg-int-key",
                        "Content-Type": "application/json",
                    },
                    json={
                        "events": [
                            {
                                "trace_id": trace_id,
                                "tenant_id": "pg-int-tenant",
                                "spans": [{"span_id": "s1", "name": "integration_span"}],
                            }
                        ]
                    },
                )

            assert response.status_code == 202
            assert response.json()["processed"] == 1

            row_count = 0
            for _ in range(30):
                conn = await asyncpg.connect(dsn)
                try:
                    row_count = await conn.fetchval(
                        "SELECT count(*) FROM executions WHERE id = $1 AND tenant_id = $2",
                        trace_id,
                        "pg-int-tenant",
                    )
                finally:
                    await conn.close()

                if row_count == 1:
                    break
                await asyncio.sleep(0.2)

            assert row_count == 1
        finally:
            store_module._default_store = previous_store
            if postgres_module._pool is not None:
                await postgres_module._pool.close()
                postgres_module._pool = None
