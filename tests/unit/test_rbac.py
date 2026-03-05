"""Dedicated unit tests for RBAC roles, JWT issuance, and permission gating."""

from __future__ import annotations

import os
import time

import pytest

os.environ.setdefault("TEMPORALLAYR_DATA_DIR", "/tmp/tl-rbac-test")

from temporallayr.server.rbac import (  # noqa: E402
    Role,
    create_jwt,
    get_key_role,
    has_permission,
    issue_admin_jwt,
    issue_service_token,
    set_key_role,
    verify_jwt,
)

_SECRET = "test-rbac-secret"


# ── Permission matrix ────────────────────────────────────────────────────


class TestPermissions:
    def test_admin_has_all_permissions(self):
        for perm in ("ingest", "read", "write", "admin", "rotate_keys", "view_audit_log"):
            assert has_permission(Role.ADMIN, perm), f"admin should have '{perm}'"

    def test_developer_permissions(self):
        assert has_permission(Role.DEVELOPER, "ingest")
        assert has_permission(Role.DEVELOPER, "read")
        assert has_permission(Role.DEVELOPER, "write")
        assert not has_permission(Role.DEVELOPER, "admin")
        assert not has_permission(Role.DEVELOPER, "view_audit_log")

    def test_viewer_permissions(self):
        assert has_permission(Role.VIEWER, "read")
        assert not has_permission(Role.VIEWER, "ingest")
        assert not has_permission(Role.VIEWER, "write")
        assert not has_permission(Role.VIEWER, "admin")

    def test_unknown_permission_returns_false(self):
        assert not has_permission(Role.ADMIN, "nonexistent_perm")


# ── JWT token issuance ───────────────────────────────────────────────────


class TestAdminJwt:
    def test_issue_admin_jwt_has_correct_role(self):
        token = issue_admin_jwt("user_abc", _SECRET)
        payload = verify_jwt(token, _SECRET)
        assert payload["sub"] == "user_abc"
        assert payload["role"] == "admin"

    def test_issue_admin_jwt_has_expiry(self):
        token = issue_admin_jwt("user_abc", _SECRET, expires_in=3600)
        payload = verify_jwt(token, _SECRET)
        assert payload["exp"] > int(time.time())

    def test_issue_service_token_has_correct_role_and_tenant(self):
        token = issue_service_token("acme-corp", _SECRET)
        payload = verify_jwt(token, _SECRET)
        assert payload["role"] == "developer"
        assert payload["tenant"] == "acme-corp"
        assert payload["sub"] == "svc:acme-corp"

    def test_service_token_longer_expiry_than_admin(self):
        now = int(time.time())
        admin_tok = issue_admin_jwt("u", _SECRET, expires_in=3600)
        svc_tok = issue_service_token("t", _SECRET, expires_in=86400)
        admin_exp = verify_jwt(admin_tok, _SECRET)["exp"]
        svc_exp = verify_jwt(svc_tok, _SECRET)["exp"]
        assert svc_exp > admin_exp
        assert admin_exp > now


# ── JWT verify / failure cases ───────────────────────────────────────────


class TestJwtVerify:
    def test_wrong_secret_raises(self):
        token = create_jwt({"sub": "x"}, "real-secret")
        with pytest.raises(ValueError, match="signature"):
            verify_jwt(token, "wrong-secret")

    def test_expired_token_raises(self):
        token = create_jwt({"sub": "x"}, _SECRET, expires_in=-1)
        with pytest.raises(ValueError, match="expired"):
            verify_jwt(token, _SECRET)

    def test_malformed_token_raises(self):
        with pytest.raises(ValueError, match="Invalid JWT"):
            verify_jwt("not.a.valid.jwt.structure.here", _SECRET)

    def test_roundtrip_preserves_custom_claims(self):
        token = create_jwt({"sub": "u1", "tenant": "megacorp", "role": "viewer"}, _SECRET)
        payload = verify_jwt(token, _SECRET)
        assert payload["tenant"] == "megacorp"
        assert payload["role"] == "viewer"


# ── SQLite key-role persistence ──────────────────────────────────────────


class TestKeyRole:
    def test_set_and_get_role(self):
        set_key_role("test-api-key-001", "tenant-alpha", Role.ADMIN)
        role = get_key_role("test-api-key-001")
        assert role == Role.ADMIN

    def test_default_role_for_unknown_key(self):
        role = get_key_role("key-that-does-not-exist-xyz")
        assert role == Role.DEVELOPER  # documented default

    def test_role_update(self):
        set_key_role("test-api-key-002", "tenant-beta", Role.VIEWER)
        assert get_key_role("test-api-key-002") == Role.VIEWER
        set_key_role("test-api-key-002", "tenant-beta", Role.DEVELOPER)
        assert get_key_role("test-api-key-002") == Role.DEVELOPER
