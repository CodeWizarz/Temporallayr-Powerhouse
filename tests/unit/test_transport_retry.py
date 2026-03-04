"""Tests for SDK async HTTP transport with exponential backoff."""

from unittest.mock import AsyncMock

import httpx
import pytest

from temporallayr.sdk.transport import HTTPTransport


@pytest.mark.asyncio
async def test_transport_success():
    """Test successful send_batch without retries."""
    transport = HTTPTransport("http://test", "key")
    transport._client.post = AsyncMock()
    transport._client.post.return_value.raise_for_status = lambda: None

    success = await transport.send_batch([{"id": 1}])
    assert success is True
    assert transport._client.post.call_count == 1
    await transport.shutdown()


@pytest.mark.asyncio
async def test_transport_retry_success():
    """Test transport successfully retrying after a failure."""
    transport = HTTPTransport("http://test", "key", max_retries=2, base_backoff=0.01)

    mock_post = AsyncMock()
    mock_post.side_effect = [
        httpx.HTTPError("error"),
        AsyncMock(),  # Success on second try
    ]
    transport._client.post = mock_post

    success = await transport.send_batch([{"id": 1}])
    assert success is True
    assert mock_post.call_count == 2
    await transport.shutdown()


@pytest.mark.asyncio
async def test_transport_retry_exhausted():
    """Test transport correctly fails after exhausting max_retries."""
    transport = HTTPTransport("http://test", "key", max_retries=2, base_backoff=0.01)

    mock_post = AsyncMock()
    mock_post.side_effect = httpx.HTTPError("error")
    transport._client.post = mock_post

    success = await transport.send_batch([{"id": 1}])
    assert success is False
    assert mock_post.call_count == 3  # initial + 2 retries
    await transport.shutdown()
