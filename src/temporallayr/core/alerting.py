"""
Execution alerting engine for detecting regressions.
"""

from typing import Any

from temporallayr.models.execution import ExecutionGraph


class AlertEngine:
    """
    Engine for generating alerts based on execution divergences.
    """

    @classmethod
    def check_execution(
        cls, new_execution: ExecutionGraph, previous_execution: ExecutionGraph
    ) -> list[dict[str, Any]]:
        """
        Compare two executions.
        Return list of alerts if divergence detected.
        """
        alerts: list[dict[str, Any]] = []

        # Check nodes in previous execution
        for prev_node in previous_execution.nodes.values():
            if prev_node.id not in new_execution.nodes:
                alerts.append(
                    {
                        "type": "NODE_MISSING",
                        "node_id": prev_node.id,
                        "old": prev_node.metadata.get("output", prev_node.metadata.get("error")),
                        "new": None,
                    }
                )
            else:
                new_node = new_execution.nodes[prev_node.id]
                old_out = prev_node.metadata.get("output", prev_node.metadata.get("error"))
                new_out = new_node.metadata.get("output", new_node.metadata.get("error"))

                if old_out != new_out:
                    alerts.append(
                        {
                            "type": "OUTPUT_CHANGED",
                            "node_id": prev_node.id,
                            "old": old_out,
                            "new": new_out,
                        }
                    )

        # Check for new nodes added in the new execution
        for new_node in new_execution.nodes.values():
            if new_node.id not in previous_execution.nodes:
                alerts.append(
                    {
                        "type": "NODE_ADDED",
                        "node_id": new_node.id,
                        "old": None,
                        "new": new_node.metadata.get("output", new_node.metadata.get("error")),
                    }
                )

        return alerts
