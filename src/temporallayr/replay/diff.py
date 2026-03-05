"""
replay/diff.py — backward-compatibility shim.

The canonical logic lives in temporallayr.core.diff_engine (ExecutionDiffer).
This module exposes the DivergenceReport and semantic_diff API expected by
replay_routes.py and tests.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from temporallayr.core.diff_engine import ExecutionDiffer
from temporallayr.models.execution import ExecutionGraph


@dataclass
class DivergenceReport:
    """Result of a semantic diff between two ExecutionGraphs."""

    diverged: bool
    total_differences: int
    changed_nodes: list[dict[str, Any]] = field(default_factory=list)
    added_nodes: list[str] = field(default_factory=list)
    removed_nodes: list[str] = field(default_factory=list)
    output_changes: list[dict[str, Any]] = field(default_factory=list)


def semantic_diff(expected: ExecutionGraph, actual: ExecutionGraph) -> DivergenceReport:
    """Compare two ExecutionGraphs and return a DivergenceReport."""
    result = ExecutionDiffer.diff(expected, actual)
    total = len(result["changed_nodes"]) + len(result["added_nodes"]) + len(result["removed_nodes"])
    return DivergenceReport(
        diverged=total > 0,
        total_differences=total,
        changed_nodes=result["changed_nodes"],
        added_nodes=result["added_nodes"],
        removed_nodes=result["removed_nodes"],
        output_changes=result["output_changes"],
    )
