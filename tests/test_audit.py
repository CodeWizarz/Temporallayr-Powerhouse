import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
import uuid
from datetime import datetime, timezone

from temporallayr.server.app import app
from temporallayr.server.auth.api_keys import map_api_key_to_tenant, delete_keys_for_tenant
from temporallayr.core.store_sqlite import SQLiteStore


@pytest.fixture(autouse=True)
def setup_env(monkeypatch):
    monkeypatch.setenv("TEMPORALLAYR_ADMIN_KEY", "secret-admin-key")
    monkeypatch.setenv("TEMPORALLAYR_RATE_LIMIT_ENABLED", "false")
    delete_keys_for_tenant("test-tenant")
    map_api_key_to_tenant("test-key", "test-tenant")

    # Initialize DB schema explicitly
    SQLiteStore()._initialize_schema()


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test", headers={"Authorization": "Bearer test-key"}
    ) as client:
        yield client


def _get_dummy_event(trace_id="trace-1", name="test_span", error=None):
    span_id = str(uuid.uuid4())
    s = {
        "span_id": span_id,
        "parent_span_id": None,
        "name": name,
        "start_time": datetime.now(timezone.utc).isoformat(),
        "status": "error" if error else "success",
        "attributes": {"error": error} if error else {},
    }
    return {
        "trace_id": trace_id,
        "tenant_id": "test-tenant",
        "start_time": datetime.now(timezone.utc).isoformat(),
        "spans": [s],
    }


@pytest.mark.asyncio
async def test_incident_ack_writes_audit(async_client):
    trace_id = f"trace-incident-{uuid.uuid4()}"
    event = _get_dummy_event(trace_id=trace_id, name="failing_func", error="Something broke")

    res = await async_client.post("/v1/ingest", json={"events": [event]})
    assert res.status_code == 202

    await asyncio.sleep(0.5)

    res = await async_client.get("/incidents")
    assert res.status_code == 200
    incidents = res.json()["items"]
    assert len(incidents) > 0
    inc_id = incidents[0]["incident_id"]

    res_ack = await async_client.post(f"/incidents/{inc_id}/ack")
    assert res_ack.status_code == 200

    res_audit = await async_client.get("/audit-log")
    assert res_audit.status_code == 200
    audits = res_audit.json()["items"]

    # Check if there is an entry with event_type=incident_change and action=ack
    found = False
    for a in audits:
        if a.get("event_type") == "incident_change" and a.get("action") == "ack":
            found = True
            break

    assert found


@pytest.mark.asyncio
async def test_admin_audit_log(async_client):
    res_audit = await async_client.get(
        "/admin/audit-log", headers={"X-Admin-Key": "secret-admin-key"}
    )
    assert res_audit.status_code == 200
    assert "items" in res_audit.json()
