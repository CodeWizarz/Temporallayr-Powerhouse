"""Alert rules management API."""

from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger("temporallayr.alerts")

router = APIRouter(prefix="/alerts", tags=["alerts"])

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class AlertCondition(BaseModel):
    metric: str = Field(..., description="Metric to monitor: error_rate, latency_p95, span_count, cost")
    operator: str = Field(..., description="Comparison: gt, lt, gte, lte, eq")
    threshold: float = Field(..., description="Threshold value")
    window_minutes: int = Field(default=5, ge=1, le=1440)


class NotificationChannel(BaseModel):
    type: str = Field(..., description="Channel type: webhook, slack, pagerduty, email")
    url: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)


class AlertRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    type: str = Field(default="threshold", description="threshold, anomaly, match")
    condition: AlertCondition
    channels: list[NotificationChannel] = Field(default_factory=list)
    enabled: bool = True
    severity: str = Field(default="warning", description="info, warning, critical")
    tenant_id: str = "default"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_triggered_at: str | None = None
    trigger_count: int = 0
    silenced_until: str | None = None


class AlertRuleCreate(BaseModel):
    name: str
    description: str = ""
    type: str = "threshold"
    condition: AlertCondition
    channels: list[NotificationChannel] = Field(default_factory=list)
    enabled: bool = True
    severity: str = "warning"


class AlertRuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    condition: AlertCondition | None = None
    channels: list[NotificationChannel] | None = None
    enabled: bool | None = None
    severity: str | None = None
    silenced_until: str | None = None


class AlertEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rule_id: str
    rule_name: str
    severity: str
    metric_value: float
    threshold: float
    message: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    resolved: bool = False
    resolved_at: str | None = None


# ---------------------------------------------------------------------------
# In-memory store (production: swap for Postgres)
# ---------------------------------------------------------------------------

_rules: dict[str, AlertRule] = {}
_events: list[AlertEvent] = []


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("")
async def list_alerts(
    tenant_id: str = Query("default"),
    enabled_only: bool = Query(False),
):
    """List all alert rules."""
    rules = [r for r in _rules.values() if r.tenant_id == tenant_id]
    if enabled_only:
        rules = [r for r in rules if r.enabled]
    return {"alerts": [r.model_dump() for r in rules], "total": len(rules)}


@router.post("", status_code=201)
async def create_alert(body: AlertRuleCreate, tenant_id: str = Query("default")):
    """Create a new alert rule."""
    rule = AlertRule(
        name=body.name,
        description=body.description,
        type=body.type,
        condition=body.condition,
        channels=body.channels,
        enabled=body.enabled,
        severity=body.severity,
        tenant_id=tenant_id,
    )
    _rules[rule.id] = rule
    logger.info("Created alert rule %s: %s", rule.id, rule.name)
    return rule.model_dump()


@router.get("/history")
async def alert_history(
    tenant_id: str = Query("default"),
    limit: int = Query(50, ge=1, le=500),
    rule_id: str | None = Query(None),
):
    """Get alert trigger history."""
    events = _events
    if rule_id:
        events = [e for e in events if e.rule_id == rule_id]
    events = sorted(events, key=lambda e: e.timestamp, reverse=True)[:limit]
    return {"events": [e.model_dump() for e in events], "total": len(events)}


@router.get("/{alert_id}")
async def get_alert(alert_id: str):
    """Get a specific alert rule."""
    rule = _rules.get(alert_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    return rule.model_dump()


@router.put("/{alert_id}")
async def update_alert(alert_id: str, body: AlertRuleUpdate):
    """Update an existing alert rule."""
    rule = _rules.get(alert_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)
    rule.updated_at = datetime.now(timezone.utc).isoformat()
    return rule.model_dump()


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str):
    """Delete an alert rule."""
    rule = _rules.pop(alert_id, None)
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    return {"deleted": True, "id": alert_id}


@router.post("/{alert_id}/silence")
async def silence_alert(alert_id: str, until: str = Query(..., description="ISO 8601 timestamp")):
    """Silence an alert until a given time."""
    rule = _rules.get(alert_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    rule.silenced_until = until
    rule.updated_at = datetime.now(timezone.utc).isoformat()
    return {"silenced": True, "until": until}


@router.post("/{alert_id}/test")
async def test_alert(alert_id: str):
    """Fire a test notification for this alert."""
    rule = _rules.get(alert_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    event = AlertEvent(
        rule_id=rule.id,
        rule_name=rule.name,
        severity=rule.severity,
        metric_value=0.0,
        threshold=rule.condition.threshold,
        message=f"Test alert for '{rule.name}'",
    )
    _events.append(event)
    return {"test_fired": True, "event": event.model_dump()}
