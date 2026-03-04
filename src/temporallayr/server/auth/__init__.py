"""API Key authentication middleware for multi-tenant isolation."""

from __future__ import annotations

import os
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer()
CredentialsDep = Annotated[HTTPAuthorizationCredentials, Depends(security)]


def _strip_bearer(token: str) -> str:
    """Strip 'Bearer ' prefix if accidentally included in token string."""
    if token.lower().startswith("bearer "):
        return token[7:]
    return token


async def verify_api_key(credentials: CredentialsDep) -> str:
    """
    Validate Bearer token → return bound tenant_id.
    Strips 'Bearer ' prefix before hashing to prevent lookup failures.
    """
    raw_token = _strip_bearer(credentials.credentials)

    from temporallayr.server.auth.api_keys import validate_api_key
    tenant_id = validate_api_key(raw_token)

    if not tenant_id:
        # Fallback: env-based static key map (dev convenience)
        keys_str = os.getenv("TEMPORALLAYR_API_KEYS", "")
        for pair in keys_str.split(","):
            if "=" in pair:
                k, v = pair.split("=", 1)
                if k.strip() == raw_token:
                    tenant_id = v.strip()
                    break

    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return tenant_id


async def verify_admin_key(x_admin_key: str = Header(default="")) -> None:
    """
    Validate X-Admin-Key header for admin-only endpoints.
    Admin key is set via TEMPORALLAYR_ADMIN_KEY env var.
    """
    admin_key = os.getenv("TEMPORALLAYR_ADMIN_KEY", "")
    if not admin_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin operations not configured. Set TEMPORALLAYR_ADMIN_KEY env var.",
        )
    if not x_admin_key or x_admin_key != admin_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin key",
        )
