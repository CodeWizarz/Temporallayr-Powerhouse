"""Enterprise API Key Management with hashed secure storage."""

from __future__ import annotations

import base64
import hashlib
import secrets
from typing import Any


def generate_api_key() -> str:
    raw_bytes = secrets.token_bytes(32)
    return base64.urlsafe_b64encode(raw_bytes).decode("utf-8").rstrip("=")


def _hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def map_api_key_to_tenant(api_key: str, tenant_id: str) -> None:
    from temporallayr.core.store_sqlite import SQLiteStore

    key_hash = _hash_api_key(api_key)
    store = SQLiteStore()
    with store._get_connection() as conn:
        key_id = secrets.token_hex(16)
        conn.execute(
            "INSERT OR REPLACE INTO api_keys (id, key_hash, tenant_id) VALUES (?, ?, ?)",
            (key_id, key_hash, tenant_id),
        )
        conn.commit()


def validate_api_key(api_key: str) -> str | None:
    from temporallayr.core.store_sqlite import SQLiteStore

    key_hash = _hash_api_key(api_key)
    store = SQLiteStore()
    with store._get_connection() as conn:
        cursor = conn.execute("SELECT tenant_id FROM api_keys WHERE key_hash = ?", (key_hash,))
        row = cursor.fetchone()
        if row:
            return row["tenant_id"]
    return None


def revoke_keys_for_tenant(tenant_id: str) -> int:
    """Delete all API keys for a tenant. Returns count deleted."""
    from temporallayr.core.store_sqlite import SQLiteStore

    store = SQLiteStore()
    with store._get_connection() as conn:
        cursor = conn.execute("DELETE FROM api_keys WHERE tenant_id = ?", (tenant_id,))
        conn.commit()
        return cursor.rowcount


def list_keys_for_tenant(tenant_id: str) -> list[dict[str, Any]]:
    from temporallayr.core.store_sqlite import SQLiteStore

    store = SQLiteStore()
    with store._get_connection() as conn:
        cursor = conn.execute(
            "SELECT id, tenant_id, created_at FROM api_keys "
            "WHERE tenant_id = ? ORDER BY created_at DESC",
            (tenant_id,),
        )
        return [dict(row) for row in cursor.fetchall()]


def list_all_tenants() -> list[dict[str, Any]]:
    """Return distinct tenants with key count and earliest created_at."""
    from temporallayr.core.store_sqlite import SQLiteStore

    store = SQLiteStore()
    with store._get_connection() as conn:
        cursor = conn.execute("""
            SELECT tenant_id, COUNT(*) as key_count, MIN(created_at) as created_at
            FROM api_keys GROUP BY tenant_id ORDER BY created_at DESC
            """)
        return [dict(row) for row in cursor.fetchall()]
