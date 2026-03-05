"""
Execution replay engine for deterministic graph verification.
"""

import importlib
import inspect

from temporallayr.models.execution import ExecutionGraph, ExecutionNode
from temporallayr.models.replay import DivergenceType, NodeReplayResult, ReplayReport


class DivergenceComparator:
    """Isolates logic for comparing two execution nodes for divergence."""

    @staticmethod
    def compare(
        original: ExecutionNode,
        replayed: ExecutionNode,
    ) -> NodeReplayResult:
        orig_out = original.attributes.get("output")
        orig_err = original.attributes.get("error")

        rep_out = replayed.attributes.get("output")
        rep_err = replayed.attributes.get("error")

        if orig_err != rep_err:
            return NodeReplayResult(
                node_id=original.id,
                success=False,
                actual_error=rep_err,
                divergence_type=DivergenceType.ERROR_MISMATCH,
                divergence_details=f"Expected error '{orig_err}', got '{rep_err}'",
            )

        if str(orig_out) != str(rep_out):
            return NodeReplayResult(
                node_id=original.id,
                success=False,
                actual_output=str(rep_out),
                divergence_type=DivergenceType.OUTPUT_MISMATCH,
                divergence_details=f"Expected output '{orig_out}', got '{rep_out}'",
            )

        return NodeReplayResult(
            node_id=original.id,
            success=True,
            actual_output=rep_out,
        )


class ReplayReporter:
    """Manages accumulation and formatting of replay divergences."""

    def __init__(self, graph_id: str, total_expected: int) -> None:
        self.graph_id = graph_id
        self.total_expected = total_expected
        self.results: list[NodeReplayResult] = []

    def add_result(self, result: NodeReplayResult) -> None:
        self.results.append(result)

    def generate_report(self) -> ReplayReport:
        divergences = sum(1 for r in self.results if not r.success)
        return ReplayReport(
            graph_id=self.graph_id,
            total_nodes=self.total_expected,
            nodes_replayed=len(self.results),
            divergences_found=divergences,
            results=self.results,
            is_deterministic=(divergences == 0 and len(self.results) == self.total_expected),
        )


class ReplayEngine:
    """
    Deterministic execution runner. Accepts an existing execution graph and
    triggers re-computation of its nodes in chronological order.
    """

    def __init__(self, original_graph: ExecutionGraph) -> None:
        self.original_graph = original_graph
        self.comparator = DivergenceComparator()
        self.reporter = ReplayReporter(
            graph_id=original_graph.id, total_expected=len(original_graph.spans)
        )

    async def execute_node(self, node: ExecutionNode) -> ExecutionNode:
        """
        Dynamically imports the recorded function and executes it with
        the originally recorded inputs to test for deterministic output.
        """
        code_meta = node.attributes.get("code")
        if not code_meta or "module" not in code_meta or "name" not in code_meta:
            new_attrs = dict(node.attributes)
            new_attrs["error"] = "Missing function 'code' metadata for dynamic replay."
            return node.model_copy(update={"attributes": new_attrs})

        mod_name = code_meta["module"]
        func_name = code_meta["name"]

        try:
            module = importlib.import_module(mod_name)
            func = getattr(module, func_name)

            inputs = node.attributes.get("inputs", {})

            if inspect.iscoroutinefunction(func):
                result = await func(**inputs)
            else:
                result = func(**inputs)

            new_attrs = dict(node.attributes)
            new_attrs["output"] = result
            return node.model_copy(update={"attributes": new_attrs})

        except Exception as e:
            new_attrs = dict(node.attributes)
            new_attrs["error"] = str(e)
            return node.model_copy(update={"attributes": new_attrs})

    async def replay(self) -> ReplayReport:
        sorted_nodes = sorted(self.original_graph.spans, key=lambda n: n.start_time)

        for orig_node in sorted_nodes:
            replayed_node = await self.execute_node(orig_node)
            result = self.comparator.compare(orig_node, replayed_node)
            self.reporter.add_result(result)

        return self.reporter.generate_report()
