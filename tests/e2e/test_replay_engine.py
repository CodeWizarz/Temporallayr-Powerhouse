"""End-to-end tests for deterministic replay."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind
from temporallayr.core.store import get_default_store
from temporallayr.models.execution import ExecutionGraph, Span
from temporallayr.replay.diff import semantic_diff
from temporallayr.replay.engine import DeterministicReplayEngine
from temporallayr.server.app import app
from temporallayr.server.auth.api_keys import map_api_key_to_tenant


def replay_tool_add(a: int, b: int) -> int:
    return a + b


def _build_graph(tenant_id: str, trace_id: str, expected_tool_output: int) -> ExecutionGraph:
    started = datetime.now(UTC)
    tool_span = Span(
        span_id=f"tool-{trace_id}",
        name="tool:replay_tool_add",
        start_time=started,
        end_time=started + timedelta(milliseconds=1),
        attributes={
            SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.TOOL,
            "code": {"module": __name__, "name": "replay_tool_add"},
            "inputs": {"a": 2, "b": 3},
            "output": expected_tool_output,
        },
    )
    llm_span = Span(
        span_id=f"llm-{trace_id}",
        parent_span_id=tool_span.span_id,
        name="llm:mocked",
        start_time=started + timedelta(milliseconds=2),
        end_time=started + timedelta(milliseconds=3),
        attributes={
            SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.LLM,
            "output": "stored-llm-response",
        },
    )
    return ExecutionGraph(trace_id=trace_id, tenant_id=tenant_id, spans=[tool_span, llm_span])


@pytest.mark.asyncio
async def test_deterministic_replay_engine_executes_tools_and_reuses_llm_outputs() -> None:
    tenant_id = "replay-e2e-tenant"
    trace_id = f"replay-e2e-{uuid4()}"
    graph = _build_graph(tenant_id, trace_id, expected_tool_output=5)
    get_default_store().save_execution(graph)

    replay = await DeterministicReplayEngine().replay_trace(trace_id, tenant_id)

    assert replay.trace_id == trace_id
    assert len(replay.steps) == 2

    tool_step = next(s for s in replay.steps if s.source == "live_execution")
    llm_step = next(s for s in replay.steps if s.source == "llm_recording")

    assert tool_step.actual_output in (5, "5")  # re-runs add(2, 3) = 5
    assert llm_step.actual_output == "stored-llm-response"

    report = semantic_diff(replay.expected, replay.actual)
    # expected_output=5 and actual computed=5, so no divergence
    assert report.total_differences == 0


@pytest.mark.asyncio
async def test_replay_endpoint_returns_semantic_divergence_report() -> None:
    tenant_id = "replay-route-tenant"
    api_key = "replay-route-key"
    trace_id = f"replay-route-{uuid4()}"

    map_api_key_to_tenant(api_key, tenant_id)
    graph = _build_graph(tenant_id, trace_id, expected_tool_output=999)
    get_default_store().save_execution(graph)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {api_key}"},
    ) as client:
        response = await client.post(f"/replay/{trace_id}")

    assert response.status_code == 200
    payload = response.json()

    assert payload["replay"]["trace_id"] == trace_id
    assert payload["divergence"]["diverged"] is True
    assert payload["divergence"]["total_differences"] >= 1
