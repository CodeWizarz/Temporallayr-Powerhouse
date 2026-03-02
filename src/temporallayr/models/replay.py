"""
Sub-models for the replay engine representing outcomes and divergences.
"""

from enum import StrEnum
from typing import Any

from temporallayr.models.base import TemporalLayrBaseModel


class DivergenceType(StrEnum):
    """Categorization of execution divergence matches."""

    OUTPUT_MISMATCH = "output_mismatch"
    ERROR_MISMATCH = "error_mismatch"
    METADATA_MISMATCH = "metadata_mismatch"
    MISSING_NODE = "missing_node"


class NodeReplayResult(TemporalLayrBaseModel):
    """Result of attempting to replay a single execution node."""

    node_id: str
    success: bool
    actual_output: Any | None = None
    actual_error: str | None = None
    divergence_type: DivergenceType | None = None
    divergence_details: str | None = None


class ReplayReport(TemporalLayrBaseModel):
    """Full architectural report of a deterministic execution replay."""

    graph_id: str
    total_nodes: int
    nodes_replayed: int
    divergences_found: int
    results: list[NodeReplayResult]
    is_deterministic: bool
