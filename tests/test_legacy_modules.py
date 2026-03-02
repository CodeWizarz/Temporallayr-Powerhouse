from __future__ import annotations

from temporallayr.context import (
    get_context,
    get_current_span_id,
    get_current_trace,
    pop_current_span,
    push_current_span,
    set_context,
    set_current_trace,
)
from temporallayr.models.execution import Trace


def test_context_helpers_roundtrip() -> None:
    set_context(user="u", tenant_id="t", tags={"k": "v"})
    ctx = get_context()
    assert ctx.user == "u"
    assert ctx.tenant_id == "t"
    assert ctx.tags["k"] == "v"

    push_current_span("a")
    assert get_current_span_id() == "a"
    pop_current_span()
    assert get_current_span_id() is None

    trace = Trace(tenant_id="t")
    set_current_trace(trace)
    assert get_current_trace() is trace
    set_current_trace(None)
