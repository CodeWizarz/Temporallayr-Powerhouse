"""
replay/engine.py — backward-compatibility shim.

Provides DeterministicReplayEngine which wraps temporallayr.core.replay.ReplayEngine
using the cached-LLM pattern expected by tests/unit/test_replay.py and replay_routes.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from temporallayr.core.replay import ReplayEngine
from temporallayr.core.semantic_conventions import SpanKind
from temporallayr.models.execution import ExecutionGraph, Span


@dataclass
class ReplayStep:
    """Single step result from a DeterministicReplayEngine replay."""

    span_id: str
    source: str  # "llm_recording" | "live_execution"
    actual_output: Any = None
    actual_error: str | None = None


@dataclass
class ReplayRun:
    """Result of a full replay run."""

    trace_id: str
    expected: ExecutionGraph
    actual: ExecutionGraph
    steps: list[ReplayStep] = field(default_factory=list)


class DeterministicReplayEngine:
    """
    Replay engine that reuses LLM outputs from recordings and re-executes tools.
    Thin wrapper around core.replay.ReplayEngine with added LLM caching logic.
    """

    async def replay_graph(self, graph: ExecutionGraph) -> ReplayRun:
        """Replay graph, caching LLM calls and re-executing tool calls."""
        from temporallayr.core.semantic_conventions import SpanAttributes

        steps: list[ReplayStep] = []
        replayed_spans: list[Span] = []

        for span in sorted(graph.spans, key=lambda s: s.start_time):
            kind = span.attributes.get(SpanAttributes.OPENINFERENCE_SPAN_KIND, "")
            if kind == SpanKind.LLM:
                # Reuse cached LLM output
                output = span.attributes.get("output")
                steps.append(
                    ReplayStep(
                        span_id=span.span_id,
                        source="llm_recording",
                        actual_output=output,
                    )
                )
                replayed_spans.append(span)
            else:
                # Re-execute tools
                engine = ReplayEngine(
                    ExecutionGraph(
                        trace_id=graph.trace_id,
                        tenant_id=graph.tenant_id,
                        spans=[span],
                    )
                )
                report = await engine.replay()
                result = report.results[0] if report.results else None
                steps.append(
                    ReplayStep(
                        span_id=span.span_id,
                        source="live_execution",
                        actual_output=result.actual_output if result else None,
                        actual_error=result.actual_error if result else None,
                    )
                )
                # Build replayed span with updated output
                new_attrs = dict(span.attributes)
                if result:
                    if result.actual_error:
                        new_attrs["error"] = result.actual_error
                    else:
                        new_attrs["output"] = result.actual_output
                replayed_spans.append(span.model_copy(update={"attributes": new_attrs}))

        actual = graph.model_copy(update={"spans": replayed_spans})
        return ReplayRun(trace_id=graph.trace_id, expected=graph, actual=actual, steps=steps)

    async def replay_trace(self, trace_id: str, tenant_id: str) -> ReplayRun:
        """Load a trace from store and replay it."""
        from temporallayr.core.store import get_default_store

        store = get_default_store()
        graph = store.load_execution(trace_id, tenant_id)
        return await self.replay_graph(graph)
