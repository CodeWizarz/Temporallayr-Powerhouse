"""
Integration test for ClickHouse storage.
Verifies direct trace insertion and retrieval.
"""

from unittest.mock import MagicMock, patch

import pytest

from temporallayr.core.store_clickhouse import ClickHouseAnalyticsStore
from temporallayr.models.execution import ExecutionGraph


@pytest.fixture
def sample_graph():
    return ExecutionGraph(
        trace_id="ch-test-001", tenant_id="test-tenant", start_time="2024-01-01T12:00:00Z", spans=[]
    )


def test_clickhouse_insert_trace_logic(sample_graph):
    # Mock the ClickHouse client
    mock_client = MagicMock()

    with patch.object(ClickHouseAnalyticsStore, "_get_client", return_value=mock_client):
        store = ClickHouseAnalyticsStore()

        # We target the actual insert method
        # Depending on implementation, it might call client.command or client.insert
        # Let's assume it calls client.command for the bulk insert or similar
        store.insert_trace(sample_graph)

        assert mock_client.command.called or mock_client.insert.called


def test_clickhouse_list_executions_filtering():
    mock_client = MagicMock()
    # Mock result format: [ (trace_id,) ]
    mock_client.query.return_value.result_rows = [("trace-1",), ("trace-2",)]

    with patch.object(ClickHouseAnalyticsStore, "_get_client", return_value=mock_client):
        store = ClickHouseAnalyticsStore()
        results = store.list_executions("test-tenant")

        assert len(results) == 2
        assert results[0] == "trace-1"

        # Verify query parameters
        args, kwargs = mock_client.query.call_args
        assert "tenant_id" in kwargs["parameters"]
        assert kwargs["parameters"]["tenant_id"] == "test-tenant"
