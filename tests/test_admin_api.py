import pytest
from httpx import AsyncClient, ASGITransport
from temporallayr.server.app import app


@pytest.fixture
def override_env(monkeypatch):
    monkeypatch.setenv("TEMPORALLAYR_ADMIN_KEY", "supersecretadmin")
    monkeypatch.setenv("TEMPORALLAYR_RATE_LIMIT_ENABLED", "false")


@pytest.fixture
async def async_client(override_env):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.mark.asyncio
async def test_admin_api_missing_key(async_client):
    res = await async_client.post(
        "/admin/tenants/register", json={"tenant_id": "test-1", "admin_email": "a@b.com"}
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_api_wrong_key(async_client):
    headers = {"X-Admin-Key": "wrong"}
    res = await async_client.post(
        "/admin/tenants/register",
        json={"tenant_id": "test-1", "admin_email": "a@b.com"},
        headers=headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_api_lifecycle(async_client):
    headers = {"X-Admin-Key": "supersecretadmin"}

    # Register
    res = await async_client.post(
        "/admin/tenants/register",
        json={"tenant_id": "org-admin-test", "admin_email": "admin@org.com"},
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["tenant_id"] == "org-admin-test"
    api_key_1 = data["api_key"]
    assert api_key_1
    assert "created_at" in data

    # Verify the registered key actually works for an endpoint
    res_ingest = await async_client.post(
        "/v1/ingest",
        json={"events": []},
        headers={"Authorization": f"Bearer {api_key_1}", "X-Tenant-Id": "org-admin-test"},
    )
    assert res_ingest.status_code == 202

    # List Tenants
    res_list = await async_client.get("/admin/tenants", headers=headers)
    assert res_list.status_code == 200
    tenants = res_list.json()
    assert any(t["tenant_id"] == "org-admin-test" for t in tenants)

    # Rotate Key
    res_rotate = await async_client.post(
        "/admin/tenants/org-admin-test/rotate-key", headers=headers
    )
    assert res_rotate.status_code == 200
    api_key_2 = res_rotate.json()["api_key"]
    assert api_key_2 != api_key_1

    # Old key invalid
    res_ingest_old = await async_client.post(
        "/v1/ingest",
        json={"events": []},
        headers={"Authorization": f"Bearer {api_key_1}", "X-Tenant-Id": "org-admin-test"},
    )
    assert res_ingest_old.status_code == 401

    # New key valid
    res_ingest_new = await async_client.post(
        "/v1/ingest",
        json={"events": []},
        headers={"Authorization": f"Bearer {api_key_2}", "X-Tenant-Id": "org-admin-test"},
    )
    assert res_ingest_new.status_code == 202
