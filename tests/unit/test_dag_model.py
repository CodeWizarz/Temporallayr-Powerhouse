"""Unit tests for ExecutionNode (alias of Span) and ExecutionEdge models."""

import pytest

from temporallayr.core.dag import ExecutionEdge, ExecutionNode


def test_execution_node_required_fields():
    node = ExecutionNode(span_id="n1", name="call-gpt", attributes={"type": "llm"})
    assert node.span_id == "n1"
    assert node.parent_span_id is None
    assert node.attributes.get("latency") is None
    assert node.attributes == {"type": "llm"}


def test_execution_node_full():
    node = ExecutionNode(
        span_id="n2",
        parent_span_id="n1",
        name="search",
        attributes={
            "type": "tool",
            "latency": 42.5,
            "tokens": 100,
            "cost": 0.001,
            "source": "web",
        },
    )
    assert node.attributes["tokens"] == 100
    assert node.attributes["cost"] == pytest.approx(0.001)


def test_execution_node_extra_fields_allowed():
    # Span allows extra fields stored in attributes dict — no ValidationError expected
    node = ExecutionNode(span_id="n3", name="x", attributes={"note": "ok"})
    assert node.span_id == "n3"


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
