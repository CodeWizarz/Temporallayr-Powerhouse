"""Unit tests for webhook payload builders."""

from temporallayr.core.webhooks import (
    _build_slack_body,
    _build_pagerduty_body,
    _build_generic_body,
    _sign_payload,
)

INCIDENT = {
    "incident_id": "inc-abc123",
    "tenant_id": "acme",
    "severity": "critical",
    "failing_node": "risk_model",
    "count": 47,
    "cluster_id": "cluster-xyz",
    "first_seen": "2026-03-04T10:00:00Z",
}


def test_slack_body_structure():
    body = _build_slack_body(INCIDENT)
    assert "blocks" in body
    assert "text" in body
    assert "CRITICAL" in body["text"]


def test_pagerduty_body():
    body = _build_pagerduty_body(INCIDENT, routing_key="test-key")
    assert body["routing_key"] == "test-key"
    assert body["event_action"] == "trigger"
    assert body["dedup_key"] == "inc-abc123"
    assert body["payload"]["severity"] == "critical"


def test_generic_body():
    body = _build_generic_body(INCIDENT, "incident.created")
    assert body["event"] == "incident.created"
    assert body["incident"]["incident_id"] == "inc-abc123"
    assert "timestamp" in body


def test_hmac_signature():
    payload = b'{"test": true}'
    sig = _sign_payload(payload, "my-secret")
    assert sig.startswith("sha256=")
    assert len(sig) > 10


def test_different_secrets_different_sigs():
    payload = b'{"test": true}'
    sig1 = _sign_payload(payload, "secret-a")
    sig2 = _sign_payload(payload, "secret-b")
    assert sig1 != sig2
