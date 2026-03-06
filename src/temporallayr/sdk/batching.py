"""Span batching queue taking spans and flushing them."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Protocol

logger = logging.getLogger(__name__)


class TransportProtocol(Protocol):
    async def send_batch(self, batch: list[dict[str, Any]]) -> bool: ...

    async def shutdown(self) -> None: ...


class SpanBatcher:
    """Queues spans and flushes them in batches via background worker."""

    def __init__(
        self,
        transport: TransportProtocol,
        batch_size: int = 50,
        flush_interval: float = 5.0,
    ) -> None:
        self.transport = transport
        self.batch_size = batch_size
        self.flush_interval = flush_interval

        self._queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._stop_event = asyncio.Event()
        self._worker_task: asyncio.Task[None] | None = None

    def start(self) -> None:
        """Start the background worker."""
        if self._worker_task is None:
            print("DEBUG: SpanBatcher starting worker task!")
            self._worker_task = asyncio.create_task(self._worker_loop())

    async def add(self, span: Any) -> None:
        """Add a span to the batching queue."""
        if hasattr(span, "model_dump"):
            item = span.model_dump(mode="json")
        elif isinstance(span, dict):
            item = span
        else:
            logger.warning("SpanBatcher: unknown span type %s", type(span))
            return

        print(f"DEBUG: SpanBatcher added span to queue, size: {self._queue.qsize() + 1}")
        await self._queue.put(item)

    async def enqueue(self, item: Any) -> None:
        """Compatibility alias used by legacy codepaths."""
        await self.add(item)

    async def send_event(self, event: dict[str, Any]) -> None:
        """Compatibility alias used by recorder transport calls."""
        await self.add(event)

    async def _worker_loop(self) -> None:
        """Continuously flush batches based on time or size limits."""
        print("DEBUG: SpanBatcher worker loop started")
        while not self._stop_event.is_set() or not self._queue.empty():
            batch: list[dict[str, Any]] = []
            try:
                timeout = 0.1 if self._stop_event.is_set() else self.flush_interval
                item = await asyncio.wait_for(self._queue.get(), timeout=timeout)
                batch.append(item)
                self._queue.task_done()

                while len(batch) < self.batch_size and not self._queue.empty():
                    batch.append(self._queue.get_nowait())
                    self._queue.task_done()

            except TimeoutError:
                pass
            except asyncio.CancelledError:
                print("DEBUG: SpanBatcher CancelledError")
                break

            if batch:
                print(f"DEBUG: SpanBatcher worker loop flushing batch of {len(batch)}")
                await self.flush(batch)
        print("DEBUG: SpanBatcher worker loop finalized")

    async def flush(self, batch: list[dict[str, Any]] | None = None) -> None:
        """Flush a specific batch, or all remaining items if batch is None."""
        if batch is not None:
            print(f"DEBUG: SpanBatcher calling send_batch with {len(batch)} items")
            await self.transport.send_batch(batch)
        else:
            # Drain current queue entirely
            all_items: list[dict[str, Any]] = []
            while not self._queue.empty():
                all_items.append(self._queue.get_nowait())
                self._queue.task_done()
            if all_items:
                print(f"DEBUG: SpanBatcher flushing all remaining {len(all_items)} items")
                for i in range(0, len(all_items), self.batch_size):
                    await self.transport.send_batch(all_items[i : i + self.batch_size])

    async def shutdown(self) -> None:
        """Stop worker and flush remaining."""
        print("DEBUG: SpanBatcher shutdown called")
        self._stop_event.set()
        if self._worker_task is not None:
            try:
                print("DEBUG: SpanBatcher waiting for worker task to finish")
                await self._worker_task
            except asyncio.CancelledError:
                pass
        print(f"DEBUG: SpanBatcher queuing flush, qsize: {self._queue.qsize()}")
        await self.flush(None)
