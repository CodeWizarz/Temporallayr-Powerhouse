"""Traces API routes for TemporalLayr."""
from __future__ import annotations
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from temporallayr.core.store import async_store
from temporallayr.server.auth import verify_api_key

router = APIRouter(prefix="/traces", tags=["traces"])


@router.get("")
async def list_traces(
    tenant_id: str = Depends(verify_api_key),
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """List all traces for the authenticated tenant."""
    ids = await async_store("list_executions", tenant_id)
    page = ids[offset: offset + limit]
    return {"items": page, "total": len(ids), "limit": limit, "offset": offset,
            "has_more": (offset + limit) < len(ids)}


@router.get("/summary/stats")
async def trace_stats(
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, Any]:
    """Summary statistics for the tenant's traces."""
    ids = await async_store("list_executions", tenant_id)
    total = len(ids)
    success_count = 0
    error_count = 0
    for eid in ids[:200]:
        try:
            g = await async_store("load_execution", eid, tenant_id)
            if g.success:
                success_count += 1
            else:
                error_count += 1
        except Exception:
            pass
    return {"total": total, "success": success_count, "error": error_count,
            "error_rate": round(error_count / max(total, 1) * 100, 2)}


@router.get("/{trace_id}")
async def get_trace(
    trace_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> Any:
    """Get a single trace by ID."""
    try:
        execution = await async_store("load_execution", trace_id, tenant_id)
        if hasattr(execution, "model_dump"):
            return execution.model_dump(mode="json")
        return execution
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Trace '{trace_id}' not found") from None
