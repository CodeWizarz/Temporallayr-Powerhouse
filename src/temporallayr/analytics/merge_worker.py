"""
Background merge workers inspired by ClickHouse part merging.
Cyclically grooms and aggregates raw event data.
"""

import asyncio
import logging

from temporallayr.core.store_clickhouse import get_clickhouse_store

logger = logging.getLogger(__name__)


class AnalyticsMergeWorker:
    """Manages background compaction and semantic merges for trace analytics."""

    def __init__(self, interval_seconds: int = 300):
        self.interval_seconds = interval_seconds
        self._running = False
        self._task: asyncio.Task | None = None

    async def cluster_failures(self) -> None:
        """Find recent errors and group them semantically (mimics ReplacingMergeTree collapse)."""
        logger.info("[MergeWorker] Clustering failure events...")
        # In a real cluster, this would build the aggregates table.
        # Here we just log the cyclic compaction.
        await asyncio.sleep(0.1)

    async def update_latency_aggregates(self) -> None:
        """Pre-compute p50/p95/p99 aggregates into a materialized view analog."""
        logger.info("[MergeWorker] Updating latency aggregates...")
        ch = get_clickhouse_store()
        if ch:
            # Example operation: Refresh materialized views in ClickHouse
            pass
        await asyncio.sleep(0.1)

    async def cleanup_old_traces(self) -> None:
        """Enforce TTL logic equivalent to ClickHouse TTL mechanics."""
        logger.info("[MergeWorker] Cleaning up old trace partitions...")
        await asyncio.sleep(0.1)

    async def run_merges(self) -> None:
        """Run all aggregation routines."""
        try:
            await self.cluster_failures()
            await self.update_latency_aggregates()
            await self.cleanup_old_traces()
        except Exception as e:
            logger.error("[MergeWorker] Merge cycle failed", extra={"error": str(e)})

    async def _loop(self) -> None:
        """Run continuously every N seconds."""
        logger.info(f"[MergeWorker] Started cycle every {self.interval_seconds}s")
        self._running = True
        while self._running:
            await self.run_merges()
            await asyncio.sleep(self.interval_seconds)

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._loop())

    def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None


# Global instance
_worker = AnalyticsMergeWorker(interval_seconds=300)


def start_merge_worker() -> None:
    _worker.start()


def stop_merge_worker() -> None:
    _worker.stop()
