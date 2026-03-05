"""Stable TemporalLayr SDK public API."""

from __future__ import annotations

import asyncio
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

import httpx

from temporallayr.config import TemporalLayrConfig


@dataclass(slots=True)
class _SpanState:
    span_id: str
    trace_id: str
    parent_span_id: str | None
    name: str
    started_at: str
    attributes: dict[str, Any] = field(default_factory=dict)
    events: list[dict[str, Any]] = field(default_factory=list)


@dataclass(slots=True)
class _TraceState:
    trace_id: str
    started_at: str
    spans: list[_SpanState] = field(default_factory=list)


class _AsyncTransport:
    def __init__(self, config: TemporalLayrConfig) -> None:
        self._config = config
        self._queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=config.max_queue_size)
        self._dropped_events = 0
        self._stop = asyncio.Event()
        self._worker: asyncio.Task[None] | None = None
        self._client: httpx.AsyncClient | None = None

    @property
    def dropped_events(self) -> int:
        return self._dropped_events

    async def start(self) -> None:
        self._client = httpx.AsyncClient(timeout=self._config.timeout_seconds)
        self._worker = asyncio.create_task(self._run())

    async def enqueue(self, item: dict[str, Any]) -> None:
        if self._queue.full():
            self._dropped_events += 1
            return
        await self._queue.put(item)

    async def _run(self) -> None:
        while not self._stop.is_set():
            await asyncio.sleep(self._config.flush_interval)
            await self.flush()

    async def flush(self) -> None:
        batch: list[dict[str, Any]] = []
        while len(batch) < self._config.batch_size and not self._queue.empty():
            batch.append(self._queue.get_nowait())

        if not batch:
            return

        payload = {"events": batch}
        for attempt in range(self._config.max_retries + 1):
            try:
                assert self._client is not None
                response = await self._client.post(
                    f"{self._config.server_url}/v1/ingest",
                    headers={
                        "Authorization": f"Bearer {self._config.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                return
            except Exception:
                if attempt >= self._config.max_retries:
                    return
                await asyncio.sleep(self._config.base_backoff * (2**attempt))

    async def shutdown(self) -> None:
        self._stop.set()
        if self._worker is not None:
            self._worker.cancel()
            try:
                await self._worker
            except asyncio.CancelledError:
                pass
        await self.flush()
        if self._client is not None:
            await self._client.aclose()


@dataclass(slots=True)
class _Runtime:
    config: TemporalLayrConfig
    transport: _AsyncTransport


_runtime_var: ContextVar[_Runtime | None] = ContextVar("_runtime_var", default=None)
_trace_var: ContextVar[_TraceState | None] = ContextVar("_trace_var", default=None)
_span_stack_var: ContextVar[tuple[str, ...]] = ContextVar("_span_stack_var", default=())


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _validate_config(config: TemporalLayrConfig) -> None:
    if not config.api_key:
        raise ValueError("api_key is required")
    parsed = urlparse(config.server_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("server_url must be a valid HTTP(S) URL")
    if config.timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be > 0")
    if not (1 <= config.batch_size <= 1000):
        raise ValueError("batch_size must be within [1, 1000]")
    if not (0.05 <= config.flush_interval <= 60):
        raise ValueError("flush_interval must be within [0.05, 60]")


def init(**kwargs: object) -> None:
    config = TemporalLayrConfig.from_env().model_copy(update=kwargs)
    _validate_config(config)
    runtime = _Runtime(config=config, transport=_AsyncTransport(config))
    _runtime_var.set(runtime)


def start_trace(*, trace_name: str) -> str:
    del trace_name
    trace = _TraceState(trace_id=str(uuid4()), started_at=_utc_now())
    _trace_var.set(trace)
    _span_stack_var.set(())
    return trace.trace_id


def start_span(*, name: str, attributes: dict[str, Any] | None = None) -> str:
    trace = _trace_var.get()
    if trace is None:
        raise RuntimeError("No active trace. Call start_trace() first.")

    stack = _span_stack_var.get()
    span_id = str(uuid4())
    parent = stack[-1] if stack else None
    span = _SpanState(
        span_id=span_id,
        trace_id=trace.trace_id,
        parent_span_id=parent,
        name=name,
        started_at=_utc_now(),
        attributes=attributes or {},
    )
    trace.spans.append(span)
    _span_stack_var.set((*stack, span_id))
    return span_id


def record_event(*, name: str, payload: dict[str, Any] | None = None) -> None:
    trace = _trace_var.get()
    if trace is None:
        raise RuntimeError("No active trace. Call start_trace() first.")
    stack = _span_stack_var.get()
    if not stack:
        raise RuntimeError("No active span. Call start_span() first.")

    active_span_id = stack[-1]
    for span in reversed(trace.spans):
        if span.span_id == active_span_id:
            span.events.append(
                {
                    "name": name,
                    "payload": payload or {},
                    "timestamp": _utc_now(),
                }
            )
            break


def _serialize_trace(trace: _TraceState) -> dict[str, Any]:
    return {
        "trace_id": trace.trace_id,
        "started_at": trace.started_at,
        "spans": [
            {
                "span_id": span.span_id,
                "trace_id": span.trace_id,
                "parent_span_id": span.parent_span_id,
                "name": span.name,
                "started_at": span.started_at,
                "attributes": span.attributes,
                "events": span.events,
            }
            for span in trace.spans
        ],
    }


async def flush() -> None:
    runtime = _runtime_var.get()
    if runtime is None:
        raise RuntimeError("SDK not initialized. Call init() first.")

    if runtime.transport._worker is None:
        await runtime.transport.start()

    trace = _trace_var.get()
    if trace is not None:
        await runtime.transport.enqueue(_serialize_trace(trace))
        _trace_var.set(None)
        _span_stack_var.set(())

    await runtime.transport.flush()


async def shutdown() -> None:
    runtime = _runtime_var.get()
    if runtime is None:
        return
    await flush()
    await runtime.transport.shutdown()
    _runtime_var.set(None)
