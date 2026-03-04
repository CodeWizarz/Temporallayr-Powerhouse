"""Unit tests for ExecutionNode and ExecutionEdge models."""

import pytest
from pydantic import ValidationError

from temporallayr.core.dag import ExecutionEdge, ExecutionNode


def test_execution_node_required_fields():
    node = ExecutionNode(id="n1", trace_id="t1", type="llm", name="call-gpt")
    assert node.id == "n1"
    assert node.parent_id is None
    assert node.latency is None
    assert node.metadata == {}


def test_execution_node_full():
    node = ExecutionNode(
        id="n2",
        trace_id="t1",
        parent_id="n1",
        type="tool",
        name="search",
        latency=42.5,
        tokens=100,
        cost=0.001,
        metadata={"source": "web"},
    )
    assert node.tokens == 100
    assert node.cost == pytest.approx(0.001)


def test_execution_node_rejects_extra_fields():
    with pytest.raises(ValidationError):
        ExecutionNode(  # type: ignore[call-arg]
            id="n3", trace_id="t1", type="llm", name="x", unknown_field="y"
        )


def test_execution_edge_basic():
    edge = ExecutionEdge(trace_id="t1", source_id="n1", target_id="n2")
    assert edge.trace_id == "t1"
    assert edge.metadata == {}


def test_execution_edge_with_metadata():
    edge = ExecutionEdge(
        trace_id="t1",
        source_id="n1",
        target_id="n2",
        metadata={"weight": 1},
    )
    assert edge.metadata["weight"] == 1
