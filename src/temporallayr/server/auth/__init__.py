"""
API Key authentication middleware for multi-tenant isolation.
"""

import os
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from temporallayr.config import get_config

security = HTTPBearer()


def get_api_keys() -> dict[str, str]:
    """
    Dynamically loads API Key to Tenant ID mappings.
    Format: KEY=TENANT,KEY2=TENANT2
    """
    keys_str = os.getenv(
        "TEMPORALLAYR_API_KEYS", "key_live_default123=default,key_test_demo123=demo_tenant"
    )
    key_map = {}
    if keys_str:
        for pair in keys_str.split(","):
            if "=" in pair:
                k, v = pair.split("=", 1)
                key_map[k.strip()] = v.strip()
    return key_map


CredentialsDep = Annotated[HTTPAuthorizationCredentials, Depends(security)]


async def verify_api_key(credentials: CredentialsDep) -> str:
    """
    Validate the incoming Bearer token and map it directly to an isolated tenant_id.
    Ensures that unauthenticated traffic is cleanly rejected natively.
    """
    token = credentials.credentials

    from temporallayr.server.auth.api_keys import validate_api_key

    tenant_id = validate_api_key(token)

    if not tenant_id:
        key_map = get_api_keys()
        tenant_id = key_map.get(token)

    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return tenant_id


async def verify_admin_key(x_admin_key: str = Header(default="")) -> None:
    """
    Validates API key matching server configured admin initialization keys.
    """
    admin_key = get_config().admin_key
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
