import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from temporallayr.server.app import app
from temporallayr.server.auth.api_keys import generate_api_key, map_api_key_to_tenant


@pytest.fixture
def override_env(monkeypatch):
    monkeypatch.setenv("TEMPORALLAYR_RATE_LIMIT_ENABLED", "true")


@pytest.fixture
async def async_client(override_env):
    key = generate_api_key()
    map_api_key_to_tenant(key, "test-limit-tenant")

    transport = ASGITransport(app=app)
    # The slowapi extension requires client IP to be defined to function properly
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={"Authorization": f"Bearer {key}"},
    ) as ac:
        yield ac


@pytest.mark.asyncio
async def test_rate_limit_analytics_latency(async_client):
    # GET /analytics/latency is limited to 100/minute

    # Send 100 requests (we'll just do a smaller burst on a mock endpoint if possible, but the limit is hardcoded 100)
    # 100 requests will succeed
    # To avoid writing a massive test execution loop, we will just make it hit the limit.
    # Actually making 101 simple test requests across the ASGI layer is very fast locally.
    tasks = []
    for _ in range(100):
        tasks.append(async_client.get("/analytics/latency"))

    responses = await asyncio.gather(*tasks)

    # Most/all should be 200 or 503 depending on clickhouse being up.
    # What matters is that they aren't 429 yet.
    # 101st request should fail.

    res = await async_client.get("/analytics/latency")
    assert res.status_code == 429
    data = res.json()
    assert data["error"] == "rate_limit_exceeded"
    assert "retry_after_seconds" in data

    # Using the same test key but another endpoint
    # GET /analytics/trends is handled separately
    res_trends = await async_client.get("/analytics/trends")
    assert res_trends.status_code != 429
