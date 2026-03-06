"""Incident-related API routes."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query

from temporallayr.analysis.failure_clusters import FailureSignal, cluster_failures
from temporallayr.core.store import async_store
from temporallayr.server.auth import verify_api_key

router = APIRouter(tags=["incidents"])


@router.get("/incidents/clusters")
async def get_incident_clusters(
    tenant_id: str = Depends(verify_api_key),
    hours: int = Query(default=24, ge=1, le=24 * 30),
    threshold: float = Query(default=0.82, ge=0.0, le=1.0),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """Cluster recent tenant failures using cosine similarity."""
    cutoff = datetime.now(UTC) - timedelta(hours=hours)

    failures: list[FailureSignal] = []

    execution_ids = await async_store("list_executions", tenant_id)
    for execution_id in execution_ids:
        try:
            graph = await async_store("load_execution", execution_id, tenant_id)
        except Exception:
            continue

        if graph.created_at < cutoff:
            continue

        for span in graph.spans:
            error_value = span.error or span.attributes.get("error")
            if error_value is None:
                continue

            failures.append(
                FailureSignal(
                    tenant_id=tenant_id,
                    trace_id=graph.trace_id,
                    span_name=span.name,
                    error_message=str(error_value),
                    metadata={"span_id": span.span_id},
                )
            )

    clusters = cluster_failures(failures, similarity_threshold=threshold)
    page = clusters[offset : offset + limit]
    return {
        "items": [cluster.model_dump(mode="json") for cluster in page],
        "total": len(clusters),
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < len(clusters),
    }
