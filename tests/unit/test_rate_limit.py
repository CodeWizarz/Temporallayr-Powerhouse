"""Unit tests for sliding window rate limiter."""

import pytest
from temporallayr.core.rate_limit import SlidingWindowRateLimiter


def test_allows_under_limit():
    limiter = SlidingWindowRateLimiter()
    for _ in range(5):
        allowed, _ = limiter.is_allowed("tenant1", limit=10)
        assert allowed


def test_blocks_over_limit():
    limiter = SlidingWindowRateLimiter()
    for _ in range(10):
        limiter.is_allowed("tenant2", limit=10)
    allowed, headers = limiter.is_allowed("tenant2", limit=10)
    assert not allowed
    assert "Retry-After" in headers
    assert headers["X-RateLimit-Remaining"] == "0"


def test_tenant_isolation():
    limiter = SlidingWindowRateLimiter()
    for _ in range(10):
        limiter.is_allowed("tenant-a", limit=10)
    # tenant-b unaffected
    allowed, _ = limiter.is_allowed("tenant-b", limit=10)
    assert allowed


def test_remaining_decrements():
    limiter = SlidingWindowRateLimiter()
    _, h1 = limiter.is_allowed("t", limit=5)
    _, h2 = limiter.is_allowed("t", limit=5)
    assert int(h1["X-RateLimit-Remaining"]) > int(h2["X-RateLimit-Remaining"])
