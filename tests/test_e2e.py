import asyncio
import os
import warnings

import pytest
from httpx import ASGITransport, AsyncClient

warnings.simplefilter("ignore", DeprecationWarning)

from temporallayr.core.decorators import track
from temporallayr.core.recorder import ExecutionRecorder
from temporallayr.server.app import app
from temporallayr.server.auth.api_keys import delete_keys_for_tenant, map_api_key_to_tenant

# Fixtures


@pytest.fixture(scope="module", autouse=True)
def setup_e2e_env():
    """Module-scoped fixture that seeds admin key before all tests."""
    os.environ["TEMPORALLAYR_ADMIN_KEY"] = "e2e-admin-key"
    os.environ["TEMPORALLAYR_RATE_LIMIT_ENABLED"] = "false"
    # Seed a basic tenant
    delete_keys_for_tenant("e2e-tenant")
    map_api_key_to_tenant("e2e-seed-key", "e2e-tenant")
    yield
    # Cleanup
    delete_keys_for_tenant("e2e-tenant")


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


# Test pipelines


@track()
def fake_llm_call(x):
    return x * 2


@track()
def my_pipeline():
    a = fake_llm_call(5)
    b = fake_llm_call(a)
    return b


@track()
def faulty_pipeline():
    fake_llm_call(1)
    raise ValueError("System explosion")


class TestE2EPipeline:
    @pytest.mark.asyncio
    async def test_full_pipeline(self, async_client, monkeypatch):
        # 1. POST /admin/tenants/register → assert 201, capture api_key
        res_reg = await async_client.post(
            "/admin/tenants/register",
            json={"tenant_id": "e2e-test-tenant", "admin_email": "e2e@test.com"},
            headers={"X-Admin-Key": "e2e-admin-key"},
        )
        assert res_reg.status_code == 201, res_reg.text
        api_key = res_reg.json()["api_key"]

        # Configure the SDK explicitly using client logic to ensure ExecutionRecorder transport hooks work natively.
        import temporallayr.client

        temporallayr.client.init(server_url="http://test", api_key=api_key)
        os.environ["TEMPORALLAYR_TENANT_ID"] = "e2e-test-tenant"

        # Mock the instantiation of httpx.AsyncClient in the SDK transport
        from temporallayr.client import get_sdk

        transport = get_sdk().transport
        transport._client = async_client  # Overwrite so it uses ASGITransport
        await transport.start()

        # 2. Run fake_llm_call pipeline inside ExecutionRecorder — assert graph.nodes has >= 2 spans
        async with ExecutionRecorder() as recorder:
            res = my_pipeline()
            assert res == 20

        graph_id = recorder.graph.id
        nodes = list(recorder.graph.nodes.values())
        assert len(nodes) >= 2

        # Allow background task to ingest
        await asyncio.sleep(0.5)

        # Update headers with api_key for future requests
        auth_headers = {"Authorization": f"Bearer {api_key}"}

        # 3. GET /executions/{graph.id} via API → assert 200, span count matches
        res_exec = await async_client.get(f"/executions/{graph_id}", headers=auth_headers)
        assert res_exec.status_code == 200, res_exec.text
        exec_data = res_exec.json()
        assert len(exec_data["spans"]) == len(nodes)

        # 4. Run second pipeline with a @track decorated function that raises ValueError
        try:
            async with ExecutionRecorder() as recorder2:
                faulty_pipeline()
        except ValueError:
            pass

        graph2_id = recorder2.graph.id
        await asyncio.sleep(0.5)  # Wait for ingestion and incident evaluation

        # 5. GET /clusters → assert len >= 1, clusters[0] has "failing_node" key
        res_clusters = await async_client.get("/clusters", headers=auth_headers)
        assert res_clusters.status_code == 200, res_clusters.text
        clusters = res_clusters.json()["items"]
        assert len(clusters) >= 1
        assert "failing_node" in clusters[0]

        # 6. GET /incidents → assert len >= 1, incidents[0]["status"] == "open"

        max_retries = 10
        incidents = []
        for _ in range(max_retries):
            res_incidents = await async_client.get("/incidents", headers=auth_headers)
            assert res_incidents.status_code == 200, res_incidents.text
            incidents = res_incidents.json()["items"]
            if len(incidents) >= 1 and incidents[0]["status"] == "open":
                break
            await asyncio.sleep(0.5)

        assert len(incidents) >= 1, f"Failed to retrieve incidents after {max_retries} retries"
        assert incidents[0]["status"] == "open"
        incident_id = incidents[0]["incident_id"]

        # 7. POST /incidents/{id}/ack → assert status == "acknowledged"
        res_ack = await async_client.post(f"/incidents/{incident_id}/ack", headers=auth_headers)
        assert res_ack.status_code == 200, res_ack.text
        assert res_ack.json()["status"] == "acknowledged"

        # 8. POST /incidents/{id}/resolve → assert status == "resolved"
        res_resolve = await async_client.post(
            f"/incidents/{incident_id}/resolve", headers=auth_headers
        )
        assert res_resolve.status_code == 200, res_resolve.text
        assert res_resolve.json()["status"] == "resolved"

        # 9. GET /audit-log → assert entries contain event_type == "incident_change"
        res_audit = await async_client.get("/audit-log", headers=auth_headers)
        assert res_audit.status_code == 200, res_audit.text
        audit_entries = res_audit.json()["items"]
        event_types = [entry["event_type"] for entry in audit_entries]
        assert "incident_change" in event_types

        # 10. POST /executions/diff with graph.id + second graph.id → assert response has changed_nodes or removed_nodes (not all empty)
        res_diff = await async_client.post(
            "/executions/diff",
            json={"execution_a": graph_id, "execution_b": graph2_id},
            headers=auth_headers,
        )
        assert res_diff.status_code == 200, res_diff.text
        diff_data = res_diff.json()
        assert (
            bool(diff_data.get("changed_nodes"))
            or bool(diff_data.get("removed_nodes"))
            or bool(diff_data.get("added_nodes"))
        )

        # 11. POST /executions/{id}/replay → assert ReplayReport returned with total_nodes >= 2
        res_replay = await async_client.post(f"/executions/{graph_id}/replay", headers=auth_headers)
        assert res_replay.status_code == 200, res_replay.text
        replay_data = res_replay.json()
        assert replay_data["total_nodes"] >= 2

        # Cleanup test transport
        await transport.shutdown()
