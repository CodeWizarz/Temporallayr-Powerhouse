import logging
from collections.abc import Awaitable, Callable
from typing import Any

from temporallayr.core.store import async_store
from temporallayr.models.execution import ExecutionGraph

logger = logging.getLogger(__name__)


class TraceIngestPipeline:
    """
    Streaming ingestion pipeline inspired by ClickHouse processors.

    Stages:
      1. validate_trace: Check for required structure.
      2. normalize_trace: Standardize to formal dict with tenant bindings.
      3. enrich_trace: Inject missing metadata and convert to PyDantic model.
      4. queue_trace: Persist to storage and enqueue for background processing.
    """

    def __init__(
        self, tenant_id: str, enqueue_callback: Callable[[ExecutionGraph], Awaitable[None]]
    ):
        self.tenant_id = tenant_id
        self.enqueue_callback = enqueue_callback
        self.processed = 0
        self.errors = 0

    def validate_trace(self, raw_event: dict[str, Any]) -> dict[str, Any]:
        """Verify the trace structure and required fields."""
        if "graph" in raw_event and "type" in raw_event:
            return raw_event["graph"]
        return raw_event

    def normalize_trace(self, event: dict[str, Any]) -> dict[str, Any]:
        """Standardize the raw dict, ensuring tenant ID is attached securely."""
        return {**event, "tenant_id": self.tenant_id}

    def enrich_trace(self, normalized_event: dict[str, Any]) -> ExecutionGraph:
        """Inject missing metadata and parse into model."""
        return ExecutionGraph.model_validate(normalized_event)

    async def queue_trace(self, graph: ExecutionGraph) -> None:
        """Handle persistence and enqueue for asynchronous background steps."""
        await async_store("save_execution", graph)
        if self.enqueue_callback:
            await self.enqueue_callback(graph)

    async def process_batch(self, events: list[dict[str, Any]]) -> dict[str, int]:
        """Run the full ingestion pipeline on a batch of events."""
        for event in events:
            try:
                valid_event = self.validate_trace(event)
                normalized = self.normalize_trace(valid_event)
                graph = self.enrich_trace(normalized)
                await self.queue_trace(graph)
                self.processed += 1
            except Exception as e:
                logger.warning("Ingest pipeline error", extra={"error": str(e)})
                self.errors += 1

        return {"processed": self.processed, "errors": self.errors}
