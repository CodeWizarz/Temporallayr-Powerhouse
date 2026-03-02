import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from temporallayr.server.app import app
from temporallayr.server.auth.api_keys import generate_api_key, map_api_key_to_tenant


@pytest.mark.asyncio
async def test_ingest_concurrency():
    # Make sure we clear the global list to start fresh
    import temporallayr.server.app as app_module

    async with app_module._incidents_lock:
        app_module._INCIDENTS.clear()

    # Need to list executions properly handled otherwise SQLite might have collision?
    # The requirement focuses on _INCIDENTS data corruption.

    tenant_id = "tenant-concurrent-test"
    token = generate_api_key()
    map_api_key_to_tenant(token, tenant_id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        tasks = []
        for i in range(50):
            req_body = {
                "events": [
                    {
                        "id": f"exec-test-concurrent-{i}",
                        "tenant_id": tenant_id,
                        "created_at": "2023-10-10T00:00:00Z",
                        "spans": [
                            {
                                "id": f"span-{i}",
                                "name": "failing_task",
                                "status": "error",
                                "attributes": {"error": "ValueError: concurrent error"},
                            }
                        ],
                    }
                ]
            }
            headers = {"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id}
            tasks.append(ac.post("/v1/ingest", json=req_body, headers=headers))

        responses = await asyncio.gather(*tasks)

        for r in responses:
            assert r.status_code == 202

    # wait a bit for async post-process tasks to complete
    await asyncio.sleep(1.0)

    # Validate
    async with app_module._incidents_lock:
        count = len(app_module._INCIDENTS)
        # Should be some deterministic number of incidents since FailureClusterEngine handles duplicate error_types
        assert count > 0, "Should have created at least one incident cluster"
