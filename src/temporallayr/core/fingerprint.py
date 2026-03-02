"""
Execution fingerprinting logic for deterministic structural hashing.
"""

import hashlib
import json
from typing import Any

from temporallayr.models.execution import ExecutionGraph


class Fingerprinter:
    """
    Constructs a deterministic SHA-256 signature representing an execution's macroscopic topology.
    """

    @classmethod
    def fingerprint_execution(cls, execution: ExecutionGraph) -> dict[str, Any]:
        """
        Produce a deterministic SHA-256 hash abstracting away actual data payloads.

        - ordered node names
        - parent relationships
        - node input keys only (not values)
        - node output type only
        """

        # Traverse nodes chronologically to guarantee deterministic ordering
        sorted_nodes = sorted(execution.nodes.values(), key=lambda n: n.created_at)

        structure_signature: list[dict[str, Any]] = []

        for node in sorted_nodes:
            # 1. Names and parent topologies
            # 2. Input keys (sorted)
            input_dict = node.metadata.get("inputs", {})
            input_keys = sorted(list(input_dict.keys())) if isinstance(input_dict, dict) else []

            # 3. Output type classification
            output_val = node.metadata.get("output", node.metadata.get("error"))
            output_type = type(output_val).__name__ if output_val is not None else "NoneType"

            node_signature = {
                "name": node.name,
                "parent_id_exists": node.parent_id is not None,
                "input_keys": input_keys,
                "output_type": output_type,
            }

            structure_signature.append(node_signature)

        # Build consistent JSON map to feed to hashlib
        # We enforce ascending key sorts so `{A: 1, B: 2}` and `{B: 2, A: 1}` digest identically
        signature_json = json.dumps(structure_signature, sort_keys=True)
        fingerprint = hashlib.sha256(signature_json.encode("utf-8")).hexdigest()

        return {
            "fingerprint": fingerprint,
            "node_count": len(sorted_nodes),
            "structure_signature": structure_signature,
        }
