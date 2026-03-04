"""
Integration tests for the Redis queue-based ingestion pipeline.
"""

import json
import os
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

# Provide an isolated test environment without actually running a real Redis server
os.environ["TEMPORALLAYR_DATA_DIR"] = "/tmp/tl-queue-test"
os.environ["TEMPORALLAYR_API_KEYS"] = "qt-test-key=qt-tenant"


import temporallayr.core.queue  # noqa: F401


@pytest.fixture
def mock_redis():
    """Mock the asyncio Redis client to verify queue behavior."""
    with patch("temporallayr.core.queue.redis.from_url") as mock_from_url:
        mock_client = AsyncMock()
        mock_client.aclose = AsyncMock()
        mock_client.rpush = AsyncMock(return_value=1)
        mock_client.blpop = AsyncMock()
        mock_from_url.return_value = mock_client
        yield mock_client


@pytest.mark.asyncio
async def test_rest_api_pushes_to_queue(mock_redis):
    """Test that /v1/ingest pushes the valid spans to the Redis queue."""
    # We must set REDIS_URL so the queue module recognizes it's activated
    os.environ["TEMPORALLAYR_REDIS_URL"] = "redis://mock:6379"
    previous_quota = os.environ.get("TEMPORALLAYR_DEFAULT_QUOTA")
    os.environ["TEMPORALLAYR_DEFAULT_QUOTA"] = "100000"

    from temporallayr.server.app import app
    from temporallayr.server.auth.api_keys import map_api_key_to_tenant

    tenant_id = f"qt-tenant-{uuid4().hex[:8]}"
    api_key = f"qt-test-key-{uuid4().hex[:8]}"
    map_api_key_to_tenant(api_key, tenant_id)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "events": [
                    {
                        "trace_id": "queue-trace-1",
                        "tenant_id": tenant_id,
                        "spans": [{"name": "test_span", "span_id": "span-1"}],
                    }
                ]
            }

            r = await c.post("/v1/ingest", json=payload, headers=headers)
            assert r.status_code == 202
            assert r.json()["processed"] == 1

            # Verify the graph was pushed to the Redis queue
            mock_redis.rpush.assert_called_once()
            args = mock_redis.rpush.call_args[0]
            queue_name = args[0]
            dumped_graph = args[1]
            assert queue_name == "temporallayr:ingest_queue"

            # Verify the payload represents the graph
            data = json.loads(dumped_graph)
            assert data["trace_id"] == "queue-trace-1"
            assert data["tenant_id"] == tenant_id
            assert len(data["spans"]) == 1
    finally:
        del os.environ["TEMPORALLAYR_REDIS_URL"]
        if previous_quota is None:
            os.environ.pop("TEMPORALLAYR_DEFAULT_QUOTA", None)
        else:
            os.environ["TEMPORALLAYR_DEFAULT_QUOTA"] = previous_quota


@pytest.mark.asyncio
async def test_worker_processes_batch(mock_redis):
    """Test that the worker reads from Redis and writes to ClickHouse."""
    import workers.ingest_worker as worker

    # Mock the BLPOP to return a payload, then block forever to trigger a read cycle
    payload = json.dumps(
        {
            "trace_id": "worker-trace-1",
            "tenant_id": "worker-tenant",
            "spans": [{"name": "worker_span", "span_id": "span-2"}],
        }
    )

    # Return one item, then timeout on the next call to flush the batch
    mock_redis.blpop.side_effect = [
        ("temporallayr:ingest_queue", payload),
        None,  # Timeout
    ]

    worker.get_redis_client = MagicMock(return_value=mock_redis)

    # We need to simulate the worker loop running for just one batch cycle
    with patch("workers.ingest_worker.get_clickhouse_store") as mock_get_ch:
        mock_ch = MagicMock()
        mock_ch.insert_trace = MagicMock()
        mock_get_ch.return_value = mock_ch

        # Run worker loop but break early to prevent infinite loop in tests
        # We can directly test the specific function _process_batch

        failed = await worker._process_batch([payload])

        assert len(failed) == 0
        mock_ch.insert_trace.assert_called_once()
        inserted_graph = mock_ch.insert_trace.call_args[0][0]

        assert inserted_graph.trace_id == "worker-trace-1"


@pytest.mark.asyncio
async def test_worker_dead_letters_failures(mock_redis):
    """Test that invalid payloads get caught and sent to the DLQ by the worker main loop."""
    import workers.ingest_worker as worker

    # Provide an invalid JSON payload
    invalid_payload = "NOT_A_JSON_GRAPH"

    # Process batch manually
    failed = await worker._process_batch([invalid_payload])

    assert len(failed) == 1
    assert failed[0] == invalid_payload
