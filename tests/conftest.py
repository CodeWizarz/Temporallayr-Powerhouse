"""Pytest shared configuration for TemporalLayr tests."""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from _pytest.config import Config
from _pytest.config.argparsing import Parser

import coverage


@dataclass
class CoverageState:
    cov: coverage.Coverage | None = None
    fail_under: int = 0


_STATE = CoverageState()


def pytest_addoption(parser: Parser) -> None:
    parser.addoption(
        "--cov", action="store", default=None, help="Package/module to measure coverage"
    )
    parser.addoption(
        "--cov-fail-under",
        action="store",
        default=None,
        help="Minimum total coverage percentage required",
    )


def pytest_configure(config: Config) -> None:
    cov_target = config.getoption("cov")
    fail_under_raw = config.getoption("cov_fail_under")
    if cov_target:
        _STATE.cov = coverage.Coverage(source=[str(cov_target)])
        _STATE.cov.start()
    if fail_under_raw is not None:
        _STATE.fail_under = int(fail_under_raw)


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    if _STATE.cov is None:
        return

    _STATE.cov.stop()
    _STATE.cov.save()
    percent = _STATE.cov.report(show_missing=True)

    if _STATE.fail_under and percent < _STATE.fail_under:
        session.exitstatus = 1
        print(f"Coverage {percent:.2f}% is below required threshold {_STATE.fail_under}%")


def pytest_runtest_setup(item: pytest.Item) -> None:
    del item
    from temporallayr import sdk_api

    sdk_api._runtime_var.set(None)
    sdk_api._trace_var.set(None)
    sdk_api._span_stack_var.set(())
