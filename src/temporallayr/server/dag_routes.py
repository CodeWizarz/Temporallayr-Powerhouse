"""DAG query routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from temporallayr.core.dag import ExecutionEdge, ExecutionNode

router = APIRouter(tags=["dag"])


@router.get(
    "/trace/{trace_id}/dag",
    response_model=dict[str, list[Any]],
    summary="Retrieve execution DAG for a trace",
)
async def get_trace_dag(trace_id: str) -> dict[str, list[Any]]:
    """Return all ExecutionNode and ExecutionEdge objects for a trace_id.

    In production this queries ClickHouse via ``clickhouse_dag.query_dag``.
    Without a ClickHouse connection, returns empty lists rather than 500-ing.
    """
    try:
        from temporallayr.core.store_clickhouse import get_clickhouse_store  # noqa: PLC0415

        store = get_clickhouse_store()
        ch = getattr(store, "_client", None) or getattr(store, "client", None)
        if ch is None:
            raise RuntimeError("ClickHouse client not available")

        from temporallayr.storage.clickhouse_dag import query_dag  # noqa: PLC0415

        result = await query_dag(ch, trace_id)
        nodes = [ExecutionNode(**n) for n in result["nodes"]]
        edges = [ExecutionEdge(**e) for e in result["edges"]]
        return {
            "nodes": [n.model_dump() for n in nodes],
            "edges": [e.model_dump() for e in edges],
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
