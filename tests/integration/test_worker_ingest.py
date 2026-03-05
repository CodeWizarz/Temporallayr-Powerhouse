"""
Integration test for background ingest worker.
Verifies the Redis queue -> Worker -> ClickHouse flow.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from workers.ingest_worker import _process_batch


@pytest.fixture
def sample_graph_json():
    return json.dumps(
        {
            "trace_id": "test-trace-789",
            "tenant_id": "test-tenant",
            "start_time": "2024-01-01T00:00:00Z",
            "spans": [],
        }
    )


@pytest.mark.asyncio
async def test_worker_process_batch_success(sample_graph_json):
    batch = [sample_graph_json]

    # Mock ClickHouse store
    mock_ch = MagicMock()

    with patch("workers.ingest_worker.get_clickhouse_store", return_value=mock_ch):
        with patch(
            "temporallayr.core.store_clickhouse.ClickHouseAnalyticsStore", return_value=mock_ch
        ):
            # We use to_thread in worker so we mock that or the direct insert_trace
            with patch("asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
                failed = await _process_batch(batch)

                assert len(failed) == 0
                assert mock_thread.call_count == 1
                # First arg is the function (bulk_insert_traces), second is the list of graphs
                args, _ = mock_thread.call_args
                assert isinstance(args[1], list)
                assert len(args[1]) == 1
                assert args[1][0].trace_id == "test-trace-789"


@pytest.mark.asyncio
async def test_worker_process_batch_invalid_json():
    batch = ["invalid-json"]

    failed = await _process_batch(batch)
    assert len(failed) == 1
    assert failed[0] == "invalid-json"
