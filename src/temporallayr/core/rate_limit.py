"""
Per-tenant sliding window rate limiter.
No Redis required — resets on restart, fine for single-worker.
Scale to Redis if you go multi-worker later.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from typing import Any


class SlidingWindowRateLimiter:
    def __init__(self) -> None:
        self._windows: dict[str, deque] = defaultdict(deque)

    def is_allowed(
        self, key: str, limit: int, window_seconds: int = 60
    ) -> tuple[bool, dict[str, str]]:
        now = time.monotonic()
        window = self._windows[key]
        cutoff = now - window_seconds
        while window and window[0] < cutoff:
            window.popleft()

        count = len(window)
        reset_at = int(time.time()) + window_seconds
        headers = {
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": str(max(0, limit - count - 1)),
            "X-RateLimit-Reset": str(reset_at),
        }

        if count >= limit:
            headers["Retry-After"] = str(window_seconds)
            headers["X-RateLimit-Remaining"] = "0"
            return False, headers

        window.append(now)
        return True, headers


_ingest_limiter = SlidingWindowRateLimiter()
_api_limiter = SlidingWindowRateLimiter()
_admin_limiter = SlidingWindowRateLimiter()


def check_ingest_rate(tenant_id: str) -> tuple[bool, dict[str, str]]:
    limit = int(os.getenv("TEMPORALLAYR_INGEST_RATE_LIMIT", "1000"))
    return _ingest_limiter.is_allowed(tenant_id, limit=limit)


def check_api_rate(tenant_id: str) -> tuple[bool, dict[str, str]]:
    limit = int(os.getenv("TEMPORALLAYR_API_RATE_LIMIT", "200"))
    return _api_limiter.is_allowed(tenant_id, limit=limit)


def check_admin_rate(ip: str) -> tuple[bool, dict[str, str]]:
    return _admin_limiter.is_allowed(ip, limit=10)
