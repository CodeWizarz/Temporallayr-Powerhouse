"""
Per-tenant usage quotas.
Tracks spans_ingested per tenant per day in SQLite.
Hard limit blocks ingest. Soft limit (80%) logs warning.

GET /usage → {"spans_today": 4521, "quota": 100000, "pct": 4.5, "status": "ok"}
"""

from __future__ import annotations

import os
import sqlite3
import threading
from datetime import date
from typing import Any

_lock = threading.Lock()
_DB_PATH: str | None = None


def _db() -> sqlite3.Connection:
    global _DB_PATH
    if _DB_PATH is None:
        data_dir = os.getenv("TEMPORALLAYR_DATA_DIR", ".temporallayr")
        os.makedirs(data_dir, exist_ok=True)
        _DB_PATH = os.path.join(data_dir, "quotas.db")
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS daily_usage (
            tenant_id  TEXT NOT NULL,
            date       TEXT NOT NULL,
            spans      INTEGER DEFAULT 0,
            PRIMARY KEY (tenant_id, date)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tenant_quotas (
            tenant_id  TEXT PRIMARY KEY,
            daily_limit INTEGER DEFAULT 100000
        )
    """)
    conn.commit()
    return conn


def get_tenant_quota(tenant_id: str) -> int:
    """Return daily span limit for tenant. Default 100k."""
    default = int(os.getenv("TEMPORALLAYR_DEFAULT_QUOTA", "100000"))
    with _lock:
        conn = _db()
        row = conn.execute(
            "SELECT daily_limit FROM tenant_quotas WHERE tenant_id = ?", (tenant_id,)
        ).fetchone()
        conn.close()
    return row[0] if row else default


def set_tenant_quota(tenant_id: str, daily_limit: int) -> None:
    with _lock:
        conn = _db()
        conn.execute(
            "INSERT INTO tenant_quotas (tenant_id, daily_limit) VALUES (?,?) "
            "ON CONFLICT(tenant_id) DO UPDATE SET daily_limit=excluded.daily_limit",
            (tenant_id, daily_limit),
        )
        conn.commit()
        conn.close()


def get_usage_today(tenant_id: str) -> int:
    today = date.today().isoformat()
    with _lock:
        conn = _db()
        row = conn.execute(
            "SELECT spans FROM daily_usage WHERE tenant_id=? AND date=?",
            (tenant_id, today),
        ).fetchone()
        conn.close()
    return row[0] if row else 0


def record_spans(tenant_id: str, count: int) -> None:
    today = date.today().isoformat()
    with _lock:
        conn = _db()
        conn.execute(
            "INSERT INTO daily_usage (tenant_id, date, spans) VALUES (?,?,?) "
            "ON CONFLICT(tenant_id, date) DO UPDATE SET spans=spans+excluded.spans",
            (tenant_id, today, count),
        )
        conn.commit()
        conn.close()


def check_quota(tenant_id: str) -> tuple[bool, dict[str, Any]]:
    """
    Returns (allowed, info_dict).
    Blocks ingest when daily usage >= quota.
    """
    quota = get_tenant_quota(tenant_id)
    used = get_usage_today(tenant_id)
    pct = round((used / quota) * 100, 1) if quota > 0 else 0
    remaining = max(0, quota - used)
    status = "ok"

    if used >= quota:
        status = "quota_exceeded"
    elif pct >= 80:
        status = "warning"

    info = {
        "tenant_id": tenant_id,
        "spans_today": used,
        "quota": quota,
        "remaining": remaining,
        "pct": pct,
        "status": status,
        "date": date.today().isoformat(),
    }
    return status != "quota_exceeded", info


def purge_old_usage(days_to_keep: int = 90) -> int:
    """Delete usage records older than days_to_keep. Run in maintenance job."""
    from datetime import timedelta

    cutoff = (date.today() - timedelta(days=days_to_keep)).isoformat()
    with _lock:
        conn = _db()
        cur = conn.execute("DELETE FROM daily_usage WHERE date < ?", (cutoff,))
        deleted = cur.rowcount
        conn.commit()
        conn.close()
    return deleted
