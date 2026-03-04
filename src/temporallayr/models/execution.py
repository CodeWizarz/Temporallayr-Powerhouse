"""Trace/span data model for TemporalLayr."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import Field, model_validator
from temporallayr.models.base import TemporalLayrBaseModel

SpanStatus = Literal["success", "error"]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Span(TemporalLayrBaseModel):
    span_id: str = Field(default_factory=lambda: str(uuid4()))
    parent_span_id: str | None = None
    name: str
    start_time: datetime = Field(default_factory=utc_now)
    end_time: datetime | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    input_payload: Any | None = None
    output_payload: Any | None = None
    error: str | None = None
    status: SpanStatus = "success"

    @model_validator(mode="before")
    @classmethod
    def _remap_legacy_fields(cls, data: Any) -> Any:
        """Accept old field names used by recorder/decorators."""
        if isinstance(data, dict):
            d = dict(data)
            if "id" in d and "span_id" not in d:
                d["span_id"] = d.pop("id")
            if "parent_id" in d and "parent_span_id" not in d:
                d["parent_span_id"] = d.pop("parent_id")
            if "metadata" in d and "attributes" not in d:
                d["attributes"] = d.pop("metadata")
            if "created_at" in d and "start_time" not in d:
                d["start_time"] = d.pop("created_at")
            return d
        return data

    @property
    def id(self) -> str:
        return self.span_id

    @property
    def parent_id(self) -> str | None:
        return self.parent_span_id

    @property
    def metadata(self) -> dict[str, Any]:
        return self.attributes

    @property
    def created_at(self) -> datetime:
        return self.start_time


class Trace(TemporalLayrBaseModel):
    trace_id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    start_time: datetime = Field(default_factory=utc_now)
    end_time: datetime | None = None
    spans: list[Span] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _remap_legacy_fields(cls, data: Any) -> Any:
        """Accept old field names and node-dict format."""
        if isinstance(data, dict):
            d = dict(data)
            if "id" in d and "trace_id" not in d:
                d["trace_id"] = d.pop("id")
            if "created_at" in d and "start_time" not in d:
                d["start_time"] = d.pop("created_at")
            # Convert serialised nodes-dict back to spans list
            if "nodes" in d and "spans" not in d:
                nodes = d.pop("nodes")
                if isinstance(nodes, dict):
                    d["spans"] = list(nodes.values())
                elif isinstance(nodes, list):
                    d["spans"] = nodes
            return d
        return data

    @property
    def id(self) -> str:
        return self.trace_id

    @property
    def created_at(self) -> datetime:
        return self.start_time

    @property
    def nodes(self) -> dict[str, Span]:
        """Live dict view of spans keyed by span_id."""
        return {s.span_id: s for s in self.spans}

    def add_span(self, span: Span) -> None:
        self.spans.append(span)

    def add_node(self, node: Span) -> None:
        """Backward-compatible alias for add_span."""
        self.spans.append(node)

    def update_node(self, node_id: str, node: Span) -> None:
        """Replace an existing span in-place by its ID."""
        for i, s in enumerate(self.spans):
            if s.span_id == node_id:
                self.spans[i] = node
                return
        self.spans.append(node)


# Backward-compatible aliases
ExecutionNode = Span
ExecutionSpan = Span  # used by integrations (langchain, openai_wrapper, etc.)
ExecutionGraph = Trace
