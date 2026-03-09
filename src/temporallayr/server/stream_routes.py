"""Server-Sent Events endpoint for real-time trace/span streaming."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import deque
from typing import AsyncGenerator

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger("temporallayr.stream")

router = APIRouter(tags=["stream"])

# In-memory ring buffer for recent events (last 1000)
_event_buffer: deque[dict] = deque(maxlen=1000)
_subscribers: list[asyncio.Queue] = []


def publish_event(event: dict) -> None:
    """Called by ingest pipeline to push events to all SSE subscribers."""
    _event_buffer.append(event)
    dead: list[asyncio.Queue] = []
    for q in _subscribers:
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        _subscribers.remove(q)


async def _event_generator(
    request: Request,
    queue: asyncio.Queue,
    kind_filter: str | None = None,
    status_filter: str | None = None,
    tenant_filter: str | None = None,
) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted events, filtering as requested."""
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
                continue

            # Apply filters
            if kind_filter and event.get("span_kind") != kind_filter:
                continue
            if status_filter and event.get("status") != status_filter:
                continue
            if tenant_filter and event.get("tenant_id") != tenant_filter:
                continue

            data = json.dumps(event, default=str)
            yield f"data: {data}\n\n"
    finally:
        if queue in _subscribers:
            _subscribers.remove(queue)


@router.get("/v1/stream")
async def stream_events(
    request: Request,
    kind: str | None = Query(None, description="Filter by span_kind: llm, tool, pipeline, agent"),
    status: str | None = Query(None, description="Filter by status: ok, error"),
    tenant_id: str | None = Query(None, description="Filter by tenant"),
    backfill: int = Query(50, ge=0, le=200, description="Number of recent events to backfill"),
):
    """SSE endpoint for real-time event streaming.

    Connect with EventSource:
        const es = new EventSource('/v1/stream?kind=llm&backfill=100');
        es.onmessage = (e) => console.log(JSON.parse(e.data));
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=500)
    _subscribers.append(queue)

    # Backfill recent events
    recent = list(_event_buffer)[-backfill:] if backfill > 0 else []
    for evt in recent:
        if kind and evt.get("span_kind") != kind:
            continue
        if status and evt.get("status") != status:
            continue
        if tenant_id and evt.get("tenant_id") != tenant_id:
            continue
        try:
            queue.put_nowait(evt)
        except asyncio.QueueFull:
            break

    return StreamingResponse(
        _event_generator(request, queue, kind, status, tenant_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/v1/stream/stats")
async def stream_stats():
    """Return current stream statistics."""
    return {
        "buffer_size": len(_event_buffer),
        "active_subscribers": len(_subscribers),
        "buffer_capacity": _event_buffer.maxlen,
    }
