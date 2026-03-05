"""
Server API route tests.
Tests all major endpoints: health, ingest, executions, incidents, admin, auth.
"""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from temporallayr.server.app import app
from temporallayr.server.auth.api_keys import map_api_key_to_tenant

TEST_TENANT = "test-route-tenant"
TEST_KEY = "route-test-key-abc123"
ADMIN_KEY = "test-admin-key-xyz"

os.environ["TEMPORALLAYR_ADMIN_KEY"] = ADMIN_KEY
os.environ["TEMPORALLAYR_API_KEY"] = TEST_KEY
os.environ["TEMPORALLAYR_TENANT_ID"] = TEST_TENANT


@pytest.fixture(autouse=True, scope="module")
def seed_key():
    map_api_key_to_tenant(TEST_KEY, TEST_TENANT)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {TEST_KEY}"},
    ) as c:
        yield c


@pytest_asyncio.fixture
async def admin_client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"X-Admin-Key": ADMIN_KEY},
    ) as c:
        yield c


# ── Health ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_ready(client: AsyncClient):
    r = await client.get("/ready")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ready"
    assert "sqlite" in data["backends"]


# ── Auth ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reject_invalid_key():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": "Bearer totally-wrong-key"},
    ) as c:
        r = await c.get("/executions")
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_reject_no_key():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        r = await c.get("/executions")
        assert r.status_code in (401, 403)


# ── Ingest ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ingest_valid(client: AsyncClient):
    r = await client.post(
        "/v1/ingest",
        json={"events": [{"tenant_id": TEST_TENANT, "spans": []}]},
        headers={"Authorization": f"Bearer {TEST_KEY}", "X-Tenant-Id": TEST_TENANT},
    )
    assert r.status_code == 202
    assert r.json()["processed"] == 1
    assert r.json()["errors"] == 0


@pytest.mark.asyncio
async def test_ingest_tenant_isolation():
    """Bearer token for TEST_TENANT cannot write to different-tenant."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        r = await c.post(
            "/v1/ingest",
            json={"events": [{"tenant_id": "other-tenant", "spans": []}]},
            headers={
                "Authorization": f"Bearer {TEST_KEY}",
                "X-Tenant-Id": "other-tenant",  # Mismatch → should 401
            },
        )
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_ingest_no_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/v1/ingest", json={"events": []})
        assert r.status_code == 401


# ── Executions ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_executions(client: AsyncClient):
    r = await client.get("/executions")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total" in data
    assert "has_more" in data


@pytest.mark.asyncio
async def test_get_execution_not_found(client: AsyncClient):
    r = await client.get("/executions/nonexistent-id-00000")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_create_and_get_execution(client: AsyncClient):
    from temporallayr.models.execution import ExecutionGraph

    graph = ExecutionGraph(id="test-exec-001", tenant_id=TEST_TENANT, spans=[])
    r = await client.post(
        "/executions",
        json=graph.model_dump(mode="json"),
    )
    assert r.status_code == 201
    assert r.json()["execution_id"] == "test-exec-001"

    r2 = await client.get("/executions/test-exec-001")
    assert r2.status_code == 200
    assert r2.json()["trace_id"] == "test-exec-001"


# ── Incidents ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_incidents(client: AsyncClient):
    r = await client.get("/incidents")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_ack_nonexistent_incident(client: AsyncClient):
    r = await client.post("/incidents/nonexistent-000/ack")
    assert r.status_code == 404


# ── Clusters ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_clusters(client: AsyncClient):
    r = await client.get("/clusters")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data


# ── Admin ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_register_tenant(admin_client: AsyncClient):
    r = await admin_client.post(
        "/admin/tenants/register",
        json={"tenant_id": "new-test-tenant-xyz"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["tenant_id"] == "new-test-tenant-xyz"
    assert "api_key" in data
    assert len(data["api_key"]) > 10


@pytest.mark.asyncio
async def test_admin_list_tenants(admin_client: AsyncClient):
    r = await admin_client.get("/admin/tenants")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_admin_rotate_key(admin_client: AsyncClient):
    r = await admin_client.post("/admin/tenants/new-test-tenant-xyz/rotate-key")
    assert r.status_code == 200
    data = r.json()
    assert "api_key" in data
    assert "revoked_count" in data


@pytest.mark.asyncio
async def test_admin_wrong_key():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"X-Admin-Key": "wrong-admin-key"},
    ) as c:
        r = await c.get("/admin/tenants")
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_no_key():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/admin/tenants")
        assert r.status_code in (403, 422)


# ── Keys ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_keys(client: AsyncClient):
    r = await client.get("/keys")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
