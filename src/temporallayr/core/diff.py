"""
Execution diff engine to compare two ExecutionGraphs.
"""

from typing import Any

from pydantic import BaseModel

from temporallayr.models.execution import ExecutionGraph


class ExecutionDiff(BaseModel):
    """
    Represents the result of comparing two ExecutionGraphs.
    """

    diverged: bool
    node_id: str | None = None
    old_output: Any | None = None
    new_output: Any | None = None


def compare_executions(exec_a: ExecutionGraph, exec_b: ExecutionGraph) -> ExecutionDiff:
    """
    Compare two execution graphs deterministically, sorting by creation time.
    Detects the first divergence based on missing nodes or output mismatches.

    Args:
        exec_a: The reference/old ExecutionGraph.
        exec_b: The target/new ExecutionGraph to compare against.

    Returns:
        ExecutionDiff detailing the result of the comparison.
    """
    nodes_a = sorted(exec_a.nodes.values(), key=lambda n: n.created_at)

    for node_a in nodes_a:
        a_out = node_a.metadata.get("output", node_a.metadata.get("error"))

        if node_a.id not in exec_b.nodes:
            return ExecutionDiff(
                diverged=True, node_id=node_a.id, old_output=a_out, new_output=None
            )

        node_b = exec_b.nodes[node_a.id]
        b_out = node_b.metadata.get("output", node_b.metadata.get("error"))

        a_inputs = node_a.metadata.get("inputs", {})
        b_inputs = node_b.metadata.get("inputs", {})

        if a_inputs != b_inputs or a_out != b_out:
            return ExecutionDiff(
                diverged=True, node_id=node_a.id, old_output=a_out, new_output=b_out
            )

    if len(exec_b.nodes) > len(exec_a.nodes):
        nodes_b = sorted(exec_b.nodes.values(), key=lambda n: n.created_at)
        for node_b in nodes_b:
            if node_b.id not in exec_a.nodes:
                b_out = node_b.metadata.get("output", node_b.metadata.get("error"))
                return ExecutionDiff(
                    diverged=True, node_id=node_b.id, old_output=None, new_output=b_out
                )

    return ExecutionDiff(diverged=False)
