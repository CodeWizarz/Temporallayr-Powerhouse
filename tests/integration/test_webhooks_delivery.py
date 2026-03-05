"""
Integration test for webhooks delivery.
Verifies that incidents correctly trigger configured webhooks.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from temporallayr.core.webhooks import WebhookConfig, dispatch_incident_async, fire_webhook


@pytest.fixture
def sample_incident():
    return {
        "incident_id": "inc-123",
        "tenant_id": "test-tenant",
        "cluster_id": "cluster-456",
        "severity": "critical",
        "status": "open",
        "count": 1,
        "first_seen": "2024-01-01T00:00:00Z",
        "failing_node": "llm_node",
    }


def test_fire_webhook_generic_success(sample_incident):
    config = WebhookConfig(url="http://example.com/webhook", provider="generic")

    with patch("temporallayr.core.webhooks.urlopen") as mock_open:
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.__enter__.return_value = mock_resp
        mock_open.return_value = mock_resp

        result = fire_webhook(config, sample_incident)
        assert result is True

        args, kwargs = mock_open.call_args
        request = args[0]
        assert request.full_url == "http://example.com/webhook"
        body = json.loads(request.data)
        assert body["incident"]["incident_id"] == "inc-123"


@pytest.mark.asyncio
async def test_dispatch_incident_async_multi(sample_incident):
    # Mock get_global_webhooks to return two configs
    configs = [
        WebhookConfig(url="http://hook1.com", provider="generic"),
        WebhookConfig(url="http://hook2.com", provider="slack"),
    ]

    with patch("temporallayr.core.webhooks.get_global_webhooks", return_value=configs):
        with patch("temporallayr.core.webhooks.fire_webhook") as mock_fire:
            mock_fire.return_value = True
            await dispatch_incident_async(sample_incident)
            assert mock_fire.call_count == 2
