import logging
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from temporallayr.health.store import get_health_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["Public"])


class UptimeSummary(BaseModel):
    service: str
    uptime_percentage: float
    history: list[dict[str, Any]]


class StatusResponse(BaseModel):
    days: int
    services: list[UptimeSummary]


@router.get("/status", response_model=StatusResponse)
async def get_public_status(days: int = 30) -> StatusResponse:
    """
    Get aggregated uptime history for the last N days.
    Publicly accessible without auth.
    """
    store = get_health_store()
    history = store.get_history()

    # We want to group by service, then by day.
    # A day's status is "down" if there was ANY down event that day, "up" otherwise.
    # Alternatively, uptime percentage = (up checks / total checks) per day

    cutoff = datetime.now(UTC) - timedelta(days=days)

    # Structure: service -> day_string -> { 'up': int, 'down': int, 'errors': list[str] }
    aggregations: dict[str, dict[str, dict[str, Any]]] = defaultdict(
        lambda: defaultdict(lambda: {"up": 0, "down": 0, "errors": set()})
    )

    for entry in history:
        try:
            ts = datetime.fromisoformat(entry["timestamp"])
            if ts < cutoff:
                continue

            day_str = ts.strftime("%Y-%m-%d")
            service = entry["service"]
            status = entry["status"]
            error = entry.get("error")

            if status == "up":
                aggregations[service][day_str]["up"] += 1
            else:
                aggregations[service][day_str]["down"] += 1
                if error:
                    aggregations[service][day_str]["errors"].add(error)
        except Exception as e:
            logger.warning("Error parsing health record: %s", str(e))

    summaries = []

    # Pre-fill empty days across the range so the graph is contiguous
    all_days = [(datetime.now(UTC) - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    all_days.reverse()

    for service_name, days_map in aggregations.items():
        total_up = 0
        total_down = 0
        service_history = []

        for d in all_days:
            stats = days_map.get(d, {"up": 0, "down": 0, "errors": set()})
            total_checks = stats["up"] + stats["down"]
            up_pct = (
                (stats["up"] / total_checks * 100.0) if total_checks > 0 else 100.0
            )  # assume 100% if no data? Or omit?

            # Let's say if down > 0, it experienced downtime that day
            day_status = "operational" if stats["down"] == 0 else "downtime"
            if total_checks == 0:
                day_status = "unknown"

            total_up += stats["up"]
            total_down += stats["down"]

            service_history.append(
                {
                    "date": d,
                    "uptime_percentage": up_pct,
                    "status": day_status,
                    "errors": list(stats["errors"]),
                }
            )

        overall_total = total_up + total_down
        overall_pct = (total_up / overall_total * 100.0) if overall_total > 0 else 100.0

        summaries.append(
            UptimeSummary(
                service=service_name,
                uptime_percentage=round(overall_pct, 2),
                history=service_history,
            )
        )

    return StatusResponse(days=days, services=summaries)
