#!/usr/bin/env python3
"""
Test Results Reporting for TemporalLayr CI.

Provides utilities for reporting test results to various backends.
"""

import json
import logging
import os
import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

TestStatus = Literal["OK", "FAILED", "SKIPPED", "TIMEOUT", "ERROR", "UNKNOWN"]


@dataclass
class TestResult:
    """Represents a single test result."""

    name: str
    status: TestStatus = "UNKNOWN"
    time: float | None = None
    raw_logs: str = ""
    report_url: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "time": self.time,
            "raw_logs": self.raw_logs[: 32 * 1024] if self.raw_logs else "",
            "report_url": self.report_url,
        }


@dataclass
class TestResults:
    """Collection of test results."""

    results: list[TestResult] = field(default_factory=list)

    def append(self, result: TestResult) -> None:
        self.results.append(result)

    def get_status(self) -> TestStatus:
        """Get overall status based on all results."""
        if not self.results:
            return "UNKNOWN"
        if any(r.status == "FAILED" for r in self.results):
            return "FAILED"
        if any(r.status == "TIMEOUT" for r in self.results):
            return "TIMEOUT"
        if any(r.status == "ERROR" for r in self.results):
            return "ERROR"
        if any(r.status == "SKIPPED" for r in self.results):
            return "SKIPPED"
        return "OK"

    def total_time(self) -> float:
        """Get total time of all tests."""
        return sum(r.time or 0 for r in self.results)

    def to_json(self) -> str:
        return json.dumps([r.to_dict() for r in self.results], indent=2)


class TestResultsReporter:
    """Handles reporting test results to various backends."""

    def __init__(self, report_url: str = ""):
        self.report_url = report_url or os.getenv("REPORT_URL", "")
        self.results: TestResults = TestResults()

    def add_result(
        self,
        name: str,
        status: TestStatus,
        time: float | None = None,
        raw_logs: str = "",
    ) -> None:
        """Add a test result."""
        self.results.append(
            TestResult(
                name=name,
                status=status,
                time=time,
                raw_logs=raw_logs,
                report_url=self.report_url,
            )
        )

    def add_results(self, results: list[TestResult]) -> None:
        """Add multiple test results."""
        self.results.results.extend(results)

    def report_to_clickhouse(
        self,
        ch_host: str,
        ch_database: str = "default",
        ch_table: str = "test_results",
    ) -> bool:
        """Report results to ClickHouse."""
        try:
            import clickhouse_connect

            client = clickhouse_connect.get_client(
                host=ch_host,
                database=ch_database,
            )

            rows = []
            for result in self.results.results:
                rows.append(
                    {
                        "test_name": result.name,
                        "test_status": result.status,
                        "test_duration_ms": int((result.time or 0) * 1000),
                        "test_logs": result.raw_logs[: 32000],
                        "report_url": result.report_url,
                        "run_time": datetime.now().isoformat(),
                    }
                )

            if rows:
                client.insert(ch_table, rows)
                logging.info(f"Reported {len(rows)} test results to ClickHouse")
                return True
        except Exception as e:
            logging.error(f"Failed to report to ClickHouse: {e}")
        return False

    def report_to_json(self, path: Path) -> bool:
        """Report results to JSON file."""
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w") as f:
                f.write(self.results.to_json())
            return True
        except Exception as e:
            logging.error(f"Failed to write JSON report: {e}")
        return False

    def print_summary(self) -> None:
        """Print a summary of test results."""
        status_counts: dict[TestStatus, int] = {}
        for result in self.results.results:
            status_counts[result.status] = status_counts.get(result.status, 0) + 1

        print("\n" + "=" * 60)
        print("TEST RESULTS SUMMARY")
        print("=" * 60)
        print(f"Total tests: {len(self.results.results)}")
        print(f"Total time: {self.results.total_time():.2f}s")
        print("-" * 60)
        for status, count in sorted(status_counts.items()):
            print(f"  {status}: {count}")
        print("=" * 60)


def run_tests_with_report(
    test_paths: list[str],
    report_format: str = "json",
    report_path: Path | None = None,
) -> TestResults:
    """Run pytest and collect results."""
    reporter = TestResultsReporter()

    cmd = ["pytest", "-v", "--tb=short", "--timeout=300"]
    if report_format == "json":
        cmd.append("--json-report")
        if report_path:
            cmd.append(f"--json-report-file={report_path}")

    cmd.extend(test_paths)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=3600,
        )

        # Parse output for test results
        for line in result.stdout.split("\n"):
            if "PASSED" in line:
                parts = line.split("PASSED")
                if len(parts) > 1:
                    name = parts[0].strip().split("::")[-1]
                    reporter.add_result(name, "OK")
            elif "FAILED" in line:
                parts = line.split("FAILED")
                if len(parts) > 1:
                    name = parts[0].strip().split("::")[-1]
                    reporter.add_result(name, "FAILED")
            elif "SKIPPED" in line:
                parts = line.split("SKIPPED")
                if len(parts) > 1:
                    name = parts[0].strip().split("::")[-1]
                    reporter.add_result(name, "SKIPPED")

        if result.returncode != 0:
            reporter.add_result(
                "pytest_exit", "ERROR", raw_logs=result.stderr[:10000]
            )

    except subprocess.TimeoutExpired:
        reporter.add_result("pytest_timeout", "TIMEOUT")
    except Exception as e:
        reporter.add_result("pytest_exception", "ERROR", raw_logs=str(e))

    return reporter.results
