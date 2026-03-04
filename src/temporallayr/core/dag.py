"""Execution DAG nodes and edges."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ExecutionNode(BaseModel):
    """A node inside a trace DAG."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(description="Unique identifier for the node")
    trace_id: str = Field(description="The trace this node belongs to")
    parent_id: str | None = Field(default=None, description="Optional parent node ID")
    type: str = Field(description="The functional type of the node (e.g., llm, tool)")
    name: str = Field(description="Display name for the node")
    latency: float | None = Field(default=None, description="Execution time in ms")
    tokens: int | None = Field(default=None, description="Total tokens used if applicable")
    cost: float | None = Field(default=None, description="Calculated USD cost if applicable")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Custom properties")


class ExecutionEdge(BaseModel):
    """An edge defining relationship between two nodes."""

    model_config = ConfigDict(extra="forbid")

    trace_id: str = Field(description="The trace this edge belongs to")
    source_id: str = Field(description="The ID of the parent/upstream node")
    target_id: str = Field(description="The ID of the child/downstream node")
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Custom routing/transport data"
    )
