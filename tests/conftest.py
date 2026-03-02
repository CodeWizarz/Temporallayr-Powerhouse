"""Pytest shared configuration for TemporalLayr tests."""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from _pytest.config import Config
from _pytest.config.argparsing import Parser


def pytest_runtest_setup(item: pytest.Item) -> None:
    del item
    from temporallayr import sdk_api

    sdk_api._runtime_var.set(None)
    sdk_api._trace_var.set(None)
    sdk_api._span_stack_var.set(())
