"""
Drop-in Anthropic client wrapper.
Automatically traces all messages.create calls.

Usage:
    from temporallayr.integrations.anthropic_wrapper import Anthropic
    client = Anthropic(api_key="...")  # identical API, auto-traced
"""

from __future__ import annotations

import logging
import time
from datetime import UTC
from typing import Any

logger = logging.getLogger(__name__)

_anthropic: Any = None

try:
    import anthropic as _anthropic_imported  # type: ignore[import-not-found]

    _anthropic = _anthropic_imported
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ANTHROPIC_AVAILABLE = False

# Anthropic pricing (per 1M tokens, USD) — update as pricing changes
_ANTHROPIC_PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4-6": (15.0, 75.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (0.8, 4.0),
    "claude-3-5-sonnet": (3.0, 15.0),
    "claude-3-opus": (15.0, 75.0),
    "claude-3-haiku": (0.25, 1.25),
}


def _compute_anthropic_cost(model: str, input_tokens: int, output_tokens: int) -> float | None:
    for key, (inp_rate, out_rate) in _ANTHROPIC_PRICING.items():
        if key in model:
            return (input_tokens * inp_rate + output_tokens * out_rate) / 1_000_000
    return None


def _add_anthropic_span(
    model: str,
    input_tokens: int,
    output_tokens: int,
    duration_ms: float,
    error: str | None = None,
) -> None:
    from temporallayr.core.recorder import _current_graph

    graph = _current_graph.get(None)
    if graph is None:
        return

    import uuid
    from datetime import datetime

    from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind
    from temporallayr.models.execution import ExecutionSpan

    cost = _compute_anthropic_cost(model, input_tokens, output_tokens)
    total = input_tokens + output_tokens

    attrs: dict[str, Any] = {
        SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.LLM,
        SpanAttributes.LLM_MODEL_NAME: model,
        SpanAttributes.LLM_PROVIDER: "anthropic",
        "duration_ms": duration_ms,
        "source": "anthropic_wrapper",
    }
    if total > 0:
        attrs[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] = input_tokens
        attrs[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = output_tokens
        attrs[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] = total
    if cost is not None:
        attrs["cost_usd"] = cost

    now = datetime.now(UTC)
    span = ExecutionSpan(
        span_id=str(uuid.uuid4()),
        parent_span_id=None,
        name=f"llm:{model}",
        start_time=datetime.fromtimestamp(time.time() - duration_ms / 1000, tz=UTC),
        end_time=now,
        status="error" if error else "success",
        error=error,
        attributes=attrs,
    )
    graph.spans.append(span)


class _TrackedMessages:
    def __init__(self, original):
        self._original = original

    def create(self, *args, **kwargs) -> Any:
        model = kwargs.get("model", "unknown")
        t0 = time.time()
        error = None
        response = None
        try:
            response = self._original.create(*args, **kwargs)
            return response
        except Exception as e:
            error = str(e)
            raise
        finally:
            duration_ms = (time.time() - t0) * 1000
            input_tokens = output_tokens = 0
            if response and hasattr(response, "usage"):
                input_tokens = getattr(response.usage, "input_tokens", 0) or 0
                output_tokens = getattr(response.usage, "output_tokens", 0) or 0
            _add_anthropic_span(model, input_tokens, output_tokens, duration_ms, error)

    async def acreate(self, *args, **kwargs) -> Any:
        model = kwargs.get("model", "unknown")
        t0 = time.time()
        error = None
        response = None
        try:
            response = await self._original.acreate(*args, **kwargs)
            return response
        except Exception as e:
            error = str(e)
            raise
        finally:
            duration_ms = (time.time() - t0) * 1000
            input_tokens = output_tokens = 0
            if response and hasattr(response, "usage"):
                input_tokens = getattr(response.usage, "input_tokens", 0) or 0
                output_tokens = getattr(response.usage, "output_tokens", 0) or 0
            _add_anthropic_span(model, input_tokens, output_tokens, duration_ms, error)


class Anthropic:
    """
    Drop-in replacement for anthropic.Anthropic.

    from temporallayr.integrations.anthropic_wrapper import Anthropic
    client = Anthropic(api_key="...")
    """

    def __init__(self, *args, **kwargs):
        if not _ANTHROPIC_AVAILABLE:
            raise ImportError("anthropic not installed. Run: pip install temporallayr[anthropic]")
        self._client = _anthropic.Anthropic(*args, **kwargs)
        self.messages = _TrackedMessages(self._client.messages)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)


class AsyncAnthropic:
    def __init__(self, *args, **kwargs):
        if not _ANTHROPIC_AVAILABLE:
            raise ImportError("anthropic not installed.")
        self._client = _anthropic.AsyncAnthropic(*args, **kwargs)
        self.messages = _TrackedMessages(self._client.messages)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)
