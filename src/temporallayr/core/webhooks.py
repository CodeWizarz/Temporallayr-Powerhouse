"""
Webhook alert dispatcher.
Fires HTTP POST to tenant-configured URLs when incidents change state.
Supports: generic HTTP, Slack incoming webhooks, PagerDuty Events v2.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Literal
from urllib.error import URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


@dataclass
class WebhookConfig:
    url: str
    provider: Literal["generic", "slack", "pagerduty"] = "generic"
    secret: str | None = None  # HMAC-SHA256 signing secret (generic)
    routing_key: str | None = None  # PagerDuty Events v2 routing key


def _sign_payload(payload: bytes, secret: str) -> str:
    sig = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return f"sha256={sig}"


def _build_slack_body(incident: dict[str, Any]) -> dict:
    severity = incident.get("severity", "normal")
    emoji = {"critical": "🔴", "high": "🟠", "normal": "🟡"}.get(severity, "⚪")
    return {
        "text": f"{emoji} *TemporalLayr Incident* — {incident.get('severity', '').upper()}",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"{emoji} *New Incident* (`{incident.get('incident_id', '')[:8]}`)\n"
                        f"*Severity:* {incident.get('severity', 'unknown').upper()}\n"
                        f"*Failing node:* `{incident.get('failing_node', 'unknown')}`\n"
                        f"*Count:* {incident.get('count', 0)}\n"
                        f"*Tenant:* `{incident.get('tenant_id', 'unknown')}`"
                    ),
                },
            },
        ],
    }


def _build_pagerduty_body(incident: dict[str, Any], routing_key: str) -> dict:
    severity_map = {"critical": "critical", "high": "error", "normal": "warning"}
    return {
        "routing_key": routing_key,
        "event_action": "trigger",
        "dedup_key": incident.get("incident_id", ""),
        "payload": {
            "summary": f"[TemporalLayr] {incident.get('failing_node', 'Agent failure')} — {incident.get('severity', '').upper()}",
            "severity": severity_map.get(incident.get("severity", "normal"), "warning"),
            "source": "TemporalLayr",
            "custom_details": {
                "tenant_id": incident.get("tenant_id"),
                "count": incident.get("count"),
                "cluster_id": incident.get("cluster_id"),
                "first_seen": incident.get("first_seen"),
            },
        },
    }


def _build_generic_body(incident: dict[str, Any], event_type: str) -> dict:
    return {
        "event": event_type,
        "timestamp": time.time(),
        "incident": incident,
        "source": "temporallayr",
    }


def fire_webhook(
    config: WebhookConfig,
    incident: dict[str, Any],
    event_type: str = "incident.created",
) -> bool:
    """
    Fire a single webhook. Returns True on success, False on failure.
    Runs synchronously — call from a background thread/task.
    """
    try:
        if config.provider == "slack":
            body = json.dumps(_build_slack_body(incident)).encode()
        elif config.provider == "pagerduty":
            rk = config.routing_key or os.getenv("TEMPORALLAYR_PAGERDUTY_ROUTING_KEY") or ""
            if not rk:
                logger.warning("PagerDuty routing key missing")
                return False
            body = json.dumps(_build_pagerduty_body(incident, rk)).encode()
        else:
            body = json.dumps(_build_generic_body(incident, event_type)).encode()

        headers = {"Content-Type": "application/json", "User-Agent": "TemporalLayr/0.2.1"}
        if config.secret and config.provider == "generic":
            headers["X-TemporalLayr-Signature"] = _sign_payload(body, config.secret)

        req = Request(config.url, data=body, headers=headers, method="POST")
        with urlopen(req, timeout=10) as resp:
            ok = 200 <= resp.status < 300
            if not ok:
                logger.warning(
                    "Webhook returned non-2xx", extra={"status": resp.status, "url": config.url}
                )
            return ok

    except URLError as e:
        logger.error("Webhook delivery failed", extra={"url": config.url, "error": str(e)})
        return False
    except Exception as e:
        logger.error("Webhook unexpected error", extra={"url": config.url, "error": str(e)})
        return False


def get_global_webhooks() -> list[WebhookConfig]:
    """
    Load global webhooks from environment variables.
    Per-tenant webhooks stored in DB — handled separately.
    """
    configs: list[WebhookConfig] = []

    slack_url = os.getenv("TEMPORALLAYR_SLACK_WEBHOOK_URL")
    if slack_url:
        configs.append(WebhookConfig(url=slack_url, provider="slack"))

    pd_key = os.getenv("TEMPORALLAYR_PAGERDUTY_ROUTING_KEY")
    if pd_key:
        configs.append(
            WebhookConfig(
                url="https://events.pagerduty.com/v2/enqueue",
                provider="pagerduty",
                routing_key=pd_key,
            )
        )

    generic_url = os.getenv("TEMPORALLAYR_WEBHOOK_URL")
    if generic_url:
        configs.append(
            WebhookConfig(
                url=generic_url,
                provider="generic",
                secret=os.getenv("TEMPORALLAYR_WEBHOOK_SECRET"),
            )
        )

    return configs


async def dispatch_incident_async(
    incident: dict[str, Any],
    event_type: str = "incident.created",
) -> None:
    """
    Async dispatcher — schedules webhook fires in thread pool so server never blocks.
    """
    import asyncio

    configs = get_global_webhooks()
    if not configs:
        return

    loop = asyncio.get_event_loop()
    tasks = [loop.run_in_executor(None, fire_webhook, cfg, incident, event_type) for cfg in configs]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    ok = sum(1 for r in results if r is True)
    logger.info("Webhooks dispatched", extra={"total": len(configs), "ok": ok})
