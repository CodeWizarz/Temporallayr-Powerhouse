"""
Execution clustering for grouping deterministic failures.
"""

import hashlib
from collections import defaultdict
from typing import Any

from temporallayr.core.fingerprint import Fingerprinter
from temporallayr.models.execution import ExecutionGraph


class FailureClusterEngine:
    """
    Analyzes a batch of executions and clusters deterministic failures.
    """

    @classmethod
    def cluster_failures(cls, executions: list[ExecutionGraph]) -> list[dict[str, Any]]:
        """
        Group executions with failures by identical structural fingerprints,
        the specific node failing, and the corresponding error type.

        Skips successfully completed executions without errors.
        """
        # (fingerprint, failing_node, error_type) -> list of execution ids
        clusters = defaultdict(list)
        cluster_metadata = {}

        for execution in executions:
            sorted_nodes = sorted(execution.nodes.values(), key=lambda n: n.created_at)

            # Detect if there's any failure
            failing_node = None
            error_type = None

            for node in sorted_nodes:
                if "error" in node.metadata and node.metadata["error"] is not None:
                    failing_node = node.name
                    # Standardize error type classification
                    error_val = node.metadata["error"]
                    error_type = (
                        type(error_val).__name__ if not isinstance(error_val, str) else "Exception"
                    )
                    break

            if not failing_node:
                # Execution is perfectly fine and didn't fail
                continue

            # Calculate deterministic graph fingerprint
            fingerprint_data = Fingerprinter.fingerprint_execution(execution)
            graph_hash = fingerprint_data["fingerprint"]
            sig_length = fingerprint_data["node_count"]
            tenant_id = execution.tenant_id

            # Composite key for deterministic grouping
            cluster_key = (tenant_id, graph_hash, failing_node, error_type, sig_length)
            clusters[cluster_key].append(execution.id)

            # Store representative metadata for the final object payload
            if cluster_key not in cluster_metadata:
                cluster_metadata[cluster_key] = fingerprint_data

        results = []

        # Iterate and build final deterministic payloads mapping cluster identifiers
        for (t_id, f_hash, f_node, e_type, sig_len), exec_ids in clusters.items():
            # Build deterministic cluster ID dynamically based on the clustering parameters
            cluster_signature = f"{t_id}:{f_hash}:{f_node}:{e_type}:{sig_len}".encode()
            cluster_id = hashlib.sha256(cluster_signature).hexdigest()

            results.append(
                {
                    "cluster_id": cluster_id,
                    "tenant_id": t_id,
                    "count": len(exec_ids),
                    "fingerprint": f_hash,
                    "failing_node": f_node,
                    "error_type": e_type,
                    "structure_signature_length": sig_len,
                    "executions": exec_ids,
                }
            )

        # Sort the final output deterministically (e.g. by descending count, then ID)
        results.sort(key=lambda x: (-x["count"], x["cluster_id"]))

        return results
