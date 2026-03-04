"""Unit tests for tenant quota system — proper isolation via unique tenant IDs."""

import os
import uuid

import pytest

os.environ["TEMPORALLAYR_DATA_DIR"] = "/tmp/tl-quota-test"
os.environ["TEMPORALLAYR_DEFAULT_QUOTA"] = "10"

from temporallayr.core.quotas import (
    check_quota,
    get_usage_today,
    record_spans,
    set_tenant_quota,
)


def _tenant(prefix: str) -> str:
    """Generate a unique tenant ID per test call to avoid SQLite state bleed."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def test_fresh_tenant_is_allowed():
    tenant = _tenant("fresh")
    allowed, info = check_quota(tenant)
    assert allowed
    assert info["status"] == "ok"
    assert info["spans_today"] == 0


def test_records_and_checks():
    tenant = _tenant("records")
    record_spans(tenant, 5)
    used = get_usage_today(tenant)
    assert used == 5


def test_blocks_when_exceeded():
    tenant = _tenant("exceeded")
    # Default quota is 10 from env above
    record_spans(tenant, 10)
    allowed, info = check_quota(tenant)
    assert not allowed
    assert info["status"] == "quota_exceeded"


def test_warning_at_80pct():
    tenant = _tenant("warning")
    record_spans(tenant, 8)  # 80% of 10
    allowed, info = check_quota(tenant)
    assert allowed, f"Expected allowed=True but info={info}"
    assert info["status"] == "warning"


def test_custom_quota():
    tenant = _tenant("custom")
    set_tenant_quota(tenant, 1000)
    record_spans(tenant, 500)
    allowed, info = check_quota(tenant)
    assert allowed
    assert info["quota"] == 1000
    assert info["pct"] == 50.0
