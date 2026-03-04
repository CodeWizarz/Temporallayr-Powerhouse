"""Tests for async queue-based SDK batching."""

import asyncio
from unittest.mock import AsyncMock

import pytest

from temporallayr.sdk.batching import SpanBatcher


@pytest.mark.asyncio
async def test_span_batcher_flushes_on_size():
    """Test that the worker flushes the batch when queue size hits limit."""
    mock_http = AsyncMock()
    batcher = SpanBatcher(mock_http, batch_size=2, flush_interval=10.0)
    batcher.start()

    await batcher.add({"id": 1})
    await batcher.add({"id": 2})

    # Give the background worker a moment to process the queue
    for _ in range(5):
        await asyncio.sleep(0.01)
        if mock_http.send_batch.called:
            break

    mock_http.send_batch.assert_called_once()
    assert len(mock_http.send_batch.call_args[0][0]) == 2

    await batcher.shutdown()


@pytest.mark.asyncio
async def test_span_batcher_flushes_on_interval():
    """Test that the worker flushes the batch when the time interval is reached."""
    mock_http = AsyncMock()
    batcher = SpanBatcher(mock_http, batch_size=10, flush_interval=0.1)
    batcher.start()

    await batcher.add({"id": 1})

    await asyncio.sleep(0.15)  # Wait for interval

    mock_http.send_batch.assert_called_once()
    assert len(mock_http.send_batch.call_args[0][0]) == 1

    await batcher.shutdown()


@pytest.mark.asyncio
async def test_span_batcher_flushes_on_shutdown():
    """Test that remaining queue items are flushed on shutdown."""
    mock_http = AsyncMock()
    batcher = SpanBatcher(mock_http, batch_size=10, flush_interval=10.0)
    batcher.start()

    await batcher.add({"id": 1})

    assert not mock_http.send_batch.called
    await batcher.shutdown()

    mock_http.send_batch.assert_called_once()
    assert len(mock_http.send_batch.call_args[0][0]) == 1
