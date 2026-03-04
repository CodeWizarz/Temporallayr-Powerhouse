"""
Redis-based Ingest Worker.
Consumes ExecutionGraph payloads from 'temporallayr:ingest_queue',
batches them up to QUEUE_BATCH_SIZE (or QUEUE_FLUSH_INTERVAL),
and inserts them into ClickHouse efficiently.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
import time

from temporallayr.core.failure_cluster import FailureClusterEngine
from temporallayr.core.incidents import IncidentEngine
from temporallayr.core.queue import get_redis_client
from temporallayr.core.store_clickhouse import get_clickhouse_store
from temporallayr.core.webhooks import dispatch_incident_async
from temporallayr.models.execution import ExecutionGraph
from temporallayr.server.app import _INCIDENTS  # type: ignore

# Configure logging
logging.basicConfig(
    level=os.getenv("TEMPORALLAYR_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] [QUEUE] %(message)s",
)
logger = logging.getLogger(__name__)

# Configs
QUEUE_NAME = "temporallayr:ingest_queue"
DLQ_NAME = "temporallayr:dead_letter_queue"
BATCH_SIZE = int(os.getenv("TEMPORALLAYR_QUEUE_BATCH_SIZE", "50"))
FLUSH_INTERVAL = float(os.getenv("TEMPORALLAYR_QUEUE_FLUSH_INTERVAL", "2.0"))


async def _handle_incidents(graphs: list[ExecutionGraph]) -> None:
    """Run failure clustering and incident generation on the batch."""
    try:
        clusters = FailureClusterEngine.cluster_failures(graphs)
        if clusters:
            # We must sync with global incidents if we want local worker memory,
            # but ideally incidents are in DB. For simplicity, we just use the engine.
            # In a distributed system, you'd pull incidents from the DB here.
            global _INCIDENTS
            old_incidents = len(_INCIDENTS)
            _INCIDENTS = IncidentEngine.detect_incidents(clusters, _INCIDENTS)

            new_incidents = _INCIDENTS[old_incidents:] if len(_INCIDENTS) > old_incidents else []
            for inc in new_incidents:
                asyncio.create_task(dispatch_incident_async(inc, "incident.created"))
    except Exception as e:
        logger.warning(f"Incident detection error: {e}")


async def _process_batch(batch: list[str]) -> list[str]:
    """Process a batch and return the failed string payloads to DLQ."""
    if not batch:
        return []

    graphs = []
    failed_payloads = []

    for payload in batch:
        try:
            graphs.append(ExecutionGraph.model_validate_json(payload))
        except Exception as e:
            logger.error(f"Failed to decode graph from queue: {e}")
            failed_payloads.append(payload)

    if not graphs:
        return failed_payloads

    ch = get_clickhouse_store()
    if ch:
        try:
            # ClickHouse batch insert is more efficient, but insert_trace currently takes one.
            # In a real system, you'd batch inject. We'll iterate for now since the SDK uses an array.
            logger.info(f"Writing {len(graphs)} graphs to ClickHouse")
            for g in graphs:
                await asyncio.to_thread(ch.insert_trace, g)
        except Exception as e:
            logger.error(f"ClickHouse insert failed for batch: {e}")
            # If CH fails, we consider the whole batch failed to process
            return batch

    # Async side-effects (incidents)
    await _handle_incidents(graphs)
    return failed_payloads


async def worker_loop() -> None:
    redis = get_redis_client()
    if not redis:
        logger.error("No TEMPORALLAYR_REDIS_URL configured. Exiting worker.")
        sys.exit(1)

    logger.info(
        f"Ingest Worker Started. Listening on {QUEUE_NAME} "
        f"(Batch: {BATCH_SIZE}, Flush: {FLUSH_INTERVAL}s)"
    )

    batch: list[str] = []
    last_flush = time.time()

    # Graceful shutdown flag
    shutdown_event = asyncio.Event()

    def signal_handler() -> None:
        logger.info("Shutdown signal received")
        shutdown_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        asyncio.get_event_loop().add_signal_handler(sig, signal_handler)

    try:
        while not shutdown_event.is_set():
            time_since_flush = time.time() - last_flush
            timeout = max(0, FLUSH_INTERVAL - time_since_flush)

            # BLPOP blocks until item available or timeout hits
            try:
                # Returns (queue_name, data) or None on timeout
                result = await redis.blpop([QUEUE_NAME], timeout=timeout)
            except Exception as e:
                logger.error(f"Redis connection error: {e}")
                await asyncio.sleep(1)
                continue

            if result:
                _, payload = result
                batch.append(payload)

            time_since_flush = time.time() - last_flush

            # Flush if batch size reached OR time threshold reached with items
            if len(batch) >= BATCH_SIZE or (batch and time_since_flush >= FLUSH_INTERVAL):
                failed = await _process_batch(batch)

                # Push irrecoverable/dead items to DLQ
                if failed:
                    try:
                        logger.warning(f"Sending {len(failed)} items to dead letter queue")
                        await redis.rpush(DLQ_NAME, *failed)
                    except Exception as e:
                        logger.error(f"Failed to write to DLQ: {e}")

                batch.clear()
                last_flush = time.time()

    finally:
        # Flush remaining on shutdown
        if batch:
            logger.info(f"Flushing {len(batch)} remaining items before shutdown")
            await _process_batch(batch)
        await redis.aclose()


if __name__ == "__main__":
    try:
        asyncio.run(worker_loop())
    except KeyboardInterrupt:
        pass
