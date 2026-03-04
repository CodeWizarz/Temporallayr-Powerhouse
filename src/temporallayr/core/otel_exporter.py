"""
OTLP/OpenInference exporter — ships TemporalLayr traces to Phoenix, Jaeger, Tempo, etc.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from temporallayr.core.semantic_conventions import MimeType, SpanAttributes
from temporallayr.models.execution import ExecutionGraph, Span

logger = logging.getLogger(__name__)

_OTLP_SPAN_KIND_INTERNAL = 1
_OTLP_KIND_MAP = {"AGENT": 1, "CHAIN": 1, "TOOL": 1, "LLM": 1, "RETRIEVER": 1, "SERVER": 2, "CLIENT": 3}


def _to_otlp_trace_id(tid: str) -> str:
    return tid.replace("-", "").ljust(32, "0")[:32]


def _to_otlp_span_id(sid: str) -> str:
    return sid.replace("-", "").ljust(16, "0")[:16]


def _to_nanos(dt: Any) -> int:
    try:
        return int(dt.timestamp() * 1_000_000_000)
    except Exception:
        return int(time.time() * 1_000_000_000)


def _str_attr(key: str, val: str) -> dict[str, Any]:
    return {"key": key, "value": {"stringValue": str(val)}}


def _int_attr(key: str, val: int) -> dict[str, Any]:
    return {"key": key, "value": {"intValue": str(val)}}


def _dbl_attr(key: str, val: float) -> dict[str, Any]:
    return {"key": key, "value": {"doubleValue": val}}


def _span_to_otlp(span: Span, trace_id: str, tenant_id: str) -> dict[str, Any]:
    attrs = span.attributes
    kind_str = attrs.get(SpanAttributes.OPENINFERENCE_SPAN_KIND, "CHAIN")

    otlp_attrs = [
        _str_attr(SpanAttributes.OPENINFERENCE_SPAN_KIND, kind_str),
        _str_attr("temporallayr.tenant_id", tenant_id),
    ]

    if "inputs" in attrs:
        try:
            otlp_attrs.append(_str_attr(SpanAttributes.INPUT_VALUE, json.dumps(attrs["inputs"])))
            otlp_attrs.append(_str_attr(SpanAttributes.INPUT_MIME_TYPE, MimeType.JSON))
        except Exception:
            pass

    if attrs.get("output") is not None:
        try:
            out = attrs["output"]
            otlp_attrs.append(_str_attr(SpanAttributes.OUTPUT_VALUE,
                                        out if isinstance(out, str) else json.dumps(out)))
            otlp_attrs.append(_str_attr(SpanAttributes.OUTPUT_MIME_TYPE,
                                        MimeType.TEXT if isinstance(out, str) else MimeType.JSON))
        except Exception:
            pass

    for src, dest in [
        (SpanAttributes.LLM_TOKEN_COUNT_PROMPT, SpanAttributes.LLM_TOKEN_COUNT_PROMPT),
        (SpanAttributes.LLM_TOKEN_COUNT_COMPLETION, SpanAttributes.LLM_TOKEN_COUNT_COMPLETION),
        (SpanAttributes.LLM_TOKEN_COUNT_TOTAL, SpanAttributes.LLM_TOKEN_COUNT_TOTAL),
    ]:
        if src in attrs:
            try:
                otlp_attrs.append(_int_attr(dest, int(attrs[src])))
            except Exception:
                pass

    if SpanAttributes.LLM_MODEL_NAME in attrs:
        otlp_attrs.append(_str_attr(SpanAttributes.LLM_MODEL_NAME, str(attrs[SpanAttributes.LLM_MODEL_NAME])))

    if attrs.get("cost_usd") is not None:
        otlp_attrs.append(_dbl_attr("temporallayr.cost_usd", float(attrs["cost_usd"])))

    if attrs.get("duration_ms") is not None:
        otlp_attrs.append(_dbl_attr("temporallayr.duration_ms", float(attrs["duration_ms"])))

    if kind_str == "TOOL" and SpanAttributes.TOOL_NAME in attrs:
        otlp_attrs.append(_str_attr(SpanAttributes.TOOL_NAME, str(attrs[SpanAttributes.TOOL_NAME])))

    has_error = bool(span.error or attrs.get("error"))
    events = []
    if has_error:
        error_msg = span.error or str(attrs.get("error", ""))
        events.append({
            "name": "exception",
            "timeUnixNano": str(_to_nanos(span.end_time or span.start_time)),
            "attributes": [
                _str_attr(SpanAttributes.EXCEPTION_MESSAGE, error_msg),
                _str_attr(SpanAttributes.EXCEPTION_TYPE, "Exception"),
            ],
        })

    end_time = span.end_time or span.start_time
    return {
        "traceId": _to_otlp_trace_id(trace_id),
        "spanId": _to_otlp_span_id(span.span_id),
        "parentSpanId": _to_otlp_span_id(span.parent_span_id) if span.parent_span_id else "",
        "name": span.name,
        "kind": _OTLP_KIND_MAP.get(kind_str, _OTLP_SPAN_KIND_INTERNAL),
        "startTimeUnixNano": str(_to_nanos(span.start_time)),
        "endTimeUnixNano": str(_to_nanos(end_time)),
        "attributes": otlp_attrs,
        "events": events,
        "status": {"code": "STATUS_CODE_ERROR" if has_error else "STATUS_CODE_OK"},
    }


def trace_to_otlp_payload(graph: ExecutionGraph) -> dict[str, Any]:
    otlp_spans = [_span_to_otlp(span, graph.trace_id, graph.tenant_id) for span in graph.spans]
    return {
        "resourceSpans": [{
            "resource": {
                "attributes": [
                    _str_attr("service.name", "temporallayr"),
                    _str_attr("temporallayr.tenant_id", graph.tenant_id),
                ]
            },
            "scopeSpans": [{
                "scope": {"name": "temporallayr.sdk", "version": "0.2.0"},
                "spans": otlp_spans,
            }],
        }]
    }


class OTLPExporter:
    def __init__(self, endpoint: str, headers: dict[str, str] | None = None) -> None:
        self.endpoint = endpoint.rstrip("/")
        self._headers = {"Content-Type": "application/json", **(headers or {})}

    async def export(self, graph: ExecutionGraph) -> bool:
        try:
            import httpx
            payload = trace_to_otlp_payload(graph)
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self.endpoint}/v1/traces", json=payload, headers=self._headers
                )
                if resp.status_code >= 400:
                    logger.warning("OTLP export failed",
                                   extra={"status": resp.status_code, "body": resp.text[:200]})
                    return False
            return True
        except Exception as e:
            logger.warning("OTLP exporter error", extra={"error": str(e)})
            return False


_otlp_exporter: OTLPExporter | None = None


def configure_otlp_exporter(endpoint: str, headers: dict[str, str] | None = None) -> None:
    global _otlp_exporter
    _otlp_exporter = OTLPExporter(endpoint=endpoint, headers=headers)


def get_otlp_exporter() -> OTLPExporter | None:
    global _otlp_exporter
    if _otlp_exporter is None:
        from temporallayr.config import get_config
        cfg = get_config()
        if cfg.otlp_endpoint:
            hdrs = {"api_key": cfg.otlp_api_key} if cfg.otlp_api_key else None
            _otlp_exporter = OTLPExporter(endpoint=cfg.otlp_endpoint, headers=hdrs)
    return _otlp_exporter
