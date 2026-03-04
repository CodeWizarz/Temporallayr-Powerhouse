"""Queue-based batching transport using asyncio."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from temporallayr.sdk.transport import HTTPTransport

logger = logging.getLogger(__name__)


class BatchingTransport:
    """Queues events and flushes them in batches via an asyncio background task."""

    def __init__(
        self,
        transport: HTTPTransport,
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
        """Start the background flush worker."""
        if self._worker_task is None:
            self._worker_task = asyncio.create_task(self._worker_loop())

    async def enqueue(self, event: Any) -> None:
        """Add an event to the queue asynchronously."""
        # Convert models to dict if needed
        if hasattr(event, "model_dump"):
            item = event.model_dump(mode="json")
        elif isinstance(event, dict):
            item = event
        else:
            logger.warning("BatchingTransport: dropping unknown item type %s", type(event))
            return

        await self._queue.put(item)

    async def _worker_loop(self) -> None:
        """Continuously flush batches based on time or size limits."""
        while not self._stop_event.is_set() or not self._queue.empty():
            batch: list[dict[str, Any]] = []
            try:
                # If we're shutting down, don't sleep the full flush_interval
                timeout = 0.1 if self._stop_event.is_set() else self.flush_interval

                # Wait for the first item
                item = await asyncio.wait_for(self._queue.get(), timeout=timeout)
                batch.append(item)
                self._queue.task_done()

                # Grab remaining items up to batch_size
                while len(batch) < self.batch_size and not self._queue.empty():
                    batch.append(self._queue.get_nowait())
                    self._queue.task_done()

            except TimeoutError:
                # Expected when flush_interval hits and no new items arrived
                pass
            except asyncio.CancelledError:
                break

            if batch:
                await self._flush_batch(batch)

    async def _flush_batch(self, batch: list[dict[str, Any]]) -> None:
        """Send a single batch using the underlying transport."""
        await self.transport.send_batch(batch)

    async def shutdown(self) -> None:
        """Signal the worker to stop, wait for flush, and close transport."""
        self._stop_event.set()
        if self._worker_task is not None:
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        await self.transport.shutdown()
