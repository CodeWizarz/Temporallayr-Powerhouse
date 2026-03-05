"""
LangChain callback handler — zero-config tracing.

Usage:
    from temporallayr.integrations.langchain import TemporalLayrCallbackHandler
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(callbacks=[TemporalLayrCallbackHandler()])

    # Or global:
    from langchain.callbacks import set_global_handler
    set_global_handler("temporallayr")
"""

from __future__ import annotations

import logging
import time
from datetime import UTC
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)

try:
    from langchain_core.callbacks.base import BaseCallbackHandler
    from langchain_core.outputs import LLMResult

    _LANGCHAIN_AVAILABLE = True
except ImportError:
    _LANGCHAIN_AVAILABLE = False
    BaseCallbackHandler = object  # type: ignore
    LLMResult = Any  # type: ignore


class TemporalLayrCallbackHandler(BaseCallbackHandler):
    """
    LangChain callback handler that records every LLM call, chain step,
    tool call, and error into a TemporalLayr execution graph.

    Compatible with:
    - langchain-core >= 0.1
    - langchain >= 0.1
    - Any LangChain-compatible LLM (OpenAI, Anthropic, Gemini, etc.)
    """

    def __init__(self, auto_flush: bool = True) -> None:
        if not _LANGCHAIN_AVAILABLE:
            raise ImportError(
                "langchain-core not installed. Run: pip install temporallayr[langchain]"
            )
        super().__init__()
        self._auto_flush = auto_flush
        self._pending: dict[str, dict[str, Any]] = {}  # run_id → span data

    def _get_graph(self):
        from temporallayr.core.recorder import _current_graph

        return _current_graph.get(None)

    def _add_span(self, span_data: dict[str, Any]) -> None:
        graph = self._get_graph()
        if graph is None:
            return
        from temporallayr.models.execution import ExecutionSpan

        try:
            span = ExecutionSpan(**span_data)
            graph.spans.append(span)
        except Exception as e:
            logger.debug("Failed to add LangChain span", extra={"error": str(e)})

    # ── LLM ──────────────────────────────────────────────────────────

    def on_llm_start(
        self,
        serialized: dict[str, Any],
        prompts: list[str],
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        self._pending[str(run_id)] = {
            "start_time": time.time(),
            "model": serialized.get("kwargs", {}).get("model_name", "unknown"),
            "prompts": prompts,
        }

    def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        run_key = str(run_id)
        pending = self._pending.pop(run_key, {})
        start = pending.get("start_time", time.time())
        duration_ms = (time.time() - start) * 1000

        # Extract token usage
        usage = {}
        if hasattr(response, "llm_output") and response.llm_output:
            usage = response.llm_output.get("token_usage", {})

        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)

        import uuid
        from datetime import datetime

        from temporallayr.core.decorators import _compute_cost
        from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind

        model = pending.get("model", "unknown")
        cost = _compute_cost(model, prompt_tokens, completion_tokens)

        attrs: dict[str, Any] = {
            SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.LLM,
            SpanAttributes.LLM_MODEL_NAME: model,
            "duration_ms": duration_ms,
            "source": "langchain",
        }
        if total_tokens:
            attrs[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] = prompt_tokens
            attrs[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = completion_tokens
            attrs[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] = total_tokens
        if cost is not None:
            attrs["cost_usd"] = cost

        now = datetime.now(UTC)
        self._add_span(
            {
                "span_id": str(uuid.uuid4()),
                "parent_span_id": None,
                "name": f"llm:{model}",
                "start_time": datetime.fromtimestamp(start, tz=UTC),
                "end_time": now,
                "duration_ms": duration_ms,
                "status": "success",
                "attributes": attrs,
            }
        )

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        run_key = str(run_id)
        pending = self._pending.pop(run_key, {})
        start = pending.get("start_time", time.time())
        duration_ms = (time.time() - start) * 1000

        import uuid
        from datetime import datetime

        from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind

        self._add_span(
            {
                "span_id": str(uuid.uuid4()),
                "parent_span_id": None,
                "name": f"llm:{pending.get('model', 'unknown')}",
                "start_time": datetime.fromtimestamp(start, tz=UTC),
                "end_time": datetime.now(UTC),
                "duration_ms": duration_ms,
                "status": "error",
                "error": str(error),
                "attributes": {
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.LLM,
                    "source": "langchain",
                },
            }
        )

    # ── Tools ─────────────────────────────────────────────────────────

    def on_tool_start(
        self,
        serialized: dict[str, Any],
        input_str: str,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        self._pending[str(run_id)] = {
            "start_time": time.time(),
            "tool_name": serialized.get("name", "unknown_tool"),
            "input": input_str,
        }

    def on_tool_end(
        self,
        output: str,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        run_key = str(run_id)
        pending = self._pending.pop(run_key, {})
        start = pending.get("start_time", time.time())
        duration_ms = (time.time() - start) * 1000

        import uuid
        from datetime import datetime

        from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind

        tool_name = pending.get("tool_name", "unknown_tool")
        self._add_span(
            {
                "span_id": str(uuid.uuid4()),
                "parent_span_id": None,
                "name": f"tool:{tool_name}",
                "start_time": datetime.fromtimestamp(start, tz=UTC),
                "end_time": datetime.now(UTC),
                "duration_ms": duration_ms,
                "status": "success",
                "attributes": {
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.TOOL,
                    SpanAttributes.TOOL_NAME: tool_name,
                    "input": pending.get("input"),
                    "output": str(output)[:500],
                    "source": "langchain",
                },
            }
        )

    def on_tool_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        run_key = str(run_id)
        pending = self._pending.pop(run_key, {})
        start = pending.get("start_time", time.time())

        import uuid
        from datetime import datetime

        from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind

        tool_name = pending.get("tool_name", "unknown_tool")
        self._add_span(
            {
                "span_id": str(uuid.uuid4()),
                "parent_span_id": None,
                "name": f"tool:{tool_name}",
                "start_time": datetime.fromtimestamp(start, tz=UTC),
                "end_time": datetime.now(UTC),
                "duration_ms": (time.time() - start) * 1000,
                "status": "error",
                "error": str(error),
                "attributes": {
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.TOOL,
                    SpanAttributes.TOOL_NAME: tool_name,
                    "source": "langchain",
                },
            }
        )
