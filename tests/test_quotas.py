import pytest
import asyncio
import uuid
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport

from temporallayr.server.app import app
from temporallayr.core.store_sqlite import SQLiteStore
from temporallayr.server.auth.api_keys import map_api_key_to_tenant, delete_keys_for_tenant


@pytest.fixture(autouse=True)
def setup_env(monkeypatch):
    monkeypatch.setenv("TEMPORALLAYR_ADMIN_KEY", "secret-admin-key")
    monkeypatch.setenv("TEMPORALLAYR_RATE_LIMIT_ENABLED", "false")
    monkeypatch.setenv("TEMPORALLAYR_QUOTA_ENABLED", "true")

    delete_keys_for_tenant("test-tenant")
    map_api_key_to_tenant("test-key", "test-tenant")

    store = SQLiteStore()
    store._initialize_schema()

    # Establish a very low quota specifically for tests evaluating blocks mappings cleanly!
    store.upsert_quota("test-tenant", daily=5, monthly=100)

    # Clean usage tables prior natively preventing contamination
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with store._get_connection() as conn:
        conn.execute("DELETE FROM tenant_usage WHERE tenant_id = ?", ("test-tenant",))
        conn.commit()


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test", headers={"Authorization": "Bearer test-key"}
    ) as client:
        yield client


def _get_dummy_event(spans_count=1):
    spans = []
    for _ in range(spans_count):
        spans.append(
            {
                "span_id": str(uuid.uuid4()),
                "parent_span_id": None,
                "name": "test_span",
                "start_time": datetime.now(timezone.utc).isoformat(),
                "status": "success",
                "attributes": {},
            }
        )
    return {
        "trace_id": str(uuid.uuid4()),
        "tenant_id": "test-tenant",
        "start_time": datetime.now(timezone.utc).isoformat(),
        "spans": spans,
    }


@pytest.mark.asyncio
async def test_quota_allows_within_limits(async_client):
    # Daily quota is configured to 5 spans
    # Insert 3 spans - this should 202 Accept
    event = _get_dummy_event(spans_count=3)
    res = await async_client.post("/v1/ingest", json={"events": [event]})
    assert res.status_code == 202

    # Insert 2 spans - this should 202 Accept
    event2 = _get_dummy_event(spans_count=2)
    res2 = await async_client.post("/v1/ingest", json={"events": [event2]})
    assert res2.status_code == 202

    # Verify Usage mapping properly reads bounds
    usage_res = await async_client.get("/usage")
    assert usage_res.status_code == 200
    usage_data = usage_res.json()
    assert usage_data["today"]["spans"] == 5
    assert usage_data["today"]["traces"] == 2
    assert usage_data["limits"]["daily"] == 5


@pytest.mark.asyncio
async def test_quota_blocks_exceeding_limits(async_client):
    # Daily quota is configured to 5 spans
    # Insert 6 spans - this should immediately 429 Fail
    event = _get_dummy_event(spans_count=6)
    res = await async_client.post("/v1/ingest", json={"events": [event]})
    assert res.status_code == 429

    data = res.json()
    assert data["error"] == "quota_exceeded"
    assert data["limit"] == 5
    assert data["used"] == 6  # Indicates attempted calculation


@pytest.mark.asyncio
async def test_quota_admin_upsert(async_client):
    # Upsert the local tenants quota gracefully extending boundaries!
    admin_client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    res = await admin_client.post(
        "/admin/tenants/test-tenant/quota",
        json={"daily_span_limit": 500, "monthly_span_limit": 10000},
        headers={"X-Admin-Key": "secret-admin-key"},
    )
    assert res.status_code == 200

    # Validate updating allows new evaluations!
    usage_res = await async_client.get("/usage")
    usage_data = usage_res.json()
    assert usage_data["limits"]["daily"] == 500
