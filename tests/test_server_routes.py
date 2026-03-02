import asyncio
import uuid
from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient

from temporallayr.server.app import app
from temporallayr.server.auth.api_keys import delete_keys_for_tenant, map_api_key_to_tenant


@pytest.fixture(autouse=True)
def setup_env(monkeypatch):
    monkeypatch.setenv("TEMPORALLAYR_ADMIN_KEY", "secret-admin-key")
    monkeypatch.setenv("TEMPORALLAYR_RATE_LIMIT_ENABLED", "false")
    # Setup test tenants
    delete_keys_for_tenant("test-tenant")
    delete_keys_for_tenant("other-tenant")
    delete_keys_for_tenant("new-tenant")
    map_api_key_to_tenant("test-key", "test-tenant")
    map_api_key_to_tenant("other-key", "other-tenant")


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test", headers={"Authorization": "Bearer test-key"}
    ) as client:
        yield client


def _get_dummy_span(span_id=None, parent_id=None, name="test_span", error=None):
    if not span_id:
        span_id = str(uuid.uuid4())
    s = {
        "span_id": span_id,
        "parent_span_id": parent_id,
        "name": name,
        "start_time": datetime.now(UTC).isoformat(),
        "status": "error" if error else "success",
        "attributes": {"error": error} if error else {},
    }
    return s


def _get_dummy_event(trace_id="trace-1", name="test_span", error=None):
    return {
        "trace_id": trace_id,
        "tenant_id": "test-tenant",
        "start_time": datetime.now(UTC).isoformat(),
        "spans": [_get_dummy_span(name=name, error=error)],
    }


@pytest.mark.asyncio
async def test_health(async_client):
    res = await async_client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_ready(async_client):
    res = await async_client.get("/ready")
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_ingest_valid(async_client):
    payload = {"events": [_get_dummy_event()]}
    res = await async_client.post("/v1/ingest", json=payload)
    assert res.status_code == 202
    assert res.json()["processed"] >= 1


@pytest.mark.asyncio
async def test_ingest_wrong_tenant(async_client):
    payload = {"events": [_get_dummy_event()]}
    res = await async_client.post(
        "/v1/ingest", json=payload, headers={"Authorization": "Bearer invalid-key"}
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_get_execution_valid(async_client):
    trace_id = "trace-get-2"
    payload = {"events": [_get_dummy_event(trace_id=trace_id)]}
    await async_client.post("/v1/ingest", json=payload)

    # Wait for background task to ingest
    await asyncio.sleep(0.1)

    res = await async_client.get(f"/executions/{trace_id}")
    assert res.status_code == 200
    assert res.json()["trace_id"] == trace_id


@pytest.mark.asyncio
async def test_get_execution_wrong_tenant(async_client):
    trace_id = "trace-tenant-test-3"
    payload = {"events": [_get_dummy_event(trace_id=trace_id)]}
    await async_client.post("/v1/ingest", json=payload)

    await asyncio.sleep(0.1)

    res = await async_client.get(
        f"/executions/{trace_id}", headers={"Authorization": "Bearer other-key"}
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_diff(async_client):
    trace_a = "trace-diff-a"
    trace_b = "trace-diff-b"
    await async_client.post(
        "/v1/ingest", json={"events": [_get_dummy_event(trace_id=trace_a, name="original")]}
    )
    await async_client.post(
        "/v1/ingest", json={"events": [_get_dummy_event(trace_id=trace_b, name="modified")]}
    )

    await asyncio.sleep(0.1)

    res = await async_client.post(
        "/executions/diff", json={"execution_a": trace_a, "execution_b": trace_b}
    )
    assert res.status_code == 200
    data = res.json()
    assert "changed_nodes" in data
    assert "added_nodes" in data
    assert "removed_nodes" in data


@pytest.mark.asyncio
async def test_clusters(async_client):
    res = await async_client.get("/clusters")
    assert res.status_code == 200
    assert isinstance(res.json()["items"], list)


@pytest.mark.asyncio
async def test_incidents_lifecycle(async_client):
    trace_id = f"trace-incident-{uuid.uuid4()}"
    event = _get_dummy_event(trace_id=trace_id, name="failing_func", error="Something broke")

    # Ingest the event with an error to trigger FailureClusterEngine
    res = await async_client.post("/v1/ingest", json={"events": [event]})
    assert res.status_code == 202

    # Needs a small delay because IncidentEngine runs in background
    await asyncio.sleep(0.5)

    res = await async_client.get("/incidents")
    assert res.status_code == 200
    incidents = res.json()["items"]

    assert len(incidents) > 0

    # Find the incident for our recent error (or just the first one)
    inc_id = incidents[0]["incident_id"]

    res_ack = await async_client.post(f"/incidents/{inc_id}/ack")
    assert res_ack.status_code == 200
    assert res_ack.json()["status"] == "acknowledged"

    res_res = await async_client.post(f"/incidents/{inc_id}/resolve")
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "resolved"


@pytest.mark.asyncio
async def test_admin_register_valid(async_client):
    res = await async_client.post(
        "/admin/tenants/register",
        json={"tenant_id": "new-tenant", "admin_email": "admin@test.com"},
        headers={"X-Admin-Key": "secret-admin-key"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["tenant_id"] == "new-tenant"
    assert "api_key" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_admin_register_forbidden(async_client):
    res = await async_client.post(
        "/admin/tenants/register", json={"tenant_id": "new-tenant", "admin_email": "admin@test.com"}
    )
    assert res.status_code == 403
