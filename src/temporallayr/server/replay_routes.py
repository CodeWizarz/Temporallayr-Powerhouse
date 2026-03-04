"""Replay API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from temporallayr.models.base import TemporalLayrBaseModel
from temporallayr.replay.diff import DivergenceReport, semantic_diff
from temporallayr.replay.engine import DeterministicReplayEngine, ReplayRun
from temporallayr.server.auth import verify_api_key

router = APIRouter(tags=["replay"])


class ReplayResponse(TemporalLayrBaseModel):
    """Replay response payload returned by the API endpoint."""

    replay: ReplayRun
    divergence: DivergenceReport


@router.post("/replay/{trace_id}", response_model=ReplayResponse)
async def replay_trace(
    trace_id: str,
    tenant_id: str = Depends(verify_api_key),
) -> ReplayResponse:
    """Run deterministic replay for a stored trace and return divergence report."""
    engine = DeterministicReplayEngine()
    try:
        replay = await engine.replay_trace(trace_id, tenant_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Execution '{trace_id}' not found") from exc

    divergence = semantic_diff(replay.expected, replay.actual)
    return ReplayResponse(replay=replay, divergence=divergence)
