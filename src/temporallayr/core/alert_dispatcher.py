"""
Production alert dispatchers for routing incident notifications across external channels.
"""

import json
import logging
import os
from typing import Any

import certifi
import httpx

logger = logging.getLogger(__name__)


class AlertDispatcher:
    """
    Handles synchronous dispatch of newly generated incident events or severity escalations.
    """

    @classmethod
    def dispatch(cls, incident: dict[str, Any], event_type: str = "new_incident") -> None:
        """
        Routes an incident payload to all appropriately configured channels natively.
        event_type implies context context: 'new_incident' or 'severity_upgrade'
        """
        payload = {
            "event": event_type,
            "incident_id": incident["incident_id"],
            "tenant_id": incident.get("tenant_id", "default"),
            "severity": incident["severity"],
            "cluster_id": incident["cluster_id"],
            "status": incident["status"],
            "first_seen": incident["first_seen"],
            "last_seen": incident["last_seen"],
            "count": incident["count"],
        }

        cls._dispatch_webhook(payload)
        cls._dispatch_slack(payload)
        cls._dispatch_email(payload)

    @classmethod
    def _dispatch_webhook(cls, payload: dict[str, Any]) -> None:
        """Standard HTTP POST generic webhook integration."""
        webhook_url = os.environ.get("TEMPORALLAYR_WEBHOOK_URL")
        if not webhook_url:
            return

        try:
            res = httpx.post(
                webhook_url,
                json=payload,
                headers={"User-Agent": "Temporallayr/1.0.0"},
                timeout=5.0,
                verify=certifi.where(),
            )
            if res.status_code >= 400:
                logger.error(
                    f"Webhook dispatch failed with status: {res.status_code}",
                    extra={
                        "webhook_url": url,
                        "status_code": res.status_code,
                        "response": res.text,
                    },
                )
        except Exception as e:
            logger.error("Failed to cleanly dispatch generic webhook", exc_info=True)

    @classmethod
    def _dispatch_slack(cls, payload: dict[str, Any]) -> None:
        """Optimized dispatch native to Slack Block Kit."""
        slack_url = os.environ.get("TEMPORALLAYR_SLACK_WEBHOOK_URL")
        if not slack_url:
            return

        emoji = "🚨" if payload.get("severity") == "critical" else "⚠️"
        event_title = (
            "New Incident Detected"
            if payload.get("event") == "new_incident"
            else "Incident Severity Upgraded"
        )

        slack_payload = {
            "text": (
                f"{emoji} {event_title}: {payload['incident_id']} [{payload['severity'].upper()}]"
            ),
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{emoji} {event_title}",
                    },
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Incident ID:*\n`{payload['incident_id']}`"},
                        {"type": "mrkdwn", "text": f"*Tenant:*\n`{payload['tenant_id']}`"},
                        {"type": "mrkdwn", "text": f"*Severity:*\n*{payload['severity'].upper()}*"},
                        {"type": "mrkdwn", "text": f"*Cluster:*\n`{payload['cluster_id']}`"},
                        {"type": "mrkdwn", "text": f"*Total Occurrences:*\n{payload['count']}"},
                        {"type": "mrkdwn", "text": f"*Status:*\n{payload['status'].capitalize()}"},
                    ],
                },
            ],
        }

        try:
            res = httpx.post(slack_url, json=slack_payload, timeout=5.0, verify=certifi.where())
            if res.status_code >= 400:
                logger.error(
                    f"Slack webhook dispatch failed with status: {res.status_code}",
                    extra={"webhook_url": slack_url, "status_code": res.status_code},
                )
        except Exception:
            logger.error("Failed to cleanly dispatch slack webhook", exc_info=True)

    @classmethod
    def _dispatch_email(cls, payload: dict[str, Any]) -> None:
        """
        Rudimentary integration bound for SMTP or an Email API.
        For demonstration, assumes a mock TEMPORALLAYR_EMAIL_API_URL interface natively.
        """
        email_api_url = os.environ.get("TEMPORALLAYR_EMAIL_API_URL")
        target_email = os.environ.get("TEMPORALLAYR_ALERT_EMAIL")

        if not email_api_url or not target_email:
            return

        event_title = (
            "New Incident Detected"
            if payload.get("event") == "new_incident"
            else "Incident Severity Upgraded"
        )

        email_payload = {
            "to": target_email,
            "subject": f"[{payload['severity'].upper()}] {event_title} in {payload['tenant_id']}",
            "body": json.dumps(payload, indent=2),
        }

        try:
            res = httpx.post(email_api_url, json=email_payload, timeout=5.0, verify=certifi.where())
            if res.status_code >= 400:
                logger.error(
                    f"Email API dispatch failed with status: {res.status_code}",
                    extra={"api_url": email_api_url, "status_code": res.status_code},
                )
        except Exception:
            logger.error("Failed to cleanly dispatch email API", exc_info=True)
