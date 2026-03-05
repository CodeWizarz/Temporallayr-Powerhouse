"""Async HTTP transport with batching, retries and overflow policy."""

from __future__ import annotations

import asyncio
import logging
from collections import deque
from typing import Any

try:
    import httpx
except Exception:
    httpx = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


class AsyncHTTPTransport:
    def __init__(
        self,
        *,
        server_url: str,
        api_key: str | None,
        flush_interval: float,
        batch_size: int,
        max_queue_size: int,
        max_retries: int = 3,
        base_backoff: float = 0.2,
        drop_policy: str = "drop_newest",
    ) -> None:
        self.server_url = server_url.rstrip("/")
        self.headers = {"Content-Type": "application/json"}
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"

        self.flush_interval = flush_interval
        self.batch_size = batch_size
        self.max_queue_size = max_queue_size
        self.max_retries = max_retries
        self.base_backoff = base_backoff
        self.drop_policy = drop_policy

        # Generic dict queue — accepts Trace models OR raw event dicts
        self._queue: deque[dict[str, Any]] = deque()
        self._lock = asyncio.Lock()
        self._stop = asyncio.Event()
        self._task: asyncio.Task[None] | None = None
        self._client: Any = None

    async def start(self) -> None:
        if httpx is None:
            return
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0)
        if self._task is None:
            self._task = asyncio.create_task(self._flush_loop())

    async def enqueue(self, item: Any) -> None:
        """Accept Trace model instances or raw dicts."""
        async with self._lock:
            if len(self._queue) >= self.max_queue_size:
                if self.drop_policy == "drop_oldest" and self._queue:
                    self._queue.popleft()
                else:
                    return
            # Serialise Trace/ExecutionGraph models if needed
            if hasattr(item, "model_dump"):
                self._queue.append(item.model_dump(mode="json"))
            elif isinstance(item, dict):
                self._queue.append(item)
            else:
                logger.warning("AsyncHTTPTransport: dropping unknown item type %s", type(item))

    # Keep legacy send_event alias used by recorder
    async def send_event(self, event: dict[str, Any]) -> None:
        await self.enqueue(event)

    async def _flush_loop(self) -> None:
        while not self._stop.is_set():
            await asyncio.sleep(self.flush_interval)
            await self.flush()

    async def flush(self) -> None:
        batch: list[dict[str, Any]] = []
        async with self._lock:
            while self._queue and len(batch) < self.batch_size:
                batch.append(self._queue.popleft())

        if not batch:
            return

        payload = {"events": batch}
        for attempt in range(self.max_retries + 1):
            try:
                assert self._client is not None
                response = await self._client.post(
                    f"{self.server_url}/v1/ingest", headers=self.headers, json=payload
                )
                response.raise_for_status()
                return
            except Exception:
                if attempt >= self.max_retries:
                    logger.warning("Dropping %d events after max retries", len(batch))
                    return
                await asyncio.sleep(self.base_backoff * (2**attempt))

    async def shutdown(self) -> None:
        self._stop.set()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self.flush()
        if self._client is not None:
            await self._client.aclose()
