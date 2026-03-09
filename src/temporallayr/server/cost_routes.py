"""Cost tracking and analytics API."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger("temporallayr.cost")

router = APIRouter(prefix="/analytics/cost", tags=["cost"])

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
# Endpoints
# ---------------------------------------------------------------------------


@router.get("")
async def cost_summary(
    tenant_id: str = Query("default"),
    days: int = Query(30, ge=1, le=365),
):
    """Get total cost summary for a tenant."""
    client = _get_ch()
    if client is None:
        return {"error": "ClickHouse not available", "summary": {}}

    try:
        result = client.query(
            """
            SELECT
                sum(cost) AS total_cost,
                sum(token_input) AS total_input_tokens,
                sum(token_output) AS total_output_tokens,
                sum(token_input + token_output) AS total_tokens,
                count() AS total_spans,
                countIf(span_kind = 'llm') AS llm_spans,
                avg(cost) AS avg_cost_per_span,
                max(cost) AS max_cost_span
            FROM temporallayr_spans
            WHERE tenant_id = %(tenant_id)s
              AND start_time >= now() - INTERVAL %(days)s DAY
              AND cost > 0
            """,
            parameters={"tenant_id": tenant_id, "days": days},
        )
        row = result.result_rows[0] if result.result_rows else [0] * 8
        cols = result.column_names
        summary = dict(zip(cols, row))
        summary["period_days"] = days
        return {"summary": summary}
    except Exception as exc:
        logger.exception("Cost summary failed")
        return {"error": str(exc), "summary": {}}


@router.get("/breakdown")
async def cost_breakdown(
    tenant_id: str = Query("default"),
    group_by: str = Query("model", description="Group by: model, service, agent, span_kind"),
    days: int = Query(30, ge=1, le=365),
):
    """Break down costs by model, service, agent, or span kind."""
    client = _get_ch()
    if client is None:
        return {"error": "ClickHouse not available", "breakdown": []}

    # Map group_by to actual column
    col_map = {
        "model": "model_name",
        "service": "service_name",
        "agent": "service_name",
        "span_kind": "span_kind",
    }
    col = col_map.get(group_by, "model_name")

    try:
        result = client.query(
            f"""
            SELECT
                {col} AS group_key,
                sum(cost) AS total_cost,
                sum(token_input) AS input_tokens,
                sum(token_output) AS output_tokens,
                count() AS span_count,
                avg(cost) AS avg_cost
            FROM temporallayr_spans
            WHERE tenant_id = %(tenant_id)s
              AND start_time >= now() - INTERVAL %(days)s DAY
              AND cost > 0
            GROUP BY {col}
            ORDER BY total_cost DESC
            """,
            parameters={"tenant_id": tenant_id, "days": days},
        )
        breakdown = [
            dict(zip(result.column_names, row))
            for row in result.result_rows
        ]
        return {"breakdown": breakdown, "group_by": group_by}
    except Exception as exc:
        logger.exception("Cost breakdown failed")
        return {"error": str(exc), "breakdown": []}


@router.get("/trends")
async def cost_trends(
    tenant_id: str = Query("default"),
    days: int = Query(30, ge=1, le=365),
    granularity: str = Query("day", description="day, hour, week"),
):
    """Get cost trends over time."""
    client = _get_ch()
    if client is None:
        return {"error": "ClickHouse not available", "trends": []}

    interval_fn = {
        "hour": "toStartOfHour(start_time)",
        "day": "toDate(start_time)",
        "week": "toStartOfWeek(start_time)",
    }
    bucket = interval_fn.get(granularity, "toDate(start_time)")

    try:
        result = client.query(
            f"""
            SELECT
                {bucket} AS period,
                sum(cost) AS total_cost,
                sum(token_input + token_output) AS total_tokens,
                count() AS span_count,
                countIf(span_kind = 'llm') AS llm_calls
            FROM temporallayr_spans
            WHERE tenant_id = %(tenant_id)s
              AND start_time >= now() - INTERVAL %(days)s DAY
            GROUP BY period
            ORDER BY period ASC
            """,
            parameters={"tenant_id": tenant_id, "days": days},
        )
        trends = [dict(zip(result.column_names, row)) for row in result.result_rows]
        # Convert dates to strings
        for t in trends:
            t["period"] = str(t["period"])
        return {"trends": trends, "granularity": granularity}
    except Exception as exc:
        logger.exception("Cost trends failed")
        return {"error": str(exc), "trends": []}


@router.get("/forecast")
async def cost_forecast(
    tenant_id: str = Query("default"),
    forecast_days: int = Query(30, ge=1, le=90),
):
    """Simple linear forecast of costs based on recent trend."""
    client = _get_ch()
    if client is None:
        return {"error": "ClickHouse not available", "forecast": {}}

    try:
        # Get daily costs for last 30 days
        result = client.query(
            """
            SELECT
                toDate(start_time) AS day,
                sum(cost) AS daily_cost
            FROM temporallayr_spans
            WHERE tenant_id = %(tenant_id)s
              AND start_time >= now() - INTERVAL 30 DAY
              AND cost > 0
            GROUP BY day
            ORDER BY day ASC
            """,
            parameters={"tenant_id": tenant_id},
        )
        daily = [(str(r[0]), float(r[1])) for r in result.result_rows]

        if len(daily) < 2:
            return {"forecast": {"message": "Insufficient data for forecast", "data_points": len(daily)}}

        # Simple linear regression
        costs = [d[1] for d in daily]
        n = len(costs)
        x_mean = (n - 1) / 2
        y_mean = sum(costs) / n
        numerator = sum((i - x_mean) * (c - y_mean) for i, c in enumerate(costs))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        slope = numerator / denominator if denominator else 0
        intercept = y_mean - slope * x_mean

        # Project forward
        projected_daily = max(0, intercept + slope * (n + forecast_days // 2))
        projected_total = projected_daily * forecast_days

        return {
            "forecast": {
                "current_daily_avg": round(y_mean, 4),
                "trend_direction": "increasing" if slope > 0 else "decreasing" if slope < 0 else "flat",
                "daily_change": round(slope, 4),
                "projected_daily_avg": round(projected_daily, 4),
                "projected_total": round(projected_total, 2),
                "forecast_days": forecast_days,
                "data_points": n,
                "recent_daily": daily[-7:],
            }
        }
    except Exception as exc:
        logger.exception("Cost forecast failed")
        return {"error": str(exc), "forecast": {}}


@router.get("/top-traces")
async def top_traces_by_cost(
    tenant_id: str = Query("default"),
    limit: int = Query(20, ge=1, le=100),
    days: int = Query(7, ge=1, le=365),
):
    """Get the most expensive traces."""
    client = _get_ch()
    if client is None:
        return {"error": "ClickHouse not available", "traces": []}

    try:
        result = client.query(
            """
            SELECT
                trace_id,
                sum(cost) AS total_cost,
                sum(token_input) AS input_tokens,
                sum(token_output) AS output_tokens,
                count() AS span_count,
                min(start_time) AS started_at,
                any(service_name) AS service
            FROM temporallayr_spans
            WHERE tenant_id = %(tenant_id)s
              AND start_time >= now() - INTERVAL %(days)s DAY
              AND cost > 0
            GROUP BY trace_id
            ORDER BY total_cost DESC
            LIMIT %(limit)s
            """,
            parameters={"tenant_id": tenant_id, "days": days, "limit": limit},
        )
        traces = [dict(zip(result.column_names, row)) for row in result.result_rows]
        for t in traces:
            t["started_at"] = str(t.get("started_at", ""))
        return {"traces": traces}
    except Exception as exc:
        logger.exception("Top traces by cost failed")
        return {"error": str(exc), "traces": []}
