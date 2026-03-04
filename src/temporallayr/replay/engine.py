"""Deterministic replay engine for stored execution DAGs."""

from __future__ import annotations

import importlib
import inspect
from collections.abc import Awaitable, Callable
from typing import Any, Literal, cast

from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind
from temporallayr.core.store import ExecutionStore, get_default_store
from temporallayr.models.base import TemporalLayrBaseModel
from temporallayr.models.execution import ExecutionGraph, ExecutionNode

ReplaySource = Literal["llm_recording", "tool_execution", "recording"]


class ReplayStep(TemporalLayrBaseModel):
    """Replay outcome for a single span in a trace."""

    span_id: str
    name: str
    span_kind: str
    source: ReplaySource
    expected_output: Any | None = None
    actual_output: Any | None = None
    expected_error: str | None = None
    actual_error: str | None = None


class ReplayRun(TemporalLayrBaseModel):
    """Collected replay outputs for a full trace."""

    trace_id: str
    tenant_id: str
    total_spans: int
    steps: list[ReplayStep]
    expected: dict[str, dict[str, Any]]
    actual: dict[str, dict[str, Any]]


class DeterministicReplayEngine:
    """Replay traces deterministically from recorded metadata and inputs."""

    def __init__(self, store: ExecutionStore | None = None) -> None:
        self._store = store or get_default_store()

    def load_execution_dag(self, trace_id: str, tenant_id: str) -> ExecutionGraph:
        """Load the recorded trace DAG from persistence."""
        return self._store.load_execution(trace_id, tenant_id)

    async def replay_trace(self, trace_id: str, tenant_id: str) -> ReplayRun:
        """Replay a single trace by ID and tenant."""
        graph = self.load_execution_dag(trace_id, tenant_id)
        return await self.replay_graph(graph)

    async def replay_graph(self, graph: ExecutionGraph) -> ReplayRun:
        """Replay all spans in deterministic start-time order."""
        ordered_spans = sorted(graph.spans, key=lambda span: (span.start_time, span.span_id))
        steps: list[ReplayStep] = []
        expected: dict[str, dict[str, Any]] = {}
        actual: dict[str, dict[str, Any]] = {}

        for span in ordered_spans:
            step = await self._replay_span(span)
            steps.append(step)
            expected[span.span_id] = {
                "output": step.expected_output,
                "error": step.expected_error,
            }
            actual[span.span_id] = {
                "output": step.actual_output,
                "error": step.actual_error,
            }

        return ReplayRun(
            trace_id=graph.trace_id,
            tenant_id=graph.tenant_id,
            total_spans=len(ordered_spans),
            steps=steps,
            expected=expected,
            actual=actual,
        )

    async def _replay_span(self, span: ExecutionNode) -> ReplayStep:
        span_kind = self._resolve_span_kind(span)
        expected_output = span.attributes.get("output", span.output_payload)
        expected_error = self._normalize_error(span.error or span.attributes.get("error"))

        if span_kind == SpanKind.LLM:
            return ReplayStep(
                span_id=span.span_id,
                name=span.name,
                span_kind=span_kind,
                source="llm_recording",
                expected_output=expected_output,
                actual_output=expected_output,
                expected_error=expected_error,
                actual_error=expected_error,
            )

        if span_kind == SpanKind.TOOL:
            actual_output, actual_error = await self._execute_recorded_tool(span)
            return ReplayStep(
                span_id=span.span_id,
                name=span.name,
                span_kind=span_kind,
                source="tool_execution",
                expected_output=expected_output,
                actual_output=actual_output,
                expected_error=expected_error,
                actual_error=actual_error,
            )

        return ReplayStep(
            span_id=span.span_id,
            name=span.name,
            span_kind=span_kind,
            source="recording",
            expected_output=expected_output,
            actual_output=expected_output,
            expected_error=expected_error,
            actual_error=expected_error,
        )

    @staticmethod
    def _resolve_span_kind(span: ExecutionNode) -> str:
        raw_kind = span.attributes.get(SpanAttributes.OPENINFERENCE_SPAN_KIND)
        if isinstance(raw_kind, str) and raw_kind:
            return raw_kind.upper()

        lowered_name = span.name.lower()
        if lowered_name.startswith("llm:"):
            return SpanKind.LLM
        if lowered_name.startswith("tool:"):
            return SpanKind.TOOL
        return SpanKind.CHAIN

    @staticmethod
    def _normalize_error(error_value: Any) -> str | None:
        if error_value is None:
            return None
        if isinstance(error_value, str):
            return error_value
        return str(error_value)

    async def _execute_recorded_tool(self, span: ExecutionNode) -> tuple[Any | None, str | None]:
        code_meta = span.attributes.get("code")
        if not isinstance(code_meta, dict):
            return None, "Missing recorded code metadata"

        module_name = code_meta.get("module")
        callable_name = code_meta.get("name")
        if not isinstance(module_name, str) or not isinstance(callable_name, str):
            return None, "Incomplete recorded code metadata"

        inputs = span.attributes.get("inputs", {})

        try:
            module = importlib.import_module(module_name)
            func = cast(Callable[..., Any], getattr(module, callable_name))
        except Exception as exc:
            return None, str(exc)

        try:
            result = self._invoke_callable(func, inputs)
            if inspect.isawaitable(result):
                return await cast(Awaitable[Any], result), None
            return result, None
        except Exception as exc:
            return None, str(exc)

    @staticmethod
    def _invoke_callable(func: Callable[..., Any], inputs: Any) -> Any:
        if not isinstance(inputs, dict):
            raise TypeError("Recorded inputs must be a mapping")

        args = inputs.get("args")
        kwargs = inputs.get("kwargs")

        if isinstance(args, list) and isinstance(kwargs, dict):
            return func(*args, **kwargs)
        return func(**inputs)
