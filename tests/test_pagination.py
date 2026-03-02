from copy import deepcopy

import pytest
from httpx import ASGITransport, AsyncClient

from temporallayr.core.store import get_default_store
from temporallayr.core.store_sqlite import SQLiteStore
from temporallayr.models.execution import ExecutionGraph
from temporallayr.server.app import app


# Hardcode some fake api key handling via test-only dependency overriding setup
@pytest.fixture
async def async_client():
    from temporallayr.server.auth.api_keys import generate_api_key, map_api_key_to_tenant

    key = generate_api_key()
    map_api_key_to_tenant(key, "test-tenant")

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testServer",
        headers={"Authorization": f"Bearer {key}"},
    ) as ac:
        yield ac


@pytest.fixture(autouse=True)
def sqlite_store_cleaner():
    store = get_default_store()
    if isinstance(store, SQLiteStore):
        with store._get_connection() as conn:
            conn.execute("DELETE FROM executions")
            conn.execute("DELETE FROM incidents")
            conn.commit()


@pytest.mark.asyncio
async def test_incidents_pagination(async_client):
    # Seed 5 incidents directly to SQLite Store AND Global State because app.py relies on
    # local caching of incidents loaded purely during startup lifespan.
    store = get_default_store()
    from temporallayr.server.app import _INCIDENTS

    _INCIDENTS.clear()
    for i in range(5):
        inc = {"incident_id": f"inc-{i}", "tenant_id": "test-tenant", "title": f"Test {i}"}
        store.save_incident(inc)
        _INCIDENTS.append(inc)

    res = await async_client.get("/incidents?limit=2&offset=0")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 5
    assert data["limit"] == 2
    assert data["offset"] == 0
    assert data["has_more"] == True
    assert len(data["items"]) == 2

    res2 = await async_client.get("/incidents?limit=2&offset=4")
    data2 = res2.json()
    assert len(data2["items"]) == 1
    assert data2["has_more"] == False


@pytest.mark.asyncio
async def test_executions_pagination(async_client):
    store = get_default_store()
    dummy_payload = {
        "id": "foo",
        "tenant_id": "test-tenant",
        "spans": [],
        "start_time": "2024-01-01T00:00:00Z",
    }

    for i in range(5):
        payload = deepcopy(dummy_payload)
        payload["id"] = f"exec-{i}"
        store.save_execution(ExecutionGraph(**payload))

    res = await async_client.get("/executions?limit=3&offset=0")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 5
    assert data["limit"] == 3
    assert data["has_more"] == True
    assert len(data["items"]) == 3
