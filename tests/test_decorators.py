"""Tests for @track, @track_llm, @track_tool, @track_pipeline decorators."""

from __future__ import annotations

import asyncio
import os

import pytest

os.environ.setdefault("TEMPORALLAYR_TENANT_ID", "test-dec-tenant")

from temporallayr.core.decorators import track, track_llm, track_pipeline, track_tool
from temporallayr.core.recorder import _current_graph
from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind
from temporallayr.models.execution import ExecutionGraph

# ── Helpers ──────────────────────────────────────────────────────────


def _make_graph() -> ExecutionGraph:
    return ExecutionGraph(id="test-dec-001", tenant_id="test-dec-tenant", spans=[])


# ── @track ──────────────────────────────────────────────────────────


def test_track_sync_outside_context():
    """@track is transparent outside recorder context."""

    @track
    def add(a: int, b: int) -> int:
        return a + b

    assert add(1, 2) == 3


@pytest.mark.asyncio
async def test_track_sync_captures_timing():
    graph = _make_graph()
    token = _current_graph.set(graph)
    try:

        @track(name="my_step")
        def slow_add(a, b):
            return a + b

        result = slow_add(3, 4)
        assert result == 7
        assert len(graph.spans) == 1
        span = graph.spans[0]
        assert span.name == "my_step"
        assert span.start_time is not None
        assert span.end_time is not None
        assert span.attributes.get("duration_ms") is not None
        assert span.attributes["duration_ms"] >= 0
        assert span.status == "success"
    finally:
        _current_graph.reset(token)


@pytest.mark.asyncio
async def test_track_async_captures_error():
    graph = _make_graph()
    token = _current_graph.set(graph)
    try:

        @track
        async def fail_fn():
            raise ValueError("boom")

        with pytest.raises(ValueError):
            await fail_fn()

        assert len(graph.spans) == 1
        span = graph.spans[0]
        assert span.status == "error"
        assert "boom" in span.attributes.get("error", "")
        assert span.end_time is not None
    finally:
        _current_graph.reset(token)


# ── @track_llm ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_track_llm_captures_tokens_and_cost():
    graph = _make_graph()
    token = _current_graph.set(graph)
    try:

        @track_llm
        async def call_llm(prompt: str) -> dict:
            return {
                "output": "The answer is 42",
                "model": "gpt-4o",
                "prompt_tokens": 100,
                "completion_tokens": 50,
                "total_tokens": 150,
            }

        result = await call_llm("What is the answer?")
        assert result["output"] == "The answer is 42"
        assert len(graph.spans) == 1
        span = graph.spans[0]
        attrs = span.attributes
        assert attrs[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] == 100
        assert attrs[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] == 50
        assert attrs[SpanAttributes.LLM_MODEL_NAME] == "gpt-4o"
        assert "cost_usd" in attrs
        assert attrs["cost_usd"] > 0
        assert attrs.get("duration_ms") is not None
        assert span.attributes.get(SpanAttributes.OPENINFERENCE_SPAN_KIND) == SpanKind.LLM
    finally:
        _current_graph.reset(token)


@pytest.mark.asyncio
async def test_track_llm_no_tokens_no_cost():
    """If no token info, cost should not be set."""
    graph = _make_graph()
    token = _current_graph.set(graph)
    try:

        @track_llm
        def simple_llm() -> str:
            return "just a string"

        simple_llm()
        span = graph.spans[0]
        assert "cost_usd" not in span.attributes
    finally:
        _current_graph.reset(token)


# ── @track_tool ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_track_tool_sync():
    graph = _make_graph()
    token = _current_graph.set(graph)
    try:

        @track_tool(name="database_query", description="Queries the user DB")
        def query_db(user_id: str) -> dict:
            return {"id": user_id, "name": "Alice"}

        result = query_db("usr_99")
        assert result["name"] == "Alice"
        span = graph.spans[0]
        assert span.name == "tool:database_query"
        assert span.attributes[SpanAttributes.TOOL_NAME] == "database_query"
        assert span.attributes[SpanAttributes.OPENINFERENCE_SPAN_KIND] == SpanKind.TOOL
        assert span.attributes["output"] == {"id": "usr_99", "name": "Alice"}
        assert span.attributes["duration_ms"] >= 0
    finally:
        _current_graph.reset(token)


# ── @track_pipeline ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_track_pipeline_is_track_alias():
    """@track_pipeline behaves identically to @track."""
    graph = _make_graph()
    token = _current_graph.set(graph)
    try:

        @track_pipeline
        async def my_pipeline(x: int) -> int:
            return x * 2

        result = await my_pipeline(5)
        assert result == 10
        assert len(graph.spans) == 1
        assert graph.spans[0].status == "success"
    finally:
        _current_graph.reset(token)


# ── Nested spans / parent tracking ───────────────────────────────────


@pytest.mark.asyncio
async def test_nested_spans_parent_ids():
    """Inner span should have outer span as parent_span_id."""
    graph = _make_graph()
    token = _current_graph.set(graph)
    try:

        @track(name="outer")
        async def outer_fn():
            return await inner_fn()

        @track(name="inner")
        async def inner_fn():
            return "done"

        await outer_fn()
        assert len(graph.spans) == 2
        outer = next(s for s in graph.spans if s.name == "outer")
        inner = next(s for s in graph.spans if s.name == "inner")
        assert inner.parent_span_id == outer.span_id
    finally:
        _current_graph.reset(token)


# ── Timing correctness ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_timing_is_accurate():
    """duration_ms should reflect actual function runtime, not decorator overhead."""
    graph = _make_graph()
    token = _current_graph.set(graph)
    try:

        @track
        async def timed_fn():
            await asyncio.sleep(0.05)

        await timed_fn()
        span = graph.spans[0]
        duration = span.attributes.get("duration_ms", 0)
        # Should be ~50ms, definitely > 10ms
        assert duration >= 10, f"Expected duration >= 10ms, got {duration}ms"
        assert duration < 5000, f"Duration suspiciously large: {duration}ms"
        # end_time should be after start_time
        assert span.end_time > span.start_time
    finally:
        _current_graph.reset(token)
