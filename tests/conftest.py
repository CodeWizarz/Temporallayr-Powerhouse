"""Pytest shared config for TemporalLayr tests."""
from __future__ import annotations

import os
import pytest

# Set test env vars before anything imports config
os.environ.setdefault("TEMPORALLAYR_TENANT_ID", "ci-tenant")
os.environ.setdefault("TEMPORALLAYR_API_KEY", "ci-test-key")
os.environ.setdefault("TEMPORALLAYR_ADMIN_KEY", "ci-admin-key")
os.environ.setdefault("TEMPORALLAYR_DATA_DIR", "/tmp/temporallayr-test")


def pytest_runtest_setup(item: pytest.Item) -> None:
    del item
    # Reset SDK state between tests
    from temporallayr import sdk_api
    sdk_api._runtime_var.set(None)
    sdk_api._trace_var.set(None)
    sdk_api._span_stack_var.set(())
    # Reset recorder context
    from temporallayr.core.recorder import _current_graph, _current_parent_id
    _current_graph.set(None)
    _current_parent_id.set(None)
