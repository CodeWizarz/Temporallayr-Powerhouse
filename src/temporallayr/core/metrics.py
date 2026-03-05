"""
Hand-rolled Prometheus text format metrics.
No external dependency — just standard library.
GET /metrics → scrape with Prometheus, Grafana, or Koyeb's built-in metrics.
"""

from __future__ import annotations

from collections import defaultdict
from threading import Lock
from typing import Protocol


class _Renderable(Protocol):
    def render(self) -> str: ...


class _Counter:
    def __init__(self, name: str, help_text: str, labels: list[str]) -> None:
        self.name, self.help, self.labels = name, help_text, labels
        self._values: dict[tuple, float] = defaultdict(float)
        self._lock = Lock()

    def inc(self, amount: float = 1.0, **kw: str) -> None:
        key = tuple(kw.get(label_name, "") for label_name in self.labels)
        with self._lock:
            self._values[key] += amount

    def render(self) -> str:
        lines = [f"# HELP {self.name} {self.help}", f"# TYPE {self.name} counter"]
        for key, val in self._values.items():
            ls = ",".join(
                f'{label_name}="{value}"'
                for label_name, value in zip(self.labels, key, strict=True)
            )
            lines.append(f"{self.name}{{{ls}}} {val}")
        return "\n".join(lines)


class _Gauge:
    def __init__(self, name: str, help_text: str) -> None:
        self.name, self.help = name, help_text
        self._value = 0.0
        self._lock = Lock()

    def set(self, v: float) -> None:
        with self._lock:
            self._value = v

    def inc(self, v: float = 1.0) -> None:
        with self._lock:
            self._value += v

    def dec(self, v: float = 1.0) -> None:
        with self._lock:
            self._value -= v

    def render(self) -> str:
        # Always emit float notation (e.g. "8.0") for Prometheus compatibility
        val = float(self._value)
        return f"# HELP {self.name} {self.help}\n# TYPE {self.name} gauge\n{self.name} {val}"


class _Histogram:
    _BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, float("inf")]

    def __init__(self, name: str, help_text: str) -> None:
        self.name, self.help = name, help_text
        self._sum = 0.0
        self._count = 0
        self._buckets: dict[float, int] = defaultdict(int)
        self._lock = Lock()

    def observe(self, value: float) -> None:
        with self._lock:
            self._sum += value
            self._count += 1
            for b in self._BUCKETS:
                if value <= b:
                    self._buckets[b] += 1

    def render(self) -> str:
        lines = [f"# HELP {self.name} {self.help}", f"# TYPE {self.name} histogram"]
        for b in sorted(self._buckets):
            label = "+Inf" if b == float("inf") else str(int(b))
            lines.append(f'{self.name}_bucket{{le="{label}"}} {self._buckets[b]}')
        lines += [f"{self.name}_sum {self._sum}", f"{self.name}_count {self._count}"]
        return "\n".join(lines)


# ── Registry ──────────────────────────────────────────────────────────
spans_ingested = _Counter("tl_spans_ingested_total", "Spans ingested", ["tenant_id", "status"])
api_requests = _Counter("tl_api_requests_total", "API requests", ["method", "path", "status_code"])
rate_limit_hits = _Counter("tl_rate_limit_hits_total", "Rate limit rejections", ["tenant_id"])
incidents_total = _Counter("tl_incidents_total", "Incidents created", ["severity"])
incidents_open = _Gauge("tl_incidents_open", "Open incidents")
request_duration = _Histogram("tl_request_duration_ms", "Request latency ms")
queue_size = _Gauge("tl_queue_size", "Current items in ingestion queue")
ingestion_rate = _Counter("tl_ingestion_rate_total", "Ingestion throughput", ["tenant_id"])

_REGISTRY: list[_Renderable] = [
    spans_ingested,
    api_requests,
    rate_limit_hits,
    incidents_total,
    incidents_open,
    request_duration,
    queue_size,
    ingestion_rate,
]


def render_all() -> str:
    return "\n\n".join(m.render() for m in _REGISTRY) + "\n"
