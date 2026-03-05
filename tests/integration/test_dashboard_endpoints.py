"""Integration tests for traces and replay endpoints specifically used by the dashboard."""

import pytest
from fastapi.testclient import TestClient

from temporallayr.core.store import get_default_store
from temporallayr.models.execution import ExecutionGraph, ExecutionNode
from temporallayr.server.app import app
from temporallayr.server.auth.api_keys import map_api_key_to_tenant


@pytest.fixture(autouse=True)
def setup_auth(monkeypatch):
    """Bypass env config and map a test key for the endpoints."""
    monkeypatch.setenv("TEMPORALLAYR_JWT_SECRET", "test-secret")
    map_api_key_to_tenant("dev-key", "dev-tenant")


@pytest.fixture
def test_client():
    return TestClient(app)


@pytest.fixture
def sample_execution() -> ExecutionGraph:
    """Creates a sample graph in SQLite for tests to fetch."""
    graph = ExecutionGraph(
        id="trace_test_001",
        tenant_id="dev-tenant",
        spans=[
            ExecutionNode(
                id="span_1",
                name="entry_point",
                status="success",
                start_time="2025-01-01T00:00:00Z",
                end_time="2025-01-01T00:00:01Z",
                attributes={"duration_ms": 1000},
            ),
            ExecutionNode(
                id="span_2",
                parent_id="span_1",
                name="llm_call",
                status="success",
                start_time="2025-01-01T00:00:00.100Z",
                end_time="2025-01-01T00:00:00.900Z",
                attributes={
                    "duration_ms": 800,
                    "llm.token_count.total": 150,
                    "cost_usd": 0.002,
                    # Provide dummy code so replay engine has something to skip/fail gracefully on
                    "code": {"module": "math", "name": "sqrt"},
                    "inputs": {"x": 16},
                    "output": 4.0,
                },
            ),
        ],
    )
    store = get_default_store()
    store.save_execution(graph)
    return graph


def test_get_execution_for_dashboard(test_client, sample_execution):
    """Dashboard calls GET /executions/{id} to build the React Flow DAG."""
    response = test_client.get(
        f"/executions/{sample_execution.id}", headers={"Authorization": "Bearer dev-key"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["trace_id"] == "trace_test_001"
    assert len(data["spans"]) == 2

    # Check parent-child hierarchy is preserved for React Flow
    span2 = next(s for s in data["spans"] if s["span_id"] == "span_2")
    assert span2["parent_span_id"] == "span_1"
    assert span2["attributes"]["llm.token_count.total"] == 150


def test_replay_execution_for_dashboard(test_client, sample_execution):
    """Dashboard calls POST /executions/{id}/replay to get deterministic drift."""
    response = test_client.post(
        f"/executions/{sample_execution.id}/replay", headers={"Authorization": "Bearer dev-key"}
    )
    assert response.status_code == 200
    report = response.json()

    assert report["graph_id"] == "trace_test_001"
    assert report["total_nodes"] == 2
    assert "is_deterministic" in report
    assert len(report["results"]) == 2
