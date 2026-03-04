from __future__ import annotations

import asyncio
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from temporallayr.server.auth.api_keys import map_api_key_to_tenant


@pytest.mark.integration
@pytest.mark.clickhouse
@pytest.mark.asyncio
async def test_v1_ingest_triggers_clickhouse_insert(monkeypatch: pytest.MonkeyPatch) -> None:
    import temporallayr.server.app as app_module
    from temporallayr.server.app import app

    class _FakeClickHouseStore:
        def __init__(self) -> None:
            self.trace_ids: list[str] = []

        def insert_trace(self, graph) -> None:
            self.trace_ids.append(graph.trace_id)

    fake_store = _FakeClickHouseStore()

    async def _enqueue_immediately(graph) -> None:
        await app_module._process_graph_sync(graph)

    monkeypatch.setenv("TEMPORALLAYR_DEFAULT_QUOTA", "100000")
    monkeypatch.setattr(app_module, "get_clickhouse_store", lambda: fake_store)
    monkeypatch.setattr(app_module, "get_otlp_exporter", lambda: None)
    monkeypatch.setattr(
        app_module.FailureClusterEngine,
        "cluster_failures",
        classmethod(lambda cls, executions: []),
    )
    monkeypatch.setattr(app_module, "_enqueue_graph", _enqueue_immediately)

    tenant_id = f"ch-int-tenant-{uuid4().hex[:8]}"
    api_key = f"ch-int-key-{uuid4().hex[:8]}"
    trace_id = f"ch-int-trace-{uuid4()}"
    map_api_key_to_tenant(api_key, tenant_id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/v1/ingest",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "events": [
                    {
                        "trace_id": trace_id,
                        "tenant_id": tenant_id,
                        "spans": [{"span_id": "span-1", "name": "clickhouse_span"}],
                    }
                ]
            },
        )

    assert response.status_code == 202
    assert response.json()["processed"] == 1

    for _ in range(30):
        if trace_id in fake_store.trace_ids:
            break
        await asyncio.sleep(0.05)

    assert trace_id in fake_store.trace_ids
