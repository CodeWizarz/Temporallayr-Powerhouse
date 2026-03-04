"""
Prometheus-compatible metrics endpoint.
GET /metrics → Prometheus text format.
No external dependency — hand-rolled to keep deps minimal.
"""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock
from typing import Any


class _Counter:
    def __init__(self, name: str, help_text: str, labels: list[str]) -> None:
        self.name = name
        self.help = help_text
        self.labels = labels
        self._values: dict[tuple, float] = defaultdict(float)
        self._lock = Lock()

    def inc(self, amount: float = 1.0, **label_vals: str) -> None:
        key = tuple(label_vals.get(l, "") for l in self.labels)
        with self._lock:
            self._values[key] += amount

    def render(self) -> str:
        lines = [f"# HELP {self.name} {self.help}", f"# TYPE {self.name} counter"]
        for key, val in self._values.items():
            label_str = ",".join(f'{l}="{v}"' for l, v in zip(self.labels, key))
            lines.append(f"{self.name}{{{label_str}}} {val}")
        return "\n".join(lines)


class _Histogram:
    BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, float("inf")]

    def __init__(self, name: str, help_text: str) -> None:
        self.name = name
        self.help = help_text
        self._sum = 0.0
        self._count = 0
        self._buckets: dict[float, int] = defaultdict(int)
        self._lock = Lock()

    def observe(self, value: float) -> None:
        with self._lock:
            self._sum += value
            self._count += 1
            for b in self.BUCKETS:
                if value <= b:
                    self._buckets[b] += 1

    def render(self) -> str:
        lines = [f"# HELP {self.name} {self.help}", f"# TYPE {self.name} histogram"]
        for b, count in sorted(self._buckets.items()):
            label = "+Inf" if b == float("inf") else str(b)
            lines.append(f'{self.name}_bucket{{le="{label}"}} {count}')
        lines.append(f"{self.name}_sum {self._sum}")
        lines.append(f"{self.name}_count {self._count}")
        return "\n".join(lines)


class _Gauge:
    def __init__(self, name: str, help_text: str) -> None:
        self.name = name
        self.help = help_text
        self._value = 0.0
        self._lock = Lock()

    def set(self, value: float) -> None:
        with self._lock:
            self._value = value

    def inc(self, amount: float = 1.0) -> None:
        with self._lock:
            self._value += amount

    def dec(self, amount: float = 1.0) -> None:
        with self._lock:
            self._value -= amount

    def render(self) -> str:
        return (
            f"# HELP {self.name} {self.help}\n# TYPE {self.name} gauge\n{self.name} {self._value}"
        )


# ── Global metrics registry ───────────────────────────────────────────

spans_ingested = _Counter(
    "temporallayr_spans_ingested_total",
    "Total spans ingested",
    ["tenant_id", "status"],
)

request_duration = _Histogram(
    "temporallayr_request_duration_ms",
    "HTTP request duration in milliseconds",
)

incidents_open = _Gauge(
    "temporallayr_incidents_open",
    "Number of currently open incidents",
)

incidents_total = _Counter(
    "temporallayr_incidents_total",
    "Total incidents created",
    ["severity"],
)

api_requests = _Counter(
    "temporallayr_api_requests_total",
    "Total API requests",
    ["method", "path", "status"],
)

rate_limit_hits = _Counter(
    "temporallayr_rate_limit_hits_total",
    "Rate limit rejections",
    ["tenant_id"],
)

_ALL_METRICS = [
    spans_ingested,
    request_duration,
    incidents_open,
    incidents_total,
    api_requests,
    rate_limit_hits,
]


def render_all() -> str:
    """Render all metrics in Prometheus text exposition format."""
    return "\n\n".join(m.render() for m in _ALL_METRICS) + "\n"
