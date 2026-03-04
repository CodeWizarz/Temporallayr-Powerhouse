"""
LlamaIndex callback handler.

Usage:
    from temporallayr.integrations.llamaindex import TemporalLayrObserver
    from llama_index.core import Settings

    Settings.callback_manager.add_handler(TemporalLayrObserver())
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

try:
    from llama_index.core.callbacks.base_handler import BaseCallbackHandler as LlamaBaseHandler
    from llama_index.core.callbacks.schema import CBEventType, EventPayload

    _LLAMA_AVAILABLE = True
except ImportError:
    _LLAMA_AVAILABLE = False
    LlamaBaseHandler = object  # type: ignore
    CBEventType = Any  # type: ignore
    EventPayload = Any  # type: ignore


class TemporalLayrObserver(LlamaBaseHandler):
    """
    LlamaIndex observer — records query, retrieval, LLM, and embedding events.
    Compatible with llama-index-core >= 0.10.
    """

    event_starts_to_ignore: list = []
    event_ends_to_ignore: list = []

    def __init__(self) -> None:
        if not _LLAMA_AVAILABLE:
            raise ImportError(
                "llama-index-core not installed. Run: pip install temporallayr[llamaindex]"
            )
        super().__init__(
            event_starts_to_ignore=[],
            event_ends_to_ignore=[],
        )
        self._timings: dict[str, float] = {}

    def _get_graph(self):
        from temporallayr.core.recorder import _current_graph

        return _current_graph.get(None)

    def start_trace(self, trace_id: Optional[str] = None) -> None:
        pass

    def end_trace(
        self,
        trace_id: Optional[str] = None,
        trace_map: Optional[dict[str, list[str]]] = None,
    ) -> None:
        pass

    def on_event_start(
        self,
        event_type: CBEventType,
        payload: Optional[dict[str, Any]] = None,
        event_id: str = "",
        **kwargs: Any,
    ) -> str:
        self._timings[event_id] = time.time()
        return event_id

    def on_event_end(
        self,
        event_type: CBEventType,
        payload: Optional[dict[str, Any]] = None,
        event_id: str = "",
        **kwargs: Any,
    ) -> None:
        graph = self._get_graph()
        if graph is None:
            return

        start = self._timings.pop(event_id, time.time())
        duration_ms = (time.time() - start) * 1000

        from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind
        import uuid
        from datetime import datetime, timezone

        payload = payload or {}
        name = str(event_type).replace("CBEventType.", "").lower()

        # Map event type to span kind
        kind_map = {
            "LLM": SpanKind.LLM,
            "QUERY": SpanKind.CHAIN,
            "RETRIEVE": SpanKind.RETRIEVER,
            "EMBEDDING": SpanKind.EMBEDDING,
            "RERANKING": SpanKind.RERANKER,
            "FUNCTION_CALL": SpanKind.TOOL,
        }
        kind = kind_map.get(str(event_type).replace("CBEventType.", ""), SpanKind.CHAIN)

        attrs: dict[str, Any] = {
            SpanAttributes.OPENINFERENCE_SPAN_KIND: kind,
            "source": "llamaindex",
            "event_type": str(event_type),
            "duration_ms": duration_ms,
        }

        # Extract token usage for LLM events
        if hasattr(CBEventType, "LLM") and event_type == CBEventType.LLM:
            response = payload.get(EventPayload.RESPONSE, None)
            if response and hasattr(response, "raw"):
                usage = getattr(response.raw, "usage", None)
                if usage:
                    attrs[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] = getattr(
                        usage, "prompt_tokens", 0
                    )
                    attrs[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = getattr(
                        usage, "completion_tokens", 0
                    )

        error = payload.get("exception", None)
        now = datetime.now(timezone.utc)

        from temporallayr.models.execution import ExecutionSpan

        span = ExecutionSpan(
            span_id=str(uuid.uuid4()),
            parent_span_id=None,
            name=f"llama:{name}",
            start_time=datetime.fromtimestamp(start, tz=timezone.utc),
            end_time=now,
            duration_ms=duration_ms,
            status="error" if error else "success",
            error=str(error) if error else None,
            attributes=attrs,
        )
        graph.spans.append(span)
