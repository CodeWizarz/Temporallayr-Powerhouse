"""ClickHouse schema for execution DAG nodes and edges."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

CREATE_NODES_TABLE = """
CREATE TABLE IF NOT EXISTS execution_nodes (
    id           String,
    trace_id     String,
    parent_id    Nullable(String),
    type         String,
    name         String,
    latency      Nullable(Float64),
    tokens       Nullable(Int64),
    cost         Nullable(Float64),
    metadata     String,       -- JSON blob
    created_at   DateTime64(3) DEFAULT now64()
)
ENGINE = MergeTree()
ORDER BY (trace_id, id);
"""

CREATE_EDGES_TABLE = """
CREATE TABLE IF NOT EXISTS execution_edges (
    trace_id     String,
    source_id    String,
    target_id    String,
    metadata     String,       -- JSON blob
    created_at   DateTime64(3) DEFAULT now64()
)
ENGINE = MergeTree()
ORDER BY (trace_id, source_id, target_id);
"""


async def ensure_dag_tables(client: Any) -> None:
    """Create nodes and edges tables if they don't exist."""
    try:
        await client.command(CREATE_NODES_TABLE)
        await client.command(CREATE_EDGES_TABLE)
    except Exception:
        logger.exception("Failed to create DAG tables")


async def insert_nodes(client: Any, nodes: list[dict[str, Any]]) -> None:
    """Bulk-insert a list of node dicts into execution_nodes."""
    if not nodes:
        return
    try:
        await client.insert("execution_nodes", nodes, column_names=list(nodes[0].keys()))
    except Exception:
        logger.exception("Failed to insert DAG nodes")


async def insert_edges(client: Any, edges: list[dict[str, Any]]) -> None:
    """Bulk-insert a list of edge dicts into execution_edges."""
    if not edges:
        return
    try:
        await client.insert("execution_edges", edges, column_names=list(edges[0].keys()))
    except Exception:
        logger.exception("Failed to insert DAG edges")


async def query_dag(client: Any, trace_id: str) -> dict[str, list[dict[str, Any]]]:
    """Retrieve nodes and edges for a given trace_id."""
    nodes_result = await client.query(
        "SELECT * FROM execution_nodes WHERE trace_id = %(tid)s",
        parameters={"tid": trace_id},
    )
    edges_result = await client.query(
        "SELECT * FROM execution_edges WHERE trace_id = %(tid)s",
        parameters={"tid": trace_id},
    )
    return {
        "nodes": [dict(r) for r in nodes_result.named_results()],
        "edges": [dict(r) for r in edges_result.named_results()],
    }
