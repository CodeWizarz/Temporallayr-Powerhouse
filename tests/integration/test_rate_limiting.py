"""Integration test: rate limiting on /v1/ingest via ASGI."""

import os

import pytest
from httpx import ASGITransport, AsyncClient

# Use env-var fallback auth (key=tenant pairs) — no SQLite seeding needed
os.environ["TEMPORALLAYR_INGEST_RATE_LIMIT"] = "5"  # low limit for testing
os.environ["TEMPORALLAYR_API_KEYS"] = "rl-test-key=rl-tenant"
os.environ["TEMPORALLAYR_API_KEY"] = "rl-test-key"
os.environ["TEMPORALLAYR_ADMIN_KEY"] = "rl-admin-key"
os.environ["TEMPORALLAYR_TENANT_ID"] = "rl-tenant"

from temporallayr.server.app import app  # noqa: E402 — must come after env setup


@pytest.mark.asyncio
async def test_rate_limit_enforced():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        headers = {
            "Authorization": "Bearer rl-test-key",
            "X-Tenant-Id": "rl-tenant",
            "Content-Type": "application/json",
        }
        # First 5 should pass
        for i in range(5):
            r = await c.post("/v1/ingest", json={"events": []}, headers=headers)
            assert r.status_code == 202, f"Request {i} failed: {r.status_code} — {r.text}"

        # 6th should be rate limited
        r = await c.post("/v1/ingest", json={"events": []}, headers=headers)
        assert r.status_code == 429
        assert "Retry-After" in r.headers
