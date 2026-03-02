"""
Local ingestion transport fallback.
"""

import atexit
import logging
import threading
from collections import deque

from temporallayr.core.store import get_default_store
from temporallayr.models.execution import ExecutionGraph

logger = logging.getLogger(__name__)


class LocalTransport:
    """Non-blocking background batched transport for mapping graphs to local storage."""

    def __init__(
        self,
        flush_interval: float = 2.0,
        batch_size: int = 100,
        max_queue_size: int = 10000,
    ):
        self._flush_interval = flush_interval
        self._batch_size = batch_size
        self._max_queue_size = max_queue_size

        self._queue: deque[ExecutionGraph] = deque()
        self._lock = threading.Lock()

        self._data_ready_event = threading.Event()
        self._stop_event = threading.Event()
        self._worker_thread = threading.Thread(
            target=self._worker_loop, daemon=True, name="TemporallayrLocalWorker"
        )
        self._worker_thread.start()

        atexit.register(self.flush)

    def _worker_loop(self) -> None:
        """Background loop flushing queue natively to local SQLite/JSON stores."""
        while not self._stop_event.is_set():
            self._data_ready_event.wait(self._flush_interval)
            self._data_ready_event.clear()
            self._flush_internal()

    def enqueue(self, graph: ExecutionGraph) -> None:
        """Thread-safe local queue buffer."""
        with self._lock:
            if len(self._queue) >= self._max_queue_size:
                logger.warning(
                    "Temporallayr SDK local event queue full (%d). Dropping execution.",
                    self._max_queue_size,
                )
                return

            self._queue.append(graph)
            queue_len = len(self._queue)

        if queue_len >= self._batch_size:
            self._data_ready_event.set()

    def flush(self) -> None:
        self._flush_internal()

    def _flush_internal(self) -> None:
        with self._lock:
            if not self._queue:
                return

            batch = list(self._queue)
            self._queue.clear()

        store = get_default_store()
        try:
            store.bulk_save_executions(batch)
        except Exception as e:
            logger.warning("Failed storing graphs locally natively: %s", e)
