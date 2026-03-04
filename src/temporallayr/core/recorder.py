"""
Execution recorder — builds and persists temporal execution graphs.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from contextvars import ContextVar
from typing import Any

from temporallayr.context import get_context
from temporallayr.core.store import get_default_store
from temporallayr.exceptions import TemporalLayrError
from temporallayr.models.execution import ExecutionGraph, ExecutionNode

logger = logging.getLogger(__name__)


class RecorderStateError(TemporalLayrError):
    pass


_current_graph: ContextVar[ExecutionGraph | None] = ContextVar("_current_graph", default=None)
_current_parent_id: ContextVar[str | None] = ContextVar("_current_parent_id", default=None)


class ExecutionRecorder:
    """
    Async context manager for capturing execution graphs.
    Thread-safe via ContextVar isolation.
    """

    _diagnostics_printed = False

    def __init__(self, run_id: str | None = None) -> None:
        self.run_id = run_id or str(uuid.uuid4())

        from temporallayr.config import get_tenant_id

        tenant_id = get_context().tenant_id or get_tenant_id()
        if not tenant_id:
            raise ValueError(
                "tenant_id must be provided via context or TEMPORALLAYR_TENANT_ID env var."
            )
        self.tenant_id = tenant_id

        if not ExecutionRecorder._diagnostics_printed:
            from temporallayr.config import get_api_key, get_server_url

            logger.info(
                "TemporalLayr recorder initialised",
                extra={
                    "server_url": get_server_url(),
                    "api_key_present": bool(get_api_key()),
                    "tenant_id": tenant_id,
                },
            )
            ExecutionRecorder._diagnostics_printed = True

        from temporallayr.transport import get_transport

        get_transport()

        self._graph = ExecutionGraph(trace_id=self.run_id, tenant_id=tenant_id)

    def _create_node(self, name: str, metadata: dict[str, Any] | None = None) -> ExecutionNode:
        current_graph = _current_graph.get()
        if current_graph is None:
            raise RecorderStateError(
                "Cannot record node outside an active recorder context. Use `async with recorder:`."
            )
        parent_id = _current_parent_id.get()
        node = ExecutionNode(
            span_id=str(uuid.uuid4()),
            name=name,
            attributes=metadata or {},
            parent_span_id=parent_id,
        )
        current_graph.add_node(node)
        return node

    @asynccontextmanager
    async def step(
        self, name: str, metadata: dict[str, Any] | None = None
    ) -> AsyncGenerator[ExecutionNode, None]:
        node = self._create_node(name, metadata)
        token = _current_parent_id.set(node.id)
        try:
            yield node
        finally:
            _current_parent_id.reset(token)

    async def record_model_call(
        self, name: str, metadata: dict[str, Any] | None = None
    ) -> ExecutionNode:
        return self._create_node(f"model_call:{name}", metadata)

    async def record_tool_call(
        self, name: str, metadata: dict[str, Any] | None = None
    ) -> ExecutionNode:
        return self._create_node(f"tool_call:{name}", metadata)

    @property
    def graph(self) -> ExecutionGraph:
        return self._graph

    async def __aenter__(self) -> ExecutionRecorder:
        if _current_graph.get() is not None:
            raise RecorderStateError("Cannot nest ExecutionRecorder contexts.")
        self._graph_token = _current_graph.set(self._graph)
        self._parent_token = _current_parent_id.set(None)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any | None,
    ) -> None:
        _current_graph.reset(self._graph_token)
        _current_parent_id.reset(self._parent_token)

        # Persist locally (sync SQLite — always safe)
        try:
            get_default_store().save_execution(self._graph)
        except Exception as e:
            logger.warning("Failed to save execution locally", extra={"error": str(e)})

        # Ship to server transport (async, fire-and-forget)
        try:
            from temporallayr.transport import get_transport

            transport = get_transport()
            await transport.send_event(
                {
                    "type": "execution_graph",
                    "tenant_id": self.tenant_id,
                    "graph": self.graph.model_dump(mode="json"),
                }
            )
        except Exception as e:
            logger.warning("Failed to enqueue execution for transport", extra={"error": str(e)})
