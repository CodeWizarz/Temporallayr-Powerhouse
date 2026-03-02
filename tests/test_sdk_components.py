from __future__ import annotations

import asyncio
from typing import Any, cast

import pytest

from temporallayr.config import TemporalLayrConfig
from temporallayr.sdk_api import _AsyncTransport


def test_transport_drop_policy_increments_metric() -> None:
    config = TemporalLayrConfig(
        api_key="key",
        server_url="https://example.com",
        batch_size=10,
        flush_interval=1.0,
        max_queue_size=1,
        timeout_seconds=1.0,
    )
    transport = _AsyncTransport(config)

    async def run() -> None:
        await transport.enqueue({"a": 1})
        await transport.enqueue({"b": 2})

    asyncio.run(run())
    assert transport.dropped_events == 1


def test_transport_shutdown_without_start() -> None:
    config = TemporalLayrConfig(
        api_key="key",
        server_url="https://example.com",
        batch_size=10,
        flush_interval=1.0,
        max_queue_size=1,
        timeout_seconds=1.0,
    )
    transport = _AsyncTransport(config)
    asyncio.run(transport.shutdown())


def test_transport_start_and_flush_success(monkeypatch: pytest.MonkeyPatch) -> None:
    config = TemporalLayrConfig(
        api_key="key",
        server_url="https://example.com",
        batch_size=10,
        flush_interval=1.0,
        max_queue_size=5,
        timeout_seconds=1.0,
    )
    transport = _AsyncTransport(config)

    class OkClient:
        def __init__(self) -> None:
            self.calls = 0

        async def post(self, *args: object, **kwargs: object) -> object:
            del args, kwargs
            self.calls += 1

            class Resp:
                @staticmethod
                def raise_for_status() -> None:
                    return None

            return Resp()

        async def aclose(self) -> None:
            return None

    async def fake_start() -> None:
        transport._client = cast(Any, OkClient())

    monkeypatch.setattr(transport, "start", fake_start)

    async def run() -> None:
        await transport.start()
        await transport.enqueue({"event": 1})
        await transport.flush()

    asyncio.run(run())


def test_sdk_flush_without_trace(monkeypatch: pytest.MonkeyPatch) -> None:
    import temporallayr
    from temporallayr import sdk_api

    temporallayr.init(api_key="k", server_url="https://example.com")
    runtime = sdk_api._runtime_var.get()
    assert runtime is not None

    async def fake_start() -> None:
        return None

    async def fake_flush() -> None:
        return None

    monkeypatch.setattr(runtime.transport, "start", fake_start)
    monkeypatch.setattr(runtime.transport, "flush", fake_flush)

    asyncio.run(temporallayr.flush())


def test_shutdown_clears_runtime(monkeypatch: pytest.MonkeyPatch) -> None:
    import temporallayr
    from temporallayr import sdk_api

    temporallayr.init(api_key="k", server_url="https://example.com")
    runtime = sdk_api._runtime_var.get()
    assert runtime is not None

    async def fake_shutdown() -> None:
        return None

    async def fake_flush() -> None:
        return None

    monkeypatch.setattr(runtime.transport, "shutdown", fake_shutdown)
    monkeypatch.setattr(sdk_api, "flush", fake_flush)

    asyncio.run(temporallayr.shutdown())


def test_serialize_trace_shape() -> None:
    import temporallayr
    from temporallayr import sdk_api

    temporallayr.init(api_key="k", server_url="https://example.com")
    temporallayr.start_trace(trace_name="root")
    temporallayr.start_span(name="span", attributes={"k": "v"})
    temporallayr.record_event(name="ev", payload={"ok": True})

    trace = sdk_api._trace_var.get()
    assert trace is not None
    payload = sdk_api._serialize_trace(trace)
    assert payload["trace_id"] == trace.trace_id
    assert payload["spans"][0]["events"][0]["name"] == "ev"


def test_transport_flush_retries_exhausted(monkeypatch: pytest.MonkeyPatch) -> None:
    config = TemporalLayrConfig(
        api_key="key",
        server_url="https://example.com",
        batch_size=10,
        flush_interval=1.0,
        max_queue_size=5,
        timeout_seconds=1.0,
        max_retries=1,
    )
    transport = _AsyncTransport(config)

    class FailingClient:
        def __init__(self) -> None:
            self.calls = 0

        async def post(self, *args: object, **kwargs: object) -> object:
            del args, kwargs
            self.calls += 1
            raise RuntimeError("down")

        async def aclose(self) -> None:
            return None

    transport._client = cast(Any, FailingClient())

    async def fast_sleep(_: float) -> None:
        return None

    monkeypatch.setattr("temporallayr.sdk_api.asyncio.sleep", fast_sleep)

    async def run() -> None:
        await transport.enqueue({"x": 1})
        await transport.flush()

    asyncio.run(run())
    assert cast(Any, transport._client).calls == 2


def test_transport_worker_start_and_shutdown(monkeypatch: pytest.MonkeyPatch) -> None:
    config = TemporalLayrConfig(
        api_key="key",
        server_url="https://example.com",
        batch_size=10,
        flush_interval=0.05,
        max_queue_size=5,
        timeout_seconds=1.0,
    )
    transport = _AsyncTransport(config)

    async def fast_sleep(_: float) -> None:
        transport._stop.set()
        return None

    monkeypatch.setattr("temporallayr.sdk_api.asyncio.sleep", fast_sleep)

    async def run() -> None:
        await transport.start()
        await transport.shutdown()

    asyncio.run(run())


def test_transport_run_loop_calls_flush(monkeypatch: pytest.MonkeyPatch) -> None:
    config = TemporalLayrConfig(
        api_key="key",
        server_url="https://example.com",
        batch_size=10,
        flush_interval=1.0,
        max_queue_size=5,
        timeout_seconds=1.0,
    )
    transport = _AsyncTransport(config)
    calls = {"flush": 0}

    async def fake_flush() -> None:
        calls["flush"] += 1
        transport._stop.set()

    async def fast_sleep(_: float) -> None:
        return None

    monkeypatch.setattr(transport, "flush", fake_flush)
    monkeypatch.setattr("temporallayr.sdk_api.asyncio.sleep", fast_sleep)

    asyncio.run(transport._run())
    assert calls["flush"] == 1
