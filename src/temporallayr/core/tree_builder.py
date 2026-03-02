"""
Execution tree reconstruction for hierarchical runtime analysis.
"""

from typing import Any

from temporallayr.models.execution import ExecutionNode


class TreeBuilder:
    """
    Reconstructs nested hierarchical structures from flat node linear flows natively.
    """

    @classmethod
    def build_tree(cls, nodes: list[ExecutionNode]) -> list[dict[str, Any]]:
        """
        Organize a flat topological array of ExecutionNodes into nested recursive dictionaries.
        Maintains chronological sorting determinism strictly based on internal temporal bounds.
        """
        # Bootstrap the dictionary mapping retaining native payload shapes.
        node_map = {node.id: {"node": node, "children": []} for node in nodes}

        roots: list[dict[str, Any]] = []

        # Chronological sort guarantees deterministic tree reconstruction
        sorted_nodes = sorted(nodes, key=lambda n: n.created_at)

        for node in sorted_nodes:
            tree_node = node_map[node.id]

            if node.parent_id and node.parent_id in node_map:
                # Append natively into target deterministic parent array bounds
                node_map[node.parent_id]["children"].append(tree_node)
            else:
                # Nodes without recognized parents route back up to absolute bounds
                roots.append(tree_node)

        return roots
