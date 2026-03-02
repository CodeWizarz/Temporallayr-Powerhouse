"""Public tracing decorators."""

from __future__ import annotations

import asyncio
import functools
import inspect
from collections.abc import Callable
from typing import Any, TypeVar, cast

from temporallayr.client import get_sdk
from temporallayr.context import (
    get_context,
    get_current_span_id,
    get_current_trace,
    pop_current_span,
    push_current_span,
    set_current_trace,
)
from temporallayr.models.execution import Span, Trace, utc_now
from temporallayr.serializer import safe_serialize

F = TypeVar("F", bound=Callable[..., Any])


def _build_input_payload(func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    try:
        bound = inspect.signature(func).bind(*args, **kwargs)
        bound.apply_defaults()
        return safe_serialize(bound.arguments)
    except Exception:
        return safe_serialize({"args": args, "kwargs": kwargs})


def trace_span(func: F) -> F:
    if inspect.iscoroutinefunction(func):

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            return await _run_traced_async(func, args, kwargs)

        return cast(F, async_wrapper)

    @functools.wraps(func)
    def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
        return _run_traced_sync(func, args, kwargs)

    return cast(F, sync_wrapper)


async def _run_traced_async(
    func: Callable[..., Any], args: tuple[Any, ...], kwargs: dict[str, Any]
) -> Any:
    trace, created = _ensure_trace()
    span = Span(
        name=func.__name__,
        parent_span_id=get_current_span_id(),
        attributes={"module": getattr(func, "__module__", "")},
        input_payload=_build_input_payload(func, *args, **kwargs),
    )
    trace.add_span(span)
    push_current_span(span.span_id)
    try:
        result = await func(*args, **kwargs)
        span.output_payload = safe_serialize(result)
        return result
    except Exception as exc:
        span.error = str(exc)
        span.status = "error"
        raise
    finally:
        span.end_time = utc_now()
        pop_current_span()
        if created:
            trace.end_time = utc_now()
            await _emit_trace(trace)
            set_current_trace(None)


def _run_traced_sync(
    func: Callable[..., Any], args: tuple[Any, ...], kwargs: dict[str, Any]
) -> Any:
    trace, created = _ensure_trace()
    span = Span(
        name=func.__name__,
        parent_span_id=get_current_span_id(),
        attributes={"module": getattr(func, "__module__", "")},
        input_payload=_build_input_payload(func, *args, **kwargs),
    )
    trace.add_span(span)
    push_current_span(span.span_id)
    try:
        result = func(*args, **kwargs)
        span.output_payload = safe_serialize(result)
        return result
    except Exception as exc:
        span.error = str(exc)
        span.status = "error"
        raise
    finally:
        span.end_time = utc_now()
        pop_current_span()
        if created:
            trace.end_time = utc_now()
            try:
                asyncio.run(_emit_trace(trace))
            except Exception:
                pass
            set_current_trace(None)


def _ensure_trace() -> tuple[Trace, bool]:
    current = get_current_trace()
    if current is not None:
        return current, False
    sdk = get_sdk()
    tenant_id = get_context().tenant_id or (sdk.config.tenant_id if sdk else "default")
    trace = Trace(tenant_id=tenant_id)
    set_current_trace(trace)
    return trace, True


async def _emit_trace(trace: Trace) -> None:
    sdk = get_sdk()
    if sdk is None:
        return
    try:
        await sdk.transport.enqueue(trace)
    except Exception:
        return


# Backward compatibility aliases
track = trace_span
track_llm = trace_span
track_tool = trace_span
track_pipeline = trace_span
