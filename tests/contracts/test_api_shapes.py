"""
Contract tests to ensure the API shapes of our core models remain stable.
This is important for the dashboard UI which relies on these structures.
"""

from temporallayr.models.execution import ExecutionGraph, Span
from temporallayr.models.replay import DivergenceType, NodeReplayResult, ReplayReport


def test_execution_graph_shape() -> None:
    """Ensure ExecutionGraph outputs the expected fields."""
    graph = ExecutionGraph(
        tenant_id="test",
        spans=[Span(name="test_span", status="success", attributes={"key": "value"})],
    )

    dumped = graph.model_dump()

    # Assert core fields exist in the dumped dict
    assert "trace_id" in dumped
    assert "tenant_id" in dumped
    assert "start_time" in dumped
    assert "end_time" in dumped
    assert "spans" in dumped

    # Assert span fields
    span_dump = dumped["spans"][0]
    assert "span_id" in span_dump
    assert "parent_span_id" in span_dump
    assert "name" in span_dump
    assert "status" in span_dump
    assert "start_time" in span_dump
    assert "end_time" in span_dump
    assert "attributes" in span_dump

    # Exporters and UI integrations rely on these specific keys being present
    assert span_dump["name"] == "test_span"


def test_replay_report_shape() -> None:
    """Ensure ReplayReport outputs the expected fields."""
    report = ReplayReport(
        graph_id="trace_test",
        total_nodes=1,
        nodes_replayed=1,
        divergences_found=1,
        is_deterministic=False,
        results=[
            NodeReplayResult(
                node_id="span_1",
                success=False,
                actual_output="broken",
                divergence_type=DivergenceType.OUTPUT_MISMATCH,
                divergence_details="Output differed",
            )
        ],
    )

    dumped = report.model_dump()

    # Dashboard UI expects these top-level keys
    assert "graph_id" in dumped
    assert "total_nodes" in dumped
    assert "nodes_replayed" in dumped
    assert "divergences_found" in dumped
    assert "is_deterministic" in dumped
    assert "results" in dumped

    # Dashboard UI relies on the result shapes
    res_dump = dumped["results"][0]
    assert "node_id" in res_dump
    assert "success" in res_dump
    assert "actual_output" in res_dump
    assert "actual_error" in res_dump
    assert "divergence_type" in res_dump
    assert "divergence_details" in res_dump

    # Ensure Enum serializes usefully (or stays an Enum that FastAPI standardizes)
    assert res_dump["divergence_type"] == DivergenceType.OUTPUT_MISMATCH
