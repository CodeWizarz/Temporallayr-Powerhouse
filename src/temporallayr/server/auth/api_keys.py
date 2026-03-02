"""
Enterprise API Key Management with hashed secure storage.
"""

import base64
import hashlib
import secrets
from typing import Any


def generate_api_key() -> str:
    """Generate a random 32-byte base64 encoded API key."""
    raw_bytes = secrets.token_bytes(32)
    return base64.urlsafe_b64encode(raw_bytes).decode("utf-8").rstrip("=")


def _hash_api_key(api_key: str) -> str:
    """Hash the API key for safe storage using SHA-256."""
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def map_api_key_to_tenant(api_key: str, tenant_id: str) -> None:
    """Store the hashed API key mapped to a given tenant."""
    from temporallayr.core.store_sqlite import SQLiteStore

    key_hash = _hash_api_key(api_key)
    store = SQLiteStore()
    with store._get_connection() as conn:
        key_id = secrets.token_hex(16)
        conn.execute(
            "INSERT INTO api_keys (id, key_hash, tenant_id) VALUES (?, ?, ?)",
            (key_id, key_hash, tenant_id),
        )
        conn.commit()


def validate_api_key(api_key: str) -> str | None:
    """Validate an API key against hashed storage and return its tenant_id if valid."""
    from temporallayr.core.store_sqlite import SQLiteStore

    key_hash = _hash_api_key(api_key)
    store = SQLiteStore()
    with store._get_connection() as conn:
        cursor = conn.execute("SELECT tenant_id FROM api_keys WHERE key_hash = ?", (key_hash,))
        row = cursor.fetchone()
        if row:
            return row["tenant_id"]
    return None


def list_keys_for_tenant(tenant_id: str) -> list[dict[str, Any]]:
    """List metadata for all active keys bounded to a tenant. Never returns raw keys."""
    from temporallayr.core.store_sqlite import SQLiteStore

    store = SQLiteStore()
    with store._get_connection() as conn:
        cursor = conn.execute(
            "SELECT id, tenant_id, created_at FROM api_keys "
            "WHERE tenant_id = ? ORDER BY created_at DESC",
            (tenant_id,),
        )
        return [dict(row) for row in cursor.fetchall()]


def delete_keys_for_tenant(tenant_id: str) -> None:
    """Invalidate immediately and delete all tracked API keys for a tenant."""
    from temporallayr.core.store_sqlite import SQLiteStore

    store = SQLiteStore()
    with store._get_connection() as conn:
        conn.execute("DELETE FROM api_keys WHERE tenant_id = ?", (tenant_id,))
        conn.commit()


def list_all_tenants() -> list[dict[str, Any]]:
    """List distinct tenants bounding mapped key counts and initial registration."""
    from temporallayr.core.store_sqlite import SQLiteStore

    store = SQLiteStore()
    with store._get_connection() as conn:
        cursor = conn.execute(
            "SELECT tenant_id, COUNT(*) as key_count, MIN(created_at) as created_at "
            "FROM api_keys GROUP BY tenant_id ORDER BY created_at ASC"
        )
        return [dict(row) for row in cursor.fetchall()]
