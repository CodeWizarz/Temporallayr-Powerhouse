"""
OpenTelemetry / OpenInference compatible OTLP exporter.

Converts TemporalLayr Traces/Spans into OTLP-formatted payloads and ships them
to any OTLP-compatible collector — Phoenix, Jaeger, Grafana Tempo, etc.

Incorporates patterns from:
  https://github.com/Arize-ai/phoenix  (OTLP gRPC/HTTP receiver)
  https://github.com/Arize-ai/openinference (semantic conventions)

No external otel SDK dependency required — we speak the wire protocol directly.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from temporallayr.core.semantic_conventions import MimeType, SpanAttributes
from temporallayr.models.execution import ExecutionGraph, Span

logger = logging.getLogger(__name__)

# ── OTLP protobuf-JSON wire format constants ──────────────────────────
_OTLP_SPAN_KIND_INTERNAL = 1
_OTLP_SPAN_KIND_MAP = {
    "AGENT": 1,
    "CHAIN": 1,
    "TOOL": 1,
    "LLM": 1,
    "RETRIEVER": 1,
    "SERVER": 2,
    "CLIENT": 3,
}


def _to_otlp_trace_id(trace_id: str) -> str:
    """Pad/truncate UUID to 32-char hex for OTLP."""
    clean = trace_id.replace("-", "")
    return clean.ljust(32, "0")[:32]


def _to_otlp_span_id(span_id: str) -> str:
    """Pad/truncate UUID to 16-char hex for OTLP."""
    clean = span_id.replace("-", "")
    return clean.ljust(16, "0")[:16]


def _to_nanos(dt: Any) -> int:
    """Convert datetime to nanoseconds since epoch."""
    try:
        return int(dt.timestamp() * 1_000_000_000)
    except Exception:
        return int(time.time() * 1_000_000_000)


def _make_str_attr(key: str, value: str) -> dict[str, Any]:
    return {"key": key, "value": {"stringValue": str(value)}}


def _make_int_attr(key: str, value: int) -> dict[str, Any]:
    return {"key": key, "value": {"intValue": str(value)}}


def _make_double_attr(key: str, value: float) -> dict[str, Any]:
    return {"key": key, "value": {"doubleValue": value}}


def _span_to_otlp(span: Span, trace_id: str, tenant_id: str) -> dict[str, Any]:
    """Convert a TemporalLayr Span to OTLP JSON span format."""
    attrs = span.attributes

    # Infer OpenInference span kind from name prefix
    kind_str = "CHAIN"
    name_lower = span.name.lower()
    if name_lower.startswith("model_call:") or name_lower.startswith("llm"):
        kind_str = "LLM"
    elif name_lower.startswith("tool_call:") or name_lower.startswith("tool"):
        kind_str = "TOOL"
    elif name_lower.startswith("agent"):
        kind_str = "AGENT"
    elif name_lower.startswith("retriev"):
        kind_str = "RETRIEVER"
    elif name_lower.startswith("embed"):
        kind_str = "EMBEDDING"

    otlp_attrs = [
        _make_str_attr(SpanAttributes.OPENINFERENCE_SPAN_KIND, kind_str),
        _make_str_attr("temporallayr.tenant_id", tenant_id),
    ]

    # Map inputs → input.value
    if "inputs" in attrs:
        try:
            otlp_attrs.append(
                _make_str_attr(SpanAttributes.INPUT_VALUE, json.dumps(attrs["inputs"]))
            )
            otlp_attrs.append(_make_str_attr(SpanAttributes.INPUT_MIME_TYPE, MimeType.JSON))
        except Exception:
            pass

    # Map output → output.value
    if "output" in attrs and attrs["output"] is not None:
        try:
            out = attrs["output"]
            out_str = out if isinstance(out, str) else json.dumps(out)
            otlp_attrs.append(_make_str_attr(SpanAttributes.OUTPUT_VALUE, out_str))
            mime = MimeType.TEXT if isinstance(out, str) else MimeType.JSON
            otlp_attrs.append(_make_str_attr(SpanAttributes.OUTPUT_MIME_TYPE, mime))
        except Exception:
            pass

    # Token counts if present (set by @track_llm users)
    for field, attr in [
        ("prompt_tokens", SpanAttributes.LLM_TOKEN_COUNT_PROMPT),
        ("completion_tokens", SpanAttributes.LLM_TOKEN_COUNT_COMPLETION),
        ("total_tokens", SpanAttributes.LLM_TOKEN_COUNT_TOTAL),
    ]:
        if field in attrs:
            try:
                otlp_attrs.append(_make_int_attr(attr, int(attrs[field])))
            except Exception:
                pass

    # Model name
    if "model" in attrs:
        otlp_attrs.append(_make_str_attr(SpanAttributes.LLM_MODEL_NAME, str(attrs["model"])))

    # Tool name for tool spans
    if kind_str == "TOOL":
        tool_name = span.name.replace("tool_call:", "")
        otlp_attrs.append(_make_str_attr(SpanAttributes.TOOL_NAME, tool_name))
        if "code" in attrs and "name" in attrs["code"]:
            otlp_attrs.append(
                _make_str_attr(SpanAttributes.TOOL_DESCRIPTION, attrs["code"]["name"])
            )

    # Status
    has_error = span.error or attrs.get("error")
    status_code = "STATUS_CODE_ERROR" if has_error else "STATUS_CODE_OK"
    events = []
    if has_error:
        error_msg = span.error or str(attrs.get("error", ""))
        events.append(
            {
                "name": "exception",
                "timeUnixNano": str(_to_nanos(span.end_time or span.start_time)),
                "attributes": [
                    _make_str_attr(SpanAttributes.EXCEPTION_MESSAGE, error_msg),
                    _make_str_attr(SpanAttributes.EXCEPTION_TYPE, "Exception"),
                ],
            }
        )

    end_time = span.end_time or span.start_time

    return {
        "traceId": _to_otlp_trace_id(trace_id),
        "spanId": _to_otlp_span_id(span.span_id),
        "parentSpanId": _to_otlp_span_id(span.parent_span_id) if span.parent_span_id else "",
        "name": span.name,
        "kind": _OTLP_SPAN_KIND_MAP.get(kind_str, _OTLP_SPAN_KIND_INTERNAL),
        "startTimeUnixNano": str(_to_nanos(span.start_time)),
        "endTimeUnixNano": str(_to_nanos(end_time)),
        "attributes": otlp_attrs,
        "events": events,
        "status": {"code": status_code},
    }


def trace_to_otlp_payload(graph: ExecutionGraph) -> dict[str, Any]:
    """
    Convert a full TemporalLayr ExecutionGraph to OTLP/JSON ResourceSpans payload.
    Compatible with Phoenix's OTLP HTTP receiver at /v1/traces.
    """
    otlp_spans = [_span_to_otlp(span, graph.trace_id, graph.tenant_id) for span in graph.spans]

    return {
        "resourceSpans": [
            {
                "resource": {
                    "attributes": [
                        _make_str_attr("service.name", "temporallayr"),
                        _make_str_attr("temporallayr.tenant_id", graph.tenant_id),
                    ]
                },
                "scopeSpans": [
                    {
                        "scope": {"name": "temporallayr.sdk", "version": "0.1.0"},
                        "spans": otlp_spans,
                    }
                ],
            }
        ]
    }


class OTLPExporter:
    """
    Ships TemporalLayr traces to any OTLP HTTP collector.
    Phoenix default: http://localhost:6006/v1/traces
    Jaeger:         http://localhost:4318/v1/traces
    Grafana Tempo:  http://localhost:4318/v1/traces
    """

    def __init__(self, endpoint: str, headers: dict[str, str] | None = None) -> None:
        self.endpoint = endpoint.rstrip("/")
        self._headers = {"Content-Type": "application/json", **(headers or {})}

    async def export(self, graph: ExecutionGraph) -> bool:
        """Export a trace. Returns True on success. Never raises."""
        try:
            import httpx

            payload = trace_to_otlp_payload(graph)
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self.endpoint}/v1/traces",
                    json=payload,
                    headers=self._headers,
                )
                if resp.status_code >= 400:
                    logger.warning("OTLP export failed: %s %s", resp.status_code, resp.text[:200])
                    return False
            return True
        except Exception as e:
            logger.warning("OTLP exporter error: %s", e)
            return False

    def export_sync(self, graph: ExecutionGraph) -> bool:
        """Synchronous export for non-async contexts."""
        try:
            import httpx

            payload = trace_to_otlp_payload(graph)
            resp = httpx.post(
                f"{self.endpoint}/v1/traces",
                json=payload,
                headers=self._headers,
                timeout=5.0,
            )
            return resp.status_code < 400
        except Exception as e:
            logger.warning("OTLP sync export error: %s", e)
            return False


# ── Global optional exporter (set via env or init) ────────────────────
_otlp_exporter: OTLPExporter | None = None


def configure_otlp_exporter(endpoint: str, headers: dict[str, str] | None = None) -> None:
    """Call this once at startup to enable OTLP export."""
    global _otlp_exporter
    _otlp_exporter = OTLPExporter(endpoint=endpoint, headers=headers)


def get_otlp_exporter() -> OTLPExporter | None:
    import os

    global _otlp_exporter
    if _otlp_exporter is None:
        endpoint = os.getenv("TEMPORALLAYR_OTLP_ENDPOINT")
        if endpoint:
            api_key = os.getenv("TEMPORALLAYR_OTLP_API_KEY")
            hdrs = {"api_key": api_key} if api_key else None
            _otlp_exporter = OTLPExporter(endpoint=endpoint, headers=hdrs)
    return _otlp_exporter
