"""
Execution diff engine for deep structural comparison of execution graphs.
"""

from typing import Any

from temporallayr.models.execution import ExecutionGraph, ExecutionNode


class ExecutionDiffer:
    """
    Analyzes structural and value divergences between two execution graphs.
    """

    @classmethod
    def _get_logical_path(cls, graph: ExecutionGraph, node: ExecutionNode) -> str:
        """
        Builds a deterministic logical progression path mapping root calls down to leaf.
        """
        path_nodes = []
        current: ExecutionNode | None = node
        while current:
            path_nodes.append(current.name)
            current = graph.nodes.get(current.parent_id) if current.parent_id else None
        return ".".join(reversed(path_nodes))

    @classmethod
    def diff(cls, exec_a: ExecutionGraph, exec_b: ExecutionGraph) -> dict[str, list[Any]]:
        """
        Compare nodes by logical path and detect structural/value changes.
        """
        paths_a = {cls._get_logical_path(exec_a, n): n for n in exec_a.nodes.values()}
        paths_b = {cls._get_logical_path(exec_b, n): n for n in exec_b.nodes.values()}

        added_nodes = []
        removed_nodes = []
        changed_nodes = []
        output_changes = []

        # Find removed or changed nodes
        for path in sorted(paths_a.keys()):
            if path not in paths_b:
                removed_nodes.append(path)
                continue

            node_a = paths_a[path]
            node_b = paths_b[path]

            # Structural keys extraction
            a_inputs = node_a.metadata.get("inputs", {})
            b_inputs = node_b.metadata.get("inputs", {})

            a_input_keys = sorted(list(a_inputs.keys())) if isinstance(a_inputs, dict) else []
            b_input_keys = sorted(list(b_inputs.keys())) if isinstance(b_inputs, dict) else []

            # Value and Type extraction
            a_out = node_a.metadata.get("output", node_a.metadata.get("error"))
            b_out = node_b.metadata.get("output", node_b.metadata.get("error"))

            a_out_type = type(a_out).__name__ if a_out is not None else "NoneType"
            b_out_type = type(b_out).__name__ if b_out is not None else "NoneType"

            is_changed = False
            change_details: dict[str, Any] = {"logical_path": path, "changes": []}

            if a_input_keys != b_input_keys:
                is_changed = True
                change_details["changes"].append(
                    {
                        "type": "input_keys",
                        "old": a_input_keys,
                        "new": b_input_keys,
                    }
                )

            if a_out_type != b_out_type:
                is_changed = True
                change_details["changes"].append(
                    {
                        "type": "output_type",
                        "old": a_out_type,
                        "new": b_out_type,
                    }
                )

            if a_out != b_out:
                is_changed = True
                change_details["changes"].append(
                    {
                        "type": "output_value",
                        "old": a_out,
                        "new": b_out,
                    }
                )
                # Tracking discrete output mutations matching prompt payload mapping
                output_changes.append(
                    {
                        "logical_path": path,
                        "old_value": a_out,
                        "new_value": b_out,
                    }
                )

            if is_changed:
                changed_nodes.append(change_details)

        # Find added nodes natively checking sorted target graph layout
        for path in sorted(paths_b.keys()):
            if path not in paths_a:
                added_nodes.append(path)

        return {
            "changed_nodes": changed_nodes,
            "added_nodes": added_nodes,
            "removed_nodes": removed_nodes,
            "output_changes": output_changes,
        }
