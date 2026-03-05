"""
Role-Based Access Control.

Roles:
  admin     — full access including admin endpoints, key management
  developer — ingest + read own tenant's data
  viewer    — read-only access to own tenant's dashboards and traces

JWT-based. Falls back to API key role lookup when no JWT present.
Set TEMPORALLAYR_JWT_SECRET to enable JWT auth.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sqlite3
import threading
import time
from enum import StrEnum
from typing import Any

from fastapi import Depends, HTTPException, Request, status

logger = logging.getLogger(__name__)


class Role(StrEnum):
    ADMIN = "admin"
    DEVELOPER = "developer"
    VIEWER = "viewer"


# Permissions matrix
_PERMISSIONS: dict[Role, set[str]] = {
    Role.ADMIN: {
        "ingest",
        "read",
        "write",
        "admin",
        "rotate_keys",
        "manage_tenants",
        "view_audit_log",
    },
    Role.DEVELOPER: {
        "ingest",
        "read",
        "write",
    },
    Role.VIEWER: {
        "read",
    },
}


def has_permission(role: Role, permission: str) -> bool:
    return permission in _PERMISSIONS.get(role, set())


# ── Simple JWT (no external dep, HMAC-SHA256) ─────────────────────────


def _b64url_encode(data: bytes) -> str:
    import base64

    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    import base64

    padding = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * padding)


def create_jwt(payload: dict[str, Any], secret: str, expires_in: int = 3600) -> str:
    """Create a signed JWT token. expires_in is seconds from now."""
    import hmac

    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload_data = {**payload, "exp": int(time.time()) + expires_in, "iat": int(time.time())}
    body = _b64url_encode(json.dumps(payload_data).encode())
    sig = _b64url_encode(
        hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    )
    return f"{header}.{body}.{sig}"


def verify_jwt(token: str, secret: str) -> dict[str, Any]:
    """Verify and decode a JWT token. Raises ValueError on failure."""
    import hmac

    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")

    header_b64, body_b64, sig_b64 = parts
    expected_sig = _b64url_encode(
        hmac.new(secret.encode(), f"{header_b64}.{body_b64}".encode(), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(sig_b64, expected_sig):
        raise ValueError("JWT signature invalid")

    payload = json.loads(_b64url_decode(body_b64))
    if payload.get("exp", 0) < int(time.time()):
        raise ValueError("JWT expired")

    return payload


def issue_admin_jwt(user_id: str, secret: str, expires_in: int = 3600) -> str:
    """Issue a JWT for an admin user (role=admin)."""
    return create_jwt({"sub": user_id, "role": Role.ADMIN.value}, secret, expires_in)


def issue_service_token(tenant_id: str, secret: str, expires_in: int = 86400) -> str:
    """Issue a service JWT for a tenant (role=developer, carries tenant claim)."""
    return create_jwt(
        {"sub": f"svc:{tenant_id}", "role": Role.DEVELOPER.value, "tenant": tenant_id},
        secret,
        expires_in,
    )


# ── Role storage (in-memory + SQLite backed) ──────────────────────────

_rbac_lock = threading.Lock()
_RBAC_DB: str | None = None


def _rbac_db() -> sqlite3.Connection:
    global _RBAC_DB
    if _RBAC_DB is None:
        data_dir = os.getenv("TEMPORALLAYR_DATA_DIR", ".temporallayr")
        os.makedirs(data_dir, exist_ok=True)
        _RBAC_DB = os.path.join(data_dir, "rbac.db")
    conn = sqlite3.connect(_RBAC_DB, check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS key_roles (
            key_hash   TEXT PRIMARY KEY,
            tenant_id  TEXT NOT NULL,
            role       TEXT NOT NULL DEFAULT 'developer',
            created_at REAL DEFAULT (unixepoch())
        )
    """)
    conn.commit()
    return conn


def set_key_role(key: str, tenant_id: str, role: Role) -> None:
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    with _rbac_lock:
        conn = _rbac_db()
        conn.execute(
            "INSERT INTO key_roles (key_hash, tenant_id, role) VALUES (?,?,?) "
            "ON CONFLICT(key_hash) DO UPDATE SET role=excluded.role",
            (key_hash, tenant_id, role.value),
        )
        conn.commit()
        conn.close()


def get_key_role(key: str) -> Role:
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    with _rbac_lock:
        conn = _rbac_db()
        row = conn.execute("SELECT role FROM key_roles WHERE key_hash=?", (key_hash,)).fetchone()
        conn.close()
    if row:
        return Role(row[0])
    return Role.DEVELOPER  # default role


# ── FastAPI dependencies ───────────────────────────────────────────────


def require_permission(permission: str):
    """
    Decorator factory for FastAPI endpoints.

    Usage:
        @app.get("/admin/things")
        async def admin_endpoint(
            _: None = Depends(require_permission("admin"))
        ):
    """

    async def _check(request: Request) -> None:
        # Try JWT first
        jwt_secret = os.getenv("TEMPORALLAYR_JWT_SECRET")
        if jwt_secret:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
                try:
                    payload = verify_jwt(token, jwt_secret)
                    role = Role(payload.get("role", "viewer"))
                    if not has_permission(role, permission):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Role '{role}' lacks permission '{permission}'",
                        )
                    return
                except ValueError as e:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=str(e),
                    ) from e

        # Fall back to API key role lookup
        from temporallayr.server.auth import _strip_bearer

        auth_header = request.headers.get("Authorization", "")
        key = _strip_bearer(auth_header)
        if key:
            role = get_key_role(key)
            if not has_permission(role, permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role '{role}' lacks permission '{permission}'",
                )

    return Depends(_check)
