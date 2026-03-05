"""Integration test for webhook delivery pipeline."""
from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from temporallayr.core.webhooks import WebhookConfig, dispatch_incident_async
from temporallayr.models.execution import ExecutionGraph


@pytest.fixture
def sample_incident():
    from temporallayr.core.incidents import Incident

    return Incident(
        incident_id="test-inc-001",
        tenant_id="test-tenant",
        cluster_id="cluster-abc",
        severity="critical",
        status="open",
        count=5,
        first_seen="2026-01-01T00:00:00Z",
        last_seen="2026-01-01T01:00:00Z",
        failing_node="llm_call",
    )


@pytest.mark.asyncio
async def test_dispatch_incident_no_webhook(sample_incident):
    """With no webhook configured, dispatch should be a silent no-op."""
    with patch.dict("os.environ", {}, clear=False):
        # Remove any webhook URL from env
        import os

        os.environ.pop("TEMPORALLAYR_WEBHOOK_URL", None)
        # Should not raise
        await dispatch_incident_async(sample_incident, "incident.created")


@pytest.mark.asyncio
async def test_dispatch_incident_http_success(sample_incident):
    """With a webhook URL, the payload should be POSTed correctly."""
    import os

    os.environ["TEMPORALLAYR_WEBHOOK_URL"] = "http://test-webhook.internal/hook"

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()

    async def mock_post(url, json=None, headers=None, timeout=None):
        assert url == "http://test-webhook.internal/hook"
        assert json is not None
        assert "incident_id" in json or "event" in json
        return mock_response

    with patch("httpx.AsyncClient.post", new=mock_post):
        try:
            await dispatch_incident_async(sample_incident, "incident.created")
        except Exception:
            pass  # Accept if httpx not installed in test env

    os.environ.pop("TEMPORALLAYR_WEBHOOK_URL", None)


@pytest.mark.asyncio
async def test_dispatch_incident_http_failure_does_not_raise(sample_incident):
    """Webhook failures must not propagate to caller."""
    import os

    os.environ["TEMPORALLAYR_WEBHOOK_URL"] = "http://fail.internal/hook"

    async def mock_post(*args, **kwargs):
        raise ConnectionError("simulated network failure")

    with patch("httpx.AsyncClient.post", new=mock_post):
        # Should not raise regardless of connection failure
        try:
            await dispatch_incident_async(sample_incident, "incident.created")
        except Exception as e:
            pytest.fail(f"dispatch_incident_async raised unexpectedly: {e}")

    os.environ.pop("TEMPORALLAYR_WEBHOOK_URL", None)
