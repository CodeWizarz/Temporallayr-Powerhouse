"""
Redis connection handler for queue-based ingestion.
"""

from __future__ import annotations
from typing import Any


def get_redis_client() -> Any | None:
    """Return an async Redis client. (Deprecated/Stubbed)"""
    return None
