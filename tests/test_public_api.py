from __future__ import annotations

import asyncio
from typing import Any, cast

import pytest

import temporallayr


def test_public_exports() -> None:
    assert sorted(temporallayr.__all__) == [
        "flush",
        "init",
        "record_event",
        "shutdown",
        "start_span",
        "start_trace",
        "track",
        "track_llm",
        "track_pipeline",
        "track_tool",
    ]


def test_config_validation_fails_fast() -> None:
    with pytest.raises(ValueError, match="api_key"):
        temporallayr.init(api_key=None, server_url="https://example.com")

    with pytest.raises(ValueError, match=r"valid HTTP\(S\) URL"):
        temporallayr.init(api_key="k", server_url="invalid-url")


def test_trace_span_event_flow(monkeypatch: pytest.MonkeyPatch) -> None:
    from temporallayr import sdk_api

    sent: list[dict[str, object]] = []

    async def fake_enqueue(item: dict[str, object]) -> None:
        sent.append(item)

    async def fake_transport_flush() -> None:
        return None

    async def fake_transport_start() -> None:
        return None

    async def fake_transport_shutdown() -> None:
        return None

    temporallayr.init(api_key="k", server_url="https://example.com", flush_interval=1.0)
    runtime = sdk_api._runtime_var.get()
    assert runtime is not None
    monkeypatch.setattr(runtime.transport, "enqueue", fake_enqueue)
    monkeypatch.setattr(runtime.transport, "flush", fake_transport_flush)
    monkeypatch.setattr(runtime.transport, "start", fake_transport_start)
    monkeypatch.setattr(runtime.transport, "shutdown", fake_transport_shutdown)

    trace_id = temporallayr.start_trace(trace_name="request")
    span_id = temporallayr.start_span(name="db", attributes={"query": "select 1"})
    temporallayr.record_event(name="executed", payload={"ok": True})

    assert isinstance(trace_id, str)
    assert isinstance(span_id, str)

    asyncio.run(temporallayr.flush())
    assert len(sent) == 1

    asyncio.run(temporallayr.shutdown())


def test_record_event_requires_active_span() -> None:
    temporallayr.init(api_key="k", server_url="https://example.com", flush_interval=1.0)
    temporallayr.start_trace(trace_name="r")
    with pytest.raises(RuntimeError, match="active span"):
        temporallayr.record_event(name="x")
    asyncio.run(temporallayr.shutdown())


def test_validate_bounds_errors() -> None:
    with pytest.raises(ValueError, match="batch_size"):
        temporallayr.init(api_key="k", server_url="https://example.com", batch_size=0)

    with pytest.raises(ValueError, match="flush_interval"):
        temporallayr.init(api_key="k", server_url="https://example.com", flush_interval=0.0)

    with pytest.raises(ValueError, match="timeout_seconds"):
        temporallayr.init(api_key="k", server_url="https://example.com", timeout_seconds=0.0)


def test_nested_span_parent_and_event_payload() -> None:
    from temporallayr import sdk_api

    temporallayr.init(api_key="k", server_url="https://example.com")
    temporallayr.start_trace(trace_name="root")
    parent = temporallayr.start_span(name="parent")
    child = temporallayr.start_span(name="child")
    temporallayr.record_event(name="evt", payload={"x": 1})

    trace = sdk_api._trace_var.get()
    assert trace is not None
    assert trace.spans[-1].span_id == child
    assert trace.spans[-1].parent_span_id == parent
    assert trace.spans[-1].events[0]["payload"] == {"x": 1}


def test_record_event_requires_trace() -> None:
    temporallayr.init(api_key="k", server_url="https://example.com")
    with pytest.raises(RuntimeError, match="start_trace"):
        temporallayr.record_event(name="evt")


def test_shutdown_noop_when_not_initialized() -> None:
    asyncio.run(temporallayr.shutdown())


def test_transport_retry_and_drop(monkeypatch: pytest.MonkeyPatch) -> None:
    from temporallayr import sdk_api

    class FailingClient:
        def __init__(self) -> None:
            self.calls = 0

        async def post(self, *args: object, **kwargs: object) -> object:
            del args, kwargs
            self.calls += 1
            raise RuntimeError("down")

        async def aclose(self) -> None:
            return None

    temporallayr.init(api_key="k", server_url="https://example.com", max_retries=2)
    temporallayr.start_trace(trace_name="root")
    temporallayr.start_span(name="span")

    runtime = sdk_api._runtime_var.get()
    assert runtime is not None

    async def fake_start() -> None:
        runtime.transport._client = cast(Any, FailingClient())

    monkeypatch.setattr(runtime.transport, "start", fake_start)

    async def fast_sleep(_: float) -> None:
        return None

    monkeypatch.setattr("temporallayr.sdk_api.asyncio.sleep", fast_sleep)

    asyncio.run(temporallayr.flush())
    client = runtime.transport._client
    assert client is not None
    assert cast(Any, client).calls == 3


def test_start_trace_resets_span_stack() -> None:
    from temporallayr import sdk_api

    temporallayr.init(api_key="k", server_url="https://example.com")
    temporallayr.start_trace(trace_name="a")
    temporallayr.start_span(name="s1")
    assert sdk_api._span_stack_var.get()

    temporallayr.start_trace(trace_name="b")
    assert sdk_api._span_stack_var.get() == ()


def test_config_env_helpers() -> None:
    from temporallayr.config import get_config, get_server_url, get_tenant_id, get_verify_ssl

    cfg = get_config()
    assert cfg.server_url == get_server_url()
    assert isinstance(get_tenant_id(), str)
    assert get_verify_ssl() is True
