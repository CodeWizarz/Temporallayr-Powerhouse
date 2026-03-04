from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from temporallayr.core.replay import ReplayEngine
from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind
from temporallayr.models.execution import ExecutionGraph, Span
from temporallayr.models.replay import DivergenceType
from temporallayr.replay.diff import semantic_diff
from temporallayr.replay.engine import DeterministicReplayEngine


def replay_add(a: int, b: int) -> int:
    return a + b


def replay_raise(_: int) -> int:
    raise RuntimeError("boom")


def _span(
    span_id: str,
    name: str,
    *,
    attributes: dict[str, object],
    offset_ms: int = 0,
) -> Span:
    started = datetime.now(UTC) + timedelta(milliseconds=offset_ms)
    return Span(
        span_id=span_id,
        name=name,
        start_time=started,
        end_time=started + timedelta(milliseconds=1),
        attributes=attributes,
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_core_replay_engine_is_deterministic_for_matching_output() -> None:
    graph = ExecutionGraph(
        trace_id="replay-match",
        tenant_id="tenant-a",
        spans=[
            _span(
                "n1",
                "tool:add",
                attributes={
                    "code": {"module": __name__, "name": "replay_add"},
                    "inputs": {"a": 1, "b": 2},
                    "output": 3,
                },
            )
        ],
    )

    report = await ReplayEngine(graph).replay()

    assert report.is_deterministic is True
    assert report.divergences_found == 0
    assert report.results[0].success is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_core_replay_engine_detects_output_divergence() -> None:
    graph = ExecutionGraph(
        trace_id="replay-output-divergence",
        tenant_id="tenant-a",
        spans=[
            _span(
                "n2",
                "tool:add",
                attributes={
                    "code": {"module": __name__, "name": "replay_add"},
                    "inputs": {"a": 1, "b": 2},
                    "output": 999,
                },
            )
        ],
    )

    report = await ReplayEngine(graph).replay()

    assert report.is_deterministic is False
    assert report.divergences_found == 1
    assert report.results[0].divergence_type == DivergenceType.OUTPUT_MISMATCH


@pytest.mark.unit
@pytest.mark.asyncio
async def test_core_replay_engine_detects_error_divergence() -> None:
    graph = ExecutionGraph(
        trace_id="replay-error-divergence",
        tenant_id="tenant-a",
        spans=[
            _span(
                "n3",
                "tool:raise",
                attributes={
                    "code": {"module": __name__, "name": "replay_raise"},
                    "inputs": {"_": 1},
                    "error": "expected different error",
                },
            )
        ],
    )

    report = await ReplayEngine(graph).replay()

    assert report.is_deterministic is False
    assert report.divergences_found == 1
    assert report.results[0].divergence_type == DivergenceType.ERROR_MISMATCH


@pytest.mark.unit
@pytest.mark.asyncio
async def test_deterministic_replay_engine_reuses_llm_recording_and_reports_divergence() -> None:
    graph = ExecutionGraph(
        trace_id="deterministic-llm-tool",
        tenant_id="tenant-a",
        spans=[
            _span(
                "llm-1",
                "llm:mock",
                attributes={
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.LLM,
                    "output": "cached-response",
                },
                offset_ms=1,
            ),
            _span(
                "tool-1",
                "tool:add",
                attributes={
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.TOOL,
                    "code": {"module": __name__, "name": "replay_add"},
                    "inputs": {"a": 3, "b": 4},
                    "output": 999,
                },
                offset_ms=2,
            ),
        ],
    )

    replay_run = await DeterministicReplayEngine().replay_graph(graph)

    llm_step = next(step for step in replay_run.steps if step.span_id == "llm-1")
    tool_step = next(step for step in replay_run.steps if step.span_id == "tool-1")

    assert llm_step.source == "llm_recording"
    assert llm_step.actual_output == "cached-response"
    assert tool_step.actual_output == 7

    divergence = semantic_diff(replay_run.expected, replay_run.actual)
    assert divergence.diverged is True
    assert divergence.total_differences >= 1
