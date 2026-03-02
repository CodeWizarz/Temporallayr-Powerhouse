"""Async-safe context propagation for trace/span state."""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from temporallayr.models.execution import Trace


@dataclass(slots=True)
class RuntimeContext:
    user: str | None = None
    agent: str | None = None
    session: str | None = None
    tenant_id: str | None = None
    tags: dict[str, str] = field(default_factory=dict)


_runtime_context: ContextVar[RuntimeContext | None] = ContextVar("_runtime_context", default=None)
_current_trace: ContextVar[Trace | None] = ContextVar("_current_trace", default=None)
_current_span_stack: ContextVar[tuple[str, ...] | None] = ContextVar(
    "_current_span_stack", default=None
)


def set_context(**kwargs: Any) -> None:
    current = get_context()
    tag_update = kwargs.get("tags")
    merged_tags = (
        {**current.tags, **tag_update} if isinstance(tag_update, dict) else dict(current.tags)
    )
    updated = RuntimeContext(
        user=kwargs.get("user", current.user),
        agent=kwargs.get("agent", current.agent),
        session=kwargs.get("session", current.session),
        tenant_id=kwargs.get("tenant_id", current.tenant_id),
        tags=merged_tags,
    )
    _runtime_context.set(updated)


def get_context() -> RuntimeContext:
    value = _runtime_context.get()
    if value is None:
        value = RuntimeContext()
        _runtime_context.set(value)
    return value


def get_current_trace() -> Trace | None:
    return _current_trace.get()


def set_current_trace(trace: Trace | None) -> None:
    _current_trace.set(trace)


def get_current_span_id() -> str | None:
    stack = _current_span_stack.get() or ()
    return stack[-1] if stack else None


def push_current_span(span_id: str) -> None:
    stack = _current_span_stack.get() or ()
    _current_span_stack.set((*stack, span_id))


def pop_current_span() -> None:
    stack = _current_span_stack.get() or ()
    _current_span_stack.set(stack[:-1])
