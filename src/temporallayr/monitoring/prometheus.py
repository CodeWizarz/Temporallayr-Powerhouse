"""
Prometheus metrics instrumentation module.

Provides helpers to instrument the application with Prometheus metrics.
Exports the core metrics from metrics.py plus additional application-specific metrics.
"""

from __future__ import annotations

import time

from temporallayr.core.metrics import (
    api_requests,
    incidents_open,
    incidents_total,
    rate_limit_hits,
    request_duration,
    spans_ingested,
)
from temporallayr.core.metrics import (
    render_all as render_metrics,
)

__all__ = [
    "render_metrics",
    "spans_ingested",
    "api_requests",
    "request_duration",
    "rate_limit_hits",
    "incidents_total",
    "incidents_open",
    "track_spans_ingested",
    "track_request",
    "track_rate_limit",
    "update_incidents_gauge",
]


def track_spans_ingested(tenant_id: str, status: str = "success", count: int = 1) -> None:
    """Increment spans_ingested counter for a tenant."""
    spans_ingested.inc(amount=count, tenant_id=tenant_id, status=status)


def track_request(method: str, path: str, status_code: int, duration_ms: float) -> None:
    """Track an API request with method, path, status code and duration."""
    api_requests.inc(method=method, path=path, status_code=str(status_code))
    request_duration.observe(duration_ms)


def track_rate_limit(tenant_id: str) -> None:
    """Increment rate limit hits counter for a tenant."""
    rate_limit_hits.inc(tenant_id=tenant_id)


def update_incidents_gauge(open_count: int) -> None:
    """Update the incidents_open gauge with current open incident count."""
    incidents_open.set(float(open_count))


def track_incident_created(severity: str) -> None:
    """Increment incidents_total counter when a new incident is created."""
    incidents_total.inc(severity=severity)


_start_time: float | None = None


def get_start_time() -> float:
    """Get the application start time, initializing if needed."""
    global _start_time
    if _start_time is None:
        _start_time = time.time()
    return _start_time


def get_uptime_seconds() -> float:
    """Get the number of seconds since the application started."""
    return time.time() - get_start_time()


def get_uptime_human() -> str:
    """Get human-readable uptime string."""
    seconds = get_uptime_seconds()
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)

    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    if hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    if minutes > 0:
        return f"{minutes}m {secs}s"
    return f"{secs}s"
