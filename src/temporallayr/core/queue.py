"""
Redis connection handler for queue-based ingestion.
"""

from __future__ import annotations

import os

import redis.asyncio as redis


def get_redis_client() -> redis.Redis | None:
    """Return an async Redis client if configured."""
    redis_url = os.getenv("TEMPORALLAYR_REDIS_URL")
    if not redis_url:
        return None
    return redis.from_url(redis_url, decode_responses=True)
