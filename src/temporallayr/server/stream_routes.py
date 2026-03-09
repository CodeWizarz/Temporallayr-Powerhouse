"""SSE event stream and datasets routes for TemporalLayr."""
from __future__ import annotations
import asyncio
import json
import uuid
from datetime import UTC, datetime
from typing import Any, AsyncGenerator
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from temporallayr.core.store import get_default_store
from temporallayr.core.store_sqlite import SQLiteStore
from temporallayr.server.auth import verify_api_key

router = APIRouter(tags=["stream"])


# ── SSE stream ────────────────────────────────────────────────────────

async def _event_generator(tenant_id: str, request: Request) -> AsyncGenerator[str, None]:
    """Generate SSE heartbeat events for the tenant."""
    counter = 0
    while True:
        if await request.is_disconnected():
            break
        event = {
            "id": str(uuid.uuid4()),
            "type": "heartbeat",
            "tenant_id": tenant_id,
            "timestamp": datetime.now(UTC).isoformat(),
            "seq": counter,
        }
        yield f"data: {json.dumps(event)}\n\n"
        counter += 1
        await asyncio.sleep(5)


@router.get("/stream/events")
async def stream_events(
    request: Request,
    tenant_id: str = Depends(verify_api_key),
) -> StreamingResponse:
    """Server-Sent Events stream for real-time agent workflow events."""
    return StreamingResponse(
        _event_generator(tenant_id, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Datasets ──────────────────────────────────────────────────────────

def _sqlite() -> SQLiteStore:
    s = get_default_store()
    return s if isinstance(s, SQLiteStore) else SQLiteStore()


class DatasetCreate(BaseModel):
    name: str
    description: str = ""
    schema: dict[str, Any] = {}


@router.get("/datasets")
async def list_datasets(
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """List all datasets for the tenant."""
    try:
        store = _sqlite()
        items = store.list_datasets(tenant_id) if hasattr(store, "list_datasets") else []
    except Exception:
        items = []
    return {"items": items, "total": len(items)}


@router.post("/datasets", status_code=201)
async def create_dataset(
    ds: DatasetCreate,
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Create a new dataset."""
    now = datetime.now(UTC).isoformat()
    new_ds: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "name": ds.name,
        "description": ds.description,
        "schema": ds.schema,
        "created_at": now,
        "updated_at": now,
        "event_count": 0,
    }
    try:
        store = _sqlite()
        if hasattr(store, "save_dataset"):
            store.save_dataset(new_ds)
    except Exception:
        pass
    return new_ds


@router.delete("/datasets/{dataset_id}", status_code=204)
async def delete_dataset(
    dataset_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> None:
    """Delete a dataset."""
    try:
        store = _sqlite()
        if hasattr(store, "delete_dataset"):
            store.delete_dataset(dataset_id, tenant_id)
    except Exception:
        pass
