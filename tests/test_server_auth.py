import pytest
from fastapi.testclient import TestClient

from temporallayr.server.app import app
from temporallayr.server.auth.api_keys import generate_api_key, map_api_key_to_tenant

client = TestClient(app)


def test_ingest_auth():
    # Insert a dummy API key for tenant-A
    token_a = generate_api_key()
    map_api_key_to_tenant(token_a, "tenant-A")

    # 1. No token returns 401
    resp = client.post("/v1/ingest", json={"events": []})
    assert resp.status_code == 401
    assert resp.json() == {"error": "unauthorized"}

    # 2. Token bound to tenant-A and X-Tenant-Id: tenant-B returns 401
    resp = client.post(
        "/v1/ingest",
        json={"events": []},
        headers={"Authorization": f"Bearer {token_a}", "X-Tenant-Id": "tenant-B"},
    )
    assert resp.status_code == 401
    assert resp.json() == {"error": "tenant_mismatch"}

    # 3. Valid match returns 202
    resp = client.post(
        "/v1/ingest",
        json={"events": []},
        headers={"Authorization": f"Bearer {token_a}", "X-Tenant-Id": "tenant-A"},
    )
    assert resp.status_code == 202
