"""Async ClickHouse batch worker used by ingest side-effects."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from temporallayr.core.store_clickhouse import ClickHouseAnalyticsStore
    from temporallayr.models.execution import ExecutionGraph

logger = logging.getLogger(__name__)


class ClickHouseAsyncWorker:
    """In-process async worker that flushes graphs to ClickHouse in batches."""

    def __init__(
        self,
        store: ClickHouseAnalyticsStore,
        *,
        batch_size: int = 100,
        flush_interval: float = 1.0,
        max_queue_size: int = 5000,
    ) -> None:
        self._store = store
        self._batch_size = max(1, batch_size)
        self._flush_interval = max(0.1, flush_interval)
        self._queue: asyncio.Queue[ExecutionGraph] = asyncio.Queue(maxsize=max_queue_size)
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task[None] | None = None

        self._enqueued = 0
        self._dropped = 0
        self._flushed_batches = 0
        self._flushed_graphs = 0
        self._failed_batches = 0
        self._last_flush_at: str | None = None
        self._last_error: str | None = None

    @property
    def store(self) -> ClickHouseAnalyticsStore:
        return self._store

    async def start(self) -> None:
        if self._task is None:
            self._stop_event.clear()
            self._task = asyncio.create_task(
                self._run_loop(), name="temporallayr-clickhouse-worker"
            )

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task is not None:
            await self._task
            self._task = None

    async def enqueue(self, graph: ExecutionGraph) -> bool:
        try:
            self._queue.put_nowait(graph)
        except asyncio.QueueFull:
            self._dropped += 1
            logger.warning(
                "ClickHouse worker queue full; dropping trace", extra={"trace_id": graph.trace_id}
            )
            return False

        self._enqueued += 1
        return True

    def health(self) -> dict[str, Any]:
        return {
            "running": self._task is not None and not self._task.done(),
            "batch_size": self._batch_size,
            "flush_interval": self._flush_interval,
            "queue_depth": self._queue.qsize(),
            "enqueued": self._enqueued,
            "dropped": self._dropped,
            "flushed_batches": self._flushed_batches,
            "flushed_graphs": self._flushed_graphs,
            "failed_batches": self._failed_batches,
            "last_flush_at": self._last_flush_at,
            "last_error": self._last_error,
        }

    async def _run_loop(self) -> None:
        while not self._stop_event.is_set() or not self._queue.empty():
            batch: list[ExecutionGraph] = []
            try:
                timeout = 0.1 if self._stop_event.is_set() else self._flush_interval
                first = await asyncio.wait_for(self._queue.get(), timeout=timeout)
                batch.append(first)
                self._queue.task_done()

                while len(batch) < self._batch_size and not self._queue.empty():
                    batch.append(self._queue.get_nowait())
                    self._queue.task_done()
            except TimeoutError:
                pass

            if batch:
                await self._flush_batch(batch)

    async def _flush_batch(self, batch: list[ExecutionGraph]) -> None:
        try:
            await asyncio.to_thread(self._store.insert_traces_batch, batch)
            self._flushed_batches += 1
            self._flushed_graphs += len(batch)
            self._last_flush_at = datetime.now(UTC).isoformat()
            self._last_error = None
        except Exception as exc:  # noqa: BLE001
            self._failed_batches += 1
            self._last_error = str(exc)
            logger.warning(
                "ClickHouse async flush failed",
                extra={"batch_size": len(batch), "error": str(exc)},
            )


_worker: ClickHouseAsyncWorker | None = None


def configure_clickhouse_worker(
    store: ClickHouseAnalyticsStore,
    *,
    batch_size: int | None = None,
    flush_interval: float | None = None,
    max_queue_size: int | None = None,
) -> ClickHouseAsyncWorker:
    global _worker
    resolved_batch_size = batch_size or int(
        os.getenv("TEMPORALLAYR_CLICKHOUSE_WORKER_BATCH_SIZE", "100")
    )
    resolved_flush_interval = flush_interval or float(
        os.getenv("TEMPORALLAYR_CLICKHOUSE_WORKER_FLUSH_INTERVAL", "1.0")
    )
    resolved_max_queue_size = max_queue_size or int(
        os.getenv("TEMPORALLAYR_CLICKHOUSE_WORKER_MAX_QUEUE_SIZE", "5000")
    )

    if _worker is None or _worker.store is not store:
        _worker = ClickHouseAsyncWorker(
            store,
            batch_size=resolved_batch_size,
            flush_interval=resolved_flush_interval,
            max_queue_size=resolved_max_queue_size,
        )

    return _worker


def get_clickhouse_worker() -> ClickHouseAsyncWorker | None:
    return _worker


async def shutdown_clickhouse_worker() -> None:
    global _worker
    if _worker is not None:
        await _worker.stop()
        _worker = None
