"""
core/dag.py — backward-compatibility shim.

Provides ExecutionNode (alias of Span) and ExecutionEdge (lightweight edge model)
for any code that imported from this module before it was refactored.
"""

from __future__ import annotations

from typing import Any

from pydantic import Field

from temporallayr.models.base import TemporalLayrBaseModel
from temporallayr.models.execution import Span

# ExecutionNode is just a Span alias
ExecutionNode = Span


class ExecutionEdge(TemporalLayrBaseModel):
    """An edge in the execution DAG linking a source to a target span."""

    trace_id: str
    source_id: str
    target_id: str
    metadata: dict[str, Any] = Field(default_factory=dict)


__all__ = ["ExecutionNode", "ExecutionEdge"]
