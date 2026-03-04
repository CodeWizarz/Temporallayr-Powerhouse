"""
Per-tenant rate limiting using in-memory sliding window.
No Redis needed. Resets on server restart (acceptable for single-worker).
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Any

import logging

logger = logging.getLogger(__name__)


class SlidingWindowRateLimiter:
    """Thread-safe sliding window rate limiter."""

    def __init__(self) -> None:
        # tenant_id -> deque of timestamps
        self._windows: dict[str, deque] = defaultdict(deque)

    def is_allowed(
        self, tenant_id: str, limit: int, window_seconds: int = 60
    ) -> tuple[bool, dict[str, Any]]:
        now = time.monotonic()
        window = self._windows[tenant_id]

        # Evict expired entries
        cutoff = now - window_seconds
        while window and window[0] < cutoff:
            window.popleft()

        count = len(window)
        remaining = max(0, limit - count)
        reset_at = int(time.time()) + window_seconds

        if count >= limit:
            return False, {
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset_at),
                "Retry-After": str(window_seconds),
            }

        window.append(now)
        return True, {
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": str(remaining - 1),
            "X-RateLimit-Reset": str(reset_at),
        }


# Global limiter instances
_ingest_limiter = SlidingWindowRateLimiter()
_api_limiter = SlidingWindowRateLimiter()
_admin_limiter = SlidingWindowRateLimiter()


def check_ingest_rate(tenant_id: str) -> tuple[bool, dict[str, Any]]:
    """1000 req/min per tenant on /v1/ingest."""
    limit = int(__import__("os").getenv("TEMPORALLAYR_INGEST_RATE_LIMIT", "1000"))
    return _ingest_limiter.is_allowed(tenant_id, limit=limit, window_seconds=60)


def check_api_rate(tenant_id: str) -> tuple[bool, dict[str, Any]]:
    """200 req/min per tenant on general API endpoints."""
    limit = int(__import__("os").getenv("TEMPORALLAYR_API_RATE_LIMIT", "200"))
    return _api_limiter.is_allowed(tenant_id, limit=limit, window_seconds=60)


def check_admin_rate(ip: str) -> tuple[bool, dict[str, Any]]:
    """10 req/min on admin endpoints (keyed by IP)."""
    return _admin_limiter.is_allowed(ip, limit=10, window_seconds=60)
