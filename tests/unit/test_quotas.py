"""Unit tests for tenant quota system."""

import os, pytest

os.environ["TEMPORALLAYR_DATA_DIR"] = "/tmp/tl-quota-test"
os.environ["TEMPORALLAYR_DEFAULT_QUOTA"] = "10"

from temporallayr.core.quotas import check_quota, record_spans, get_usage_today, set_tenant_quota


def test_fresh_tenant_is_allowed():
    allowed, info = check_quota("quota-test-1")
    assert allowed
    assert info["status"] == "ok"
    assert info["spans_today"] == 0


def test_records_and_checks():
    record_spans("quota-test-2", 5)
    used = get_usage_today("quota-test-2")
    assert used == 5


def test_blocks_when_exceeded():
    # Default quota is 10 from env above
    record_spans("quota-test-3", 10)
    allowed, info = check_quota("quota-test-3")
    assert not allowed
    assert info["status"] == "quota_exceeded"


def test_warning_at_80pct():
    record_spans("quota-test-4", 8)  # 80% of 10
    allowed, info = check_quota("quota-test-4")
    assert allowed  # Still allowed
    assert info["status"] == "warning"


def test_custom_quota():
    set_tenant_quota("quota-test-5", 1000)
    record_spans("quota-test-5", 500)
    allowed, info = check_quota("quota-test-5")
    assert allowed
    assert info["quota"] == 1000
    assert info["pct"] == 50.0
