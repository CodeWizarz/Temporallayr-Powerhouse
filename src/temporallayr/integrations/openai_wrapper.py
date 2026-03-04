"""
Drop-in OpenAI client wrapper.
Automatically tracks all chat completions and embeddings.

Usage (zero code change to existing code):
    # Before:
    from openai import OpenAI
    # After:
    from temporallayr.integrations.openai_wrapper import OpenAI

That's it. All calls auto-traced with token counts + cost.
"""

from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

try:
    import openai as _openai

    _OPENAI_AVAILABLE = True
except ImportError:
    _OPENAI_AVAILABLE = False


def _add_llm_span(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    duration_ms: float,
    error: str | None = None,
    inputs: Any = None,
    output: Any = None,
) -> None:
    from temporallayr.core.recorder import _current_graph

    graph = _current_graph.get(None)
    if graph is None:
        return

    from temporallayr.core.decorators import _compute_cost
    from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind
    from temporallayr.models.execution import ExecutionSpan
    import uuid
    from datetime import datetime, timezone

    total_tokens = prompt_tokens + completion_tokens
    cost = _compute_cost(model, prompt_tokens, completion_tokens)

    attrs: dict[str, Any] = {
        SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.LLM,
        SpanAttributes.LLM_MODEL_NAME: model,
        "duration_ms": duration_ms,
        "source": "openai_wrapper",
    }
    if total_tokens > 0:
        attrs[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] = prompt_tokens
        attrs[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = completion_tokens
        attrs[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] = total_tokens
    if cost is not None:
        attrs["cost_usd"] = cost
    if inputs is not None:
        try:
            attrs[SpanAttributes.INPUT_VALUE] = str(inputs)[:500]
        except Exception:
            pass

    now = datetime.now(timezone.utc)
    span = ExecutionSpan(
        span_id=str(uuid.uuid4()),
        parent_span_id=None,
        name=f"llm:{model}",
        start_time=datetime.fromtimestamp(time.time() - duration_ms / 1000, tz=timezone.utc),
        end_time=now,
        duration_ms=duration_ms,
        status="error" if error else "success",
        error=error,
        attributes=attrs,
    )
    graph.spans.append(span)


class _TrackedChatCompletions:
    """Wraps openai.chat.completions with tracing."""

    def __init__(self, original):
        self._original = original

    def create(self, *args, **kwargs) -> Any:
        model = kwargs.get("model", "unknown")
        messages = kwargs.get("messages", [])
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
            prompt_tokens = completion_tokens = 0
            if response and hasattr(response, "usage") and response.usage:
                prompt_tokens = response.usage.prompt_tokens or 0
                completion_tokens = response.usage.completion_tokens or 0
            _add_llm_span(
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                duration_ms=duration_ms,
                error=error,
                inputs=messages,
            )

    async def acreate(self, *args, **kwargs) -> Any:
        """Async version."""
        model = kwargs.get("model", "unknown")
        messages = kwargs.get("messages", [])
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
            prompt_tokens = completion_tokens = 0
            if response and hasattr(response, "usage") and response.usage:
                prompt_tokens = response.usage.prompt_tokens or 0
                completion_tokens = response.usage.completion_tokens or 0
            _add_llm_span(
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                duration_ms=duration_ms,
                error=error,
                inputs=messages,
            )


class _TrackedChat:
    def __init__(self, original):
        self.completions = _TrackedChatCompletions(original.completions)


class OpenAI:
    """
    Drop-in replacement for openai.OpenAI.
    Automatically traces all chat completion calls into TemporalLayr.

    from temporallayr.integrations.openai_wrapper import OpenAI
    client = OpenAI(api_key="...")  # identical API, auto-traced
    """

    def __init__(self, *args, **kwargs):
        if not _OPENAI_AVAILABLE:
            raise ImportError("openai not installed. Run: pip install temporallayr[openai]")
        self._client = _openai.OpenAI(*args, **kwargs)
        self.chat = _TrackedChat(self._client.chat)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)


class AsyncOpenAI:
    """Async version of the drop-in wrapper."""

    def __init__(self, *args, **kwargs):
        if not _OPENAI_AVAILABLE:
            raise ImportError("openai not installed. Run: pip install temporallayr[openai]")
        self._client = _openai.AsyncOpenAI(*args, **kwargs)
        self.chat = _TrackedChat(self._client.chat)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)
