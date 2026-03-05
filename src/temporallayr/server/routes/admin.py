"""
Dedicated admin router — JWT auth, token issuance, and audit endpoints.

Endpoints protected with require_permission() accept either:
  - Bearer <JWT>  (issued by POST /admin/token)
  - X-Admin-Key   (static env key, used by existing admin endpoints in app.py)
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from temporallayr.server.auth import verify_admin_key
from temporallayr.server.rbac import (
    issue_admin_jwt,
    issue_service_token,
    require_permission,
)

router = APIRouter(tags=["admin"])


# ── Token issuance ──────────────────────────────────────────────────────


class TokenRequest(BaseModel):
    user_id: str | None = None
    tenant_id: str | None = None
    expires_in: int = 3600  # seconds


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    role: str


@router.post("/admin/token", response_model=TokenResponse, tags=["admin"])
async def issue_token(
    req: TokenRequest,
    _: None = Depends(verify_admin_key),
) -> TokenResponse:
    """
    Issue a JWT for an admin user or a service token for a tenant.

    - Supply `user_id` to get an **admin JWT** (role=admin).
    - Supply `tenant_id` to get a **service token** (role=developer, bound to tenant).
    - Requires `TEMPORALLAYR_JWT_SECRET` env var to be set.
    """
    secret = os.getenv("TEMPORALLAYR_JWT_SECRET", "")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT issuance requires TEMPORALLAYR_JWT_SECRET env var.",
        )

    if req.user_id:
        token = issue_admin_jwt(req.user_id, secret, req.expires_in)
        role = "admin"
    elif req.tenant_id:
        token = issue_service_token(req.tenant_id, secret, req.expires_in)
        role = "developer"
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either user_id (admin JWT) or tenant_id (service token).",
        )

    return TokenResponse(access_token=token, expires_in=req.expires_in, role=role)


# ── Audit chain (JWT-guarded) ───────────────────────────────────────────


@router.get("/admin/audit-verify", tags=["admin"])
async def audit_verify(
    _: None = require_permission("view_audit_log"),
) -> dict[str, Any]:
    """
    Verify the integrity of the entire cryptographic audit chain.
    Alias for /admin/audit-chain/verify, accessible via JWT Bearer token.
    """
    from temporallayr.core.audit_chain import verify

    is_valid, broken_at = verify()
    return {
        "valid": is_valid,
        "broken_at_seq": broken_at,
        "message": "Chain intact" if is_valid else f"Chain broken at seq {broken_at}",
    }


@router.get("/admin/audit-entries", tags=["admin"])
async def list_audit_entries(
    limit: int = 100,
    offset: int = 0,
    tenant_id: str | None = None,
    _: None = require_permission("view_audit_log"),
) -> dict[str, Any]:
    """Paginated audit log, protected by JWT require_permission('view_audit_log')."""
    from temporallayr.core.audit_chain import get_entries

    entries = get_entries(tenant_id=tenant_id, limit=limit, offset=offset)
    return {"items": entries, "total": len(entries), "limit": limit, "offset": offset}


@router.get("/admin/audit-proof/{entry_hash}", tags=["admin"])
async def audit_entry_proof(
    entry_hash: str,
    _: None = require_permission("view_audit_log"),
) -> dict[str, Any]:
    """Export cryptographic proof-of-existence for an audit entry (JWT-guarded)."""
    from temporallayr.core.audit_chain import export_proof

    proof = export_proof(entry_hash)
    if not proof:
        raise HTTPException(status_code=404, detail="Entry not found")
    return proof
