import os
from datetime import datetime, UTC, timedelta
from typing import Any

from temporallayr.core.store import get_default_store
from temporallayr.core.store_sqlite import SQLiteStore


class QuotaExceededException(Exception):
    def __init__(self, limit: int, used: int):
        self.limit = limit
        self.used = used

        now = datetime.now(UTC)
        next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        self.resets_at = next_midnight.isoformat()

        super().__init__(f"Quota exceeded. Limit: {limit}, Used: {used}")


def check_and_increment_quota(tenant_id: str, span_count: int, trace_count: int = 1) -> None:
    # Allow bypassing quotas entirely during tests or local dev if desired
    if os.environ.get("TEMPORALLAYR_QUOTA_ENABLED", "true").lower() == "false":
        return

    store = get_default_store()
    if not isinstance(store, SQLiteStore):
        store = SQLiteStore()  # Ensure we have SQLite access for quota

    quota = store.get_quota(tenant_id)
    daily_limit = quota["daily_span_limit"]

    date_str = datetime.now(UTC).strftime("%Y-%m-%d")
    usage = store.get_usage(tenant_id, date_str)

    current_spans = usage["span_count"]

    if current_spans + span_count > daily_limit:
        raise QuotaExceededException(limit=daily_limit, used=current_spans + span_count)

    store.increment_usage(tenant_id, spans=span_count, traces=trace_count)
