"""
Execution recorder for building and tracking temporal execution graphs.
"""

import logging
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from contextvars import ContextVar
from typing import Any

logger = logging.getLogger(__name__)

from temporallayr.context import get_context
from temporallayr.core.store import get_default_store
from temporallayr.exceptions import TemporalLayrError
from temporallayr.models.execution import ExecutionGraph, ExecutionNode


class RecorderStateError(TemporalLayrError):
    """Exception raised for invalid recorder states or context usage."""

    pass


_current_graph: ContextVar[ExecutionGraph | None] = ContextVar("_current_graph", default=None)
_current_parent_id: ContextVar[str | None] = ContextVar("_current_parent_id", default=None)


class ExecutionRecorder:
    """
    Thread-safe, async-compatible context recorder for tracking execution
    steps, model calls, and tool calls into an ExecutionGraph.
    """

    _diagnostics_printed = False

    def __init__(self, run_id: str | None = None) -> None:
        self.run_id = run_id or str(uuid.uuid4())

        from temporallayr.config import get_tenant_id

        tenant_id = get_context().tenant_id or get_tenant_id()
        if not tenant_id:
            raise ValueError(
                "tenant_id must be provided via context or "
                "TEMPORALLAYR_TENANT_ID environment variable."
            )
        self.tenant_id = tenant_id

        if not ExecutionRecorder._diagnostics_printed:
            from temporallayr.config import get_api_key, get_server_url

            logger.info("TEMPORALLAYR CONFIG START")
            logger.info(f"SERVER_URL={get_server_url()}")
            logger.info(f"API_KEY={'present' if get_api_key() else 'missing'}")
            logger.info(f"TENANT_ID={tenant_id or 'missing'}")
            logger.info("TEMPORALLAYR CONFIG END")
            ExecutionRecorder._diagnostics_printed = True

        from temporallayr.transport import get_transport

        get_transport()

        # trace_id is the canonical field; 'id' is remapped via model_validator
        self._graph = ExecutionGraph(id=self.run_id, tenant_id=tenant_id)

    def _create_node(self, name: str, metadata: dict[str, Any] | None = None) -> ExecutionNode:
        """Helper to create and add a node safely."""
        current_graph = _current_graph.get()
        if current_graph is None:
            raise RecorderStateError(
                "Cannot record node outside of an active recorder context. "
                "Use `async with recorder:`."
            )

        parent_id = _current_parent_id.get()

        # 'id', 'metadata', 'parent_id' are remapped by Span's model_validator
        node = ExecutionNode(
            id=str(uuid.uuid4()),
            name=name,
            metadata=metadata or {},
            parent_id=parent_id,
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

    async def __aenter__(self) -> "ExecutionRecorder":
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

        get_default_store().save_execution(self._graph)

        from temporallayr.transport import get_transport

        transport = get_transport()

        await transport.send_event(self.graph.model_dump(mode="json"))
