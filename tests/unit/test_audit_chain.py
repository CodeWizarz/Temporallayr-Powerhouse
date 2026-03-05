"""Unit tests for cryptographic audit chain."""

import os

import pytest

os.environ["TEMPORALLAYR_DATA_DIR"] = "/tmp/tl-audit-test"

from temporallayr.core.audit_chain import AuditChain


def test_chain_appends_and_verifies():
    chain = AuditChain()
    chain.append("test.event", {"key": "value"}, tenant_id="t1")
    chain.append("test.event2", {"key": "value2"}, tenant_id="t1")
    valid, broken = chain.verify()
    assert valid
    assert broken is None


def test_chain_returns_hash():
    chain = AuditChain()
    h = chain.append("test.hash", {}, tenant_id="t2")
    assert len(h) == 64  # SHA-256 hex
    assert all(c in "0123456789abcdef" for c in h)


def test_proof_export():
    chain = AuditChain()
    h = chain.append("test.proof", {"agent": "risk-model", "decision": "REJECT"}, tenant_id="t3")
    proof = chain.export_proof(h)
    assert proof is not None
    assert proof["entry_hash"] == h
    assert proof["payload"]["decision"] == "REJECT"
    assert proof["verified"] is True


def test_missing_proof_returns_none():
    chain = AuditChain()
    proof = chain.export_proof("a" * 64)
    assert proof is None


def test_get_entries_tenant_filtered():
    chain = AuditChain()
    chain.append("ev.a", {}, tenant_id="tenant-x")
    chain.append("ev.b", {}, tenant_id="tenant-y")
    entries_x = chain.get_entries(tenant_id="tenant-x")
    assert all(e["tenant_id"] == "tenant-x" for e in entries_x)


def test_rbac_permissions():
    from temporallayr.server.rbac import Role, has_permission

    assert has_permission(Role.ADMIN, "admin")
    assert has_permission(Role.ADMIN, "ingest")
    assert has_permission(Role.DEVELOPER, "ingest")
    assert not has_permission(Role.DEVELOPER, "admin")
    assert has_permission(Role.VIEWER, "read")
    assert not has_permission(Role.VIEWER, "ingest")


def test_jwt_roundtrip():
    from temporallayr.server.rbac import create_jwt, verify_jwt

    token = create_jwt(
        {"sub": "usr_123", "role": "developer", "tenant": "acme"}, secret="test-secret"
    )
    payload = verify_jwt(token, "test-secret")
    assert payload["sub"] == "usr_123"
    assert payload["role"] == "developer"


def test_jwt_wrong_secret_fails():
    from temporallayr.server.rbac import create_jwt, verify_jwt

    token = create_jwt({"sub": "usr_123"}, secret="real-secret")
    with pytest.raises(ValueError, match="signature"):
        verify_jwt(token, "wrong-secret")
