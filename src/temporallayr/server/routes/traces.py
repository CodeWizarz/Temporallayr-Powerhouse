"""API routes for executions / traces."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from temporallayr.core.alerting import AlertEngine
from temporallayr.core.diff_engine import ExecutionDiffer
from temporallayr.core.replay import ReplayEngine
from temporallayr.core.store import get_default_store
from temporallayr.models.execution import ExecutionGraph
from temporallayr.models.replay import ReplayReport
from temporallayr.server.auth import verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["executions"])


class DiffRequest(BaseModel):
    execution_a: str
    execution_b: str


async def _enqueue_graph(graph: ExecutionGraph) -> None:
    """Enqueues graph for processing (fallback to sync if redis unavailable)."""
    # This preserves the hook logic originally in app.py
    from temporallayr.server.app import _enqueue_graph as app_enqueue

    await app_enqueue(graph)


@router.post("/executions", status_code=201)
async def create_execution(
    graph: ExecutionGraph,
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, str]:
    if graph.tenant_id != tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id mismatch")
    store = get_default_store()
    try:
        previous_ids = store.list_executions(tenant_id)
        previous_id = next((pid for pid in previous_ids if pid != graph.id), None)
        store.save_execution(graph)
        if previous_id:
            try:
                prev = store.load_execution(previous_id, tenant_id)
                alerts = AlertEngine.check_execution(graph, prev)
                if alerts:
                    logger.info(
                        "Alerts triggered", extra={"count": len(alerts), "graph_id": graph.id}
                    )
            except Exception as e:
                logger.warning("Alert check failed", extra={"error": str(e)})
        asyncio.create_task(_enqueue_graph(graph))
        return {"execution_id": graph.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/executions")
async def list_executions(
    tenant_id: str = Depends(verify_api_key),
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    ids = get_default_store().list_executions(tenant_id)
    page = ids[offset : offset + limit]
    return {
        "items": page,
        "total": len(ids),
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < len(ids),
    }


@router.get("/executions/{execution_id}", response_model=ExecutionGraph)
async def get_execution(
    execution_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> ExecutionGraph:
    try:
        return get_default_store().load_execution(execution_id, tenant_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404, detail=f"Execution '{execution_id}' not found"
        ) from None


@router.post("/executions/{execution_id}/replay", response_model=ReplayReport)
async def replay_execution(
    execution_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> ReplayReport:
    try:
        graph = get_default_store().load_execution(execution_id, tenant_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404, detail=f"Execution '{execution_id}' not found"
        ) from None
    # Add CORS headers if running via browser on different port.
    # FastAPI usually handles this via middleware on the main app,
    # but the API definition remains the same.
    return await ReplayEngine(graph).replay()


@router.post("/executions/diff", response_model=dict[str, list[Any]])
async def diff_executions(
    request: DiffRequest,
    tenant_id: str = Depends(verify_api_key),
) -> dict[str, list[Any]]:
    store = get_default_store()
    try:
        exec_a = store.load_execution(request.execution_a, tenant_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"'{request.execution_a}' not found") from None
    try:
        exec_b = store.load_execution(request.execution_b, tenant_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"'{request.execution_b}' not found") from None
    return ExecutionDiffer.diff(exec_a, exec_b)
