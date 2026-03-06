"""Enterprise API Key Management — stored in PostgreSQL for persistence across deploys."""

from __future__ import annotations

import hashlib
import logging
import secrets
from typing import Any

logger = logging.getLogger(__name__)


def generate_api_key() -> str:
    """Generate a new random API key."""
    import base64

    raw_bytes = secrets.token_bytes(32)
    return base64.urlsafe_b64encode(raw_bytes).decode("utf-8").rstrip("=")


def _hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


async def _get_pool():
    from temporallayr.core.store_postgres import _get_pool

    return await _get_pool()


def map_api_key_to_tenant(api_key: str, tenant_id: str) -> None:
    """Store a new API key → tenant mapping in Postgres."""
    import asyncio

    key_hash = _hash_api_key(api_key)
    key_id = secrets.token_hex(16)

    async def _insert():
        pool = await _get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO api_keys (id, key_hash, tenant_id) VALUES ($1, $2, $3) "
                "ON CONFLICT (key_hash) DO UPDATE SET tenant_id = EXCLUDED.tenant_id",
                key_id,
                key_hash,
                tenant_id,
            )

    try:
        loop = asyncio.get_running_loop()
        asyncio.ensure_future(_insert(), loop=loop)
    except RuntimeError:
        asyncio.run(_insert())


async def validate_api_key_async(api_key: str) -> str | None:
    """Look up API key in Postgres asynchronously. Returns tenant_id or None."""
    key_hash = _hash_api_key(api_key)

    try:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT tenant_id FROM api_keys WHERE key_hash = $1", key_hash
            )
        return row["tenant_id"] if row else None
    except Exception as e:
        logger.warning("API key lookup failed", extra={"error": str(e)})
        return None


def validate_api_key(api_key: str) -> str | None:
    """Look up API key in Postgres (sync). Returns tenant_id or None."""
    import asyncio

    key_hash = _hash_api_key(api_key)

    async def _lookup() -> str | None:
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT tenant_id FROM api_keys WHERE key_hash = $1", key_hash
                )
            return row["tenant_id"] if row else None
        except Exception as e:
            logger.warning("API key lookup failed", extra={"error": str(e)})
            return None

    try:
        loop = asyncio.get_running_loop()
        import concurrent.futures

        future = asyncio.run_coroutine_threadsafe(_lookup(), loop)
        return future.result(timeout=5)
    except RuntimeError:
        return asyncio.run(_lookup())


async def revoke_keys_for_tenant_async(tenant_id: str) -> int:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM api_keys WHERE tenant_id = $1", tenant_id)
    return int(result.split()[-1])


def revoke_keys_for_tenant(tenant_id: str) -> int:
    import asyncio

    async def _revoke() -> int:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute("DELETE FROM api_keys WHERE tenant_id = $1", tenant_id)
        return int(result.split()[-1])

    try:
        loop = asyncio.get_running_loop()
        import concurrent.futures

        future = asyncio.run_coroutine_threadsafe(_revoke(), loop)
        return future.result(timeout=5)
    except RuntimeError:
        return asyncio.run(_revoke())


async def list_keys_for_tenant_async(tenant_id: str) -> list[dict[str, Any]]:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, tenant_id, created_at FROM api_keys "
            "WHERE tenant_id = $1 ORDER BY created_at DESC",
            tenant_id,
        )
    return [dict(r) for r in rows]


def list_keys_for_tenant(tenant_id: str) -> list[dict[str, Any]]:
    import asyncio

    async def _list() -> list[dict[str, Any]]:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT id, tenant_id, created_at FROM api_keys "
                "WHERE tenant_id = $1 ORDER BY created_at DESC",
                tenant_id,
            )
        return [dict(r) for r in rows]

    try:
        loop = asyncio.get_running_loop()
        import concurrent.futures

        future = asyncio.run_coroutine_threadsafe(_list(), loop)
        return future.result(timeout=5)
    except RuntimeError:
        return asyncio.run(_list())


async def list_all_tenants_async() -> list[dict[str, Any]]:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT tenant_id, COUNT(*) as key_count, MIN(created_at) as created_at "
            "FROM api_keys GROUP BY tenant_id ORDER BY created_at DESC"
        )
    return [dict(r) for r in rows]


def list_all_tenants() -> list[dict[str, Any]]:
    import asyncio

    async def _list() -> list[dict[str, Any]]:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT tenant_id, COUNT(*) as key_count, MIN(created_at) as created_at "
                "FROM api_keys GROUP BY tenant_id ORDER BY created_at DESC"
            )
        return [dict(r) for r in rows]

    try:
        loop = asyncio.get_running_loop()
        import concurrent.futures

        future = asyncio.run_coroutine_threadsafe(_list(), loop)
        return future.result(timeout=5)
    except RuntimeError:
        return asyncio.run(_list())
