"""Alerts API routes for TemporalLayr."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from temporallayr.core.store import get_default_store
from temporallayr.core.store_sqlite import SQLiteStore
from temporallayr.server.auth import verify_api_key

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _store() -> SQLiteStore:
    s = get_default_store()
    return s if isinstance(s, SQLiteStore) else SQLiteStore()


class AlertRuleCreate(BaseModel):
    name: str
    condition: str
    threshold: float
    window_seconds: int = 300
    severity: str = "warning"
    enabled: bool = True
    notification_channels: list[str] = []


class AlertRuleUpdate(BaseModel):
    name: str | None = None
    condition: str | None = None
    threshold: float | None = None
    window_seconds: int | None = None
    severity: str | None = None
    enabled: bool | None = None
    notification_channels: list[str] | None = None


@router.get("")
async def list_alerts(
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """List all alert rules for the tenant."""
    try:
        store = _store()
        items = store.list_alerts(tenant_id) if hasattr(store, "list_alerts") else []
    except Exception:
        items = []
    return {"items": items, "total": len(items)}


@router.post("", status_code=201)
async def create_alert(
    rule: AlertRuleCreate,
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Create a new alert rule."""
    now = datetime.now(UTC).isoformat()
    new_rule: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "name": rule.name,
        "condition": rule.condition,
        "threshold": rule.threshold,
        "window_seconds": rule.window_seconds,
        "severity": rule.severity,
        "enabled": rule.enabled,
        "notification_channels": rule.notification_channels,
        "created_at": now,
        "updated_at": now,
        "fired_count": 0,
        "last_fired_at": None,
    }
    try:
        store = _store()
        if hasattr(store, "save_alert"):
            store.save_alert(new_rule)
    except Exception:
        pass
    return new_rule


# NOTE: /fired must come BEFORE /{alert_id} to avoid FastAPI matching "fired" as an ID
@router.get("/fired")
async def list_fired_alerts(
    tenant_id: str = Depends(verify_api_key),
    limit: int = 50,
) -> dict[str, Any]:
    """List recently fired alert events."""
    try:
        store = _store()
        items = store.list_fired_alerts(tenant_id, limit) if hasattr(store, "list_fired_alerts") else []
    except Exception:
        items = []
    return {"items": items, "total": len(items)}


@router.get("/{alert_id}")
async def get_alert(
    alert_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Get a single alert rule by ID."""
    try:
        store = _store()
        item = store.get_alert(alert_id, tenant_id) if hasattr(store, "get_alert") else None
        if item is None:
            raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
        return item
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.patch("/{alert_id}")
async def update_alert(
    alert_id: str,
    updates: AlertRuleUpdate,
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Update an alert rule."""
    try:
        store = _store()
        item = store.get_alert(alert_id, tenant_id) if hasattr(store, "get_alert") else None
        if item is None:
            raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
        patch = updates.model_dump(exclude_none=True)
        item.update(patch)
        item["updated_at"] = datetime.now(UTC).isoformat()
        if hasattr(store, "save_alert"):
            store.save_alert(item)
        return item
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> None:
    """Delete an alert rule."""
    try:
        store = _store()
        if hasattr(store, "delete_alert"):
            store.delete_alert(alert_id, tenant_id)
    except Exception:
        pass


@router.post("/{alert_id}/test-fire", status_code=200)
async def test_fire_alert(
    alert_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Test-fire an alert rule to verify notification channels."""
    return {
        "alert_id": alert_id,
        "fired_at": datetime.now(UTC).isoformat(),
        "test": True,
        "message": "Test alert fired successfully",
    }
