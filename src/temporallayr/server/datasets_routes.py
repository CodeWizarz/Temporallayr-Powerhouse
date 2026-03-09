"""Datasets management API -- schema introspection and retention."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger("temporallayr.datasets")

router = APIRouter(prefix="/datasets", tags=["datasets"])

_ch_client = None


def _get_ch():
    global _ch_client
    if _ch_client is None:
        try:
            import clickhouse_connect
            _ch_client = clickhouse_connect.get_client(
                host=os.getenv("TEMPORALLAYR_CLICKHOUSE_HOST", "localhost"),
                port=int(os.getenv("TEMPORALLAYR_CLICKHOUSE_PORT", "8443")),
                database=os.getenv("TEMPORALLAYR_CLICKHOUSE_DB", "default"),
                username=os.getenv("TEMPORALLAYR_CLICKHOUSE_USER", "default"),
                password=os.getenv("TEMPORALLAYR_CLICKHOUSE_PASSWORD", ""),
                secure=os.getenv("TEMPORALLAYR_CLICKHOUSE_SECURE", "true").lower() == "true",
            )
        except Exception:
            return None
    return _ch_client


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class DatasetField(BaseModel):
    name: str
    type: str
    default_type: str = ""
    comment: str = ""


class DatasetInfo(BaseModel):
    name: str
    engine: str = ""
    total_rows: int = 0
    total_bytes: int = 0
    total_bytes_human: str = "0 B"
    fields: list[DatasetField] = Field(default_factory=list)
    partition_key: str = ""
    sorting_key: str = ""
    ttl: str = ""
    created_at: str | None = None


class RetentionUpdate(BaseModel):
    ttl_days: int = Field(..., ge=1, le=3650)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _human_bytes(b: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(b) < 1024:
            return f"{b:.1f} {unit}"
        b /= 1024  # type: ignore[assignment]
    return f"{b:.1f} PB"


TEMPORALLAYR_TABLES = ("temporallayr_spans", "temporallayr_traces", "temporallayr_uptime_events")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("")
async def list_datasets():
    """List all TemporalLayr datasets (ClickHouse tables)."""
    client = _get_ch()
    if client is None:
        return {"datasets": [], "error": "ClickHouse not available"}

    datasets: list[dict] = []
    try:
        for table in TEMPORALLAYR_TABLES:
            # Row count and size
            try:
                stats = client.query(
                    "SELECT count() AS cnt, sum(bytes_on_disk) AS sz "
                    "FROM system.parts WHERE table = %(tbl)s AND active = 1",
                    parameters={"tbl": table},
                )
                row = stats.result_rows[0] if stats.result_rows else (0, 0)
                total_rows = int(row[0])
                total_bytes = int(row[1])
            except Exception:
                total_rows, total_bytes = 0, 0

            # Schema
            try:
                cols = client.query(
                    "SELECT name, type, default_kind, comment "
                    "FROM system.columns WHERE table = %(tbl)s "
                    "ORDER BY position",
                    parameters={"tbl": table},
                )
                fields = [
                    DatasetField(
                        name=r[0], type=r[1], default_type=r[2] or "", comment=r[3] or ""
                    ).model_dump()
                    for r in cols.result_rows
                ]
            except Exception:
                fields = []

            datasets.append({
                "name": table,
                "total_rows": total_rows,
                "total_bytes": total_bytes,
                "total_bytes_human": _human_bytes(total_bytes),
                "fields": fields,
                "field_count": len(fields),
            })
    except Exception as exc:
        logger.exception("Failed to list datasets")
        return {"datasets": [], "error": str(exc)}

    return {"datasets": datasets}


@router.get("/{dataset_name}")
async def get_dataset(dataset_name: str):
    """Get detailed info for a single dataset."""
    if dataset_name not in TEMPORALLAYR_TABLES:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_name}' not found")

    client = _get_ch()
    if client is None:
        raise HTTPException(status_code=503, detail="ClickHouse not available")

    try:
        # Table metadata
        meta = client.query(
            "SELECT engine, partition_key, sorting_key, "
            "       create_table_query "
            "FROM system.tables WHERE name = %(tbl)s",
            parameters={"tbl": dataset_name},
        )
        meta_row = meta.result_rows[0] if meta.result_rows else ("", "", "", "")

        # Extract TTL from CREATE TABLE query
        create_sql = meta_row[3] if len(meta_row) > 3 else ""
        ttl = ""
        if "TTL" in create_sql:
            ttl_idx = create_sql.index("TTL")
            ttl = create_sql[ttl_idx:ttl_idx + 100].split("\n")[0].strip()

        # Row count
        cnt_result = client.query(f"SELECT count() FROM {dataset_name}")
        total_rows = int(cnt_result.result_rows[0][0]) if cnt_result.result_rows else 0

        # Size
        size_result = client.query(
            "SELECT sum(bytes_on_disk) FROM system.parts "
            "WHERE table = %(tbl)s AND active = 1",
            parameters={"tbl": dataset_name},
        )
        total_bytes = int(size_result.result_rows[0][0]) if size_result.result_rows else 0

        # Columns
        cols = client.query(
            "SELECT name, type, default_kind, comment "
            "FROM system.columns WHERE table = %(tbl)s ORDER BY position",
            parameters={"tbl": dataset_name},
        )
        fields = [
            DatasetField(name=r[0], type=r[1], default_type=r[2] or "", comment=r[3] or "").model_dump()
            for r in cols.result_rows
        ]

        info = DatasetInfo(
            name=dataset_name,
            engine=meta_row[0],
            total_rows=total_rows,
            total_bytes=total_bytes,
            total_bytes_human=_human_bytes(total_bytes),
            fields=fields,
            partition_key=meta_row[1],
            sorting_key=meta_row[2],
            ttl=ttl,
        )
        return info.model_dump()

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to get dataset %s", dataset_name)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{dataset_name}/schema")
async def get_schema(dataset_name: str):
    """Get just the schema (fields) for a dataset."""
    if dataset_name not in TEMPORALLAYR_TABLES:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_name}' not found")

    client = _get_ch()
    if client is None:
        raise HTTPException(status_code=503, detail="ClickHouse not available")

    try:
        cols = client.query(
            "SELECT name, type, default_kind, comment "
            "FROM system.columns WHERE table = %(tbl)s ORDER BY position",
            parameters={"tbl": dataset_name},
        )
        fields = [
            {"name": r[0], "type": r[1], "default_type": r[2] or "", "comment": r[3] or ""}
            for r in cols.result_rows
        ]
        return {"dataset": dataset_name, "fields": fields, "field_count": len(fields)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/{dataset_name}/retention")
async def update_retention(dataset_name: str, body: RetentionUpdate):
    """Update TTL retention for a dataset."""
    if dataset_name not in TEMPORALLAYR_TABLES:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_name}' not found")

    client = _get_ch()
    if client is None:
        raise HTTPException(status_code=503, detail="ClickHouse not available")

    try:
        # Determine the datetime column (start_time for spans, created_at for traces)
        dt_col = "start_time" if "spans" in dataset_name else "created_at"
        client.command(
            f"ALTER TABLE {dataset_name} MODIFY TTL {dt_col} + INTERVAL {body.ttl_days} DAY"
        )
        return {"success": True, "dataset": dataset_name, "ttl_days": body.ttl_days}
    except Exception as exc:
        logger.exception("Failed to update retention for %s", dataset_name)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{dataset_name}/stats")
async def dataset_stats(dataset_name: str):
    """Get field-level statistics for a dataset."""
    if dataset_name not in TEMPORALLAYR_TABLES:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_name}' not found")

    client = _get_ch()
    if client is None:
        raise HTTPException(status_code=503, detail="ClickHouse not available")

    try:
        # Cardinality of key fields
        key_fields = ["tenant_id", "service_name", "span_kind", "status"]
        stats: dict[str, Any] = {}
        for field in key_fields:
            try:
                r = client.query(
                    f"SELECT uniqExact({field}) FROM {dataset_name}"
                )
                stats[field] = {"cardinality": int(r.result_rows[0][0])}
            except Exception:
                continue

        # Time range
        try:
            dt_col = "start_time" if "spans" in dataset_name else "created_at"
            r = client.query(f"SELECT min({dt_col}), max({dt_col}) FROM {dataset_name}")
            row = r.result_rows[0]
            stats["time_range"] = {"min": str(row[0]), "max": str(row[1])}
        except Exception:
            pass

        return {"dataset": dataset_name, "stats": stats}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
