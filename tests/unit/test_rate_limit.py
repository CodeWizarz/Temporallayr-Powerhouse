from temporallayr.core.rate_limit import SlidingWindowRateLimiter


def test_allows_under_limit():
    rl = SlidingWindowRateLimiter()
    for _ in range(9):
        allowed, _ = rl.is_allowed("t1", limit=10)
        assert allowed


def test_blocks_at_limit():
    rl = SlidingWindowRateLimiter()
    for _ in range(10):
        rl.is_allowed("t2", limit=10)
    allowed, headers = rl.is_allowed("t2", limit=10)
    assert not allowed
    assert "Retry-After" in headers
    assert headers["X-RateLimit-Remaining"] == "0"


def test_tenant_isolation():
    rl = SlidingWindowRateLimiter()
    for _ in range(10):
        rl.is_allowed("tenant-a", limit=10)
    allowed, _ = rl.is_allowed("tenant-b", limit=10)
    assert allowed


def test_remaining_header_decrements():
    rl = SlidingWindowRateLimiter()
    _, h1 = rl.is_allowed("t", limit=5)
    _, h2 = rl.is_allowed("t", limit=5)
    assert int(h1["X-RateLimit-Remaining"]) > int(h2["X-RateLimit-Remaining"])
