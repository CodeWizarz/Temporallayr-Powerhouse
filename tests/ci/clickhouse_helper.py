#!/usr/bin/env python3
"""
ClickHouse Helper for TemporalLayr CI.

Provides utilities for inserting test results, metrics, and analytics data
into ClickHouse for CI reporting and analysis.
"""

import fileinput
import json
import logging
import os
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import clickhouse_connect
import requests

from tests.ci.pr_info import PRInfo
from tests.ci.report import TestResults


class CHException(Exception):
    pass


class InsertException(Exception):
    pass


class TemporalLayrClickHouseHelper:
    def __init__(
        self,
        host: str | None = None,
        port: int = 8443,
        database: str = "default",
        username: str = "default",
        password: str = "",
        secure: bool = True,
    ):
        self.host = host or os.getenv("TEMPORALLAYR_CLICKHOUSE_HOST", "localhost")
        self.port = port
        self.database = database
        self.username = username
        self.password = password
        self.secure = secure
        self._client: clickhouse_connect.Client | None = None

    def get_client(self) -> clickhouse_connect.Client:
        if self._client is None:
            self._client = clickhouse_connect.get_client(
                host=self.host,
                port=self.port,
                database=self.database,
                username=self.username,
                password=self.password,
                secure=self.secure,
            )
        return self._client

    @staticmethod
    def insert_file(
        url: str,
        auth: dict[str, str] | None,
        query: str,
        file: Path,
        additional_options: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> None:
        params = {
            "query": query,
            "date_time_input_format": "best_effort",
            "send_logs_level": "warning",
        }
        if additional_options:
            for k, v in additional_options.items():
                params[k] = v

        with open(file, "rb") as data_fd:
            TemporalLayrClickHouseHelper._insert_post(
                url, params=params, data=data_fd, headers=auth, **kwargs
            )

    @staticmethod
    def insert_json_str(url, auth, db, table, json_str):
        params = {
            "database": db,
            "query": f"INSERT INTO {table} FORMAT JSONEachRow",
            "date_time_input_format": "best_effort",
            "send_logs_level": "warning",
        }
        TemporalLayrClickHouseHelper._insert_post(url, params=params, data=json_str, headers=auth)

    @staticmethod
    def _insert_post(*args, **kwargs):
        url = ""
        if args:
            url = args[0]
        url = kwargs.get("url", url)
        timeout = kwargs.pop("timeout", 100)

        for i in range(5):
            try:
                response = requests.post(*args, timeout=timeout, **kwargs)
            except Exception as e:
                error = f"Received exception while sending data to {url} on {i} attempt: {e}"
                logging.warning(error)
                continue

            logging.info("Response content '%s'", response.content)

            if response.ok:
                break

            error = (
                f"Cannot insert data into clickhouse at try {i}: HTTP code "
                f"{response.status_code}: '{response.text}'"
            )

            if response.status_code >= 500:
                time.sleep(1)
                continue

            logging.info(
                "Request headers '%s', body '%s'",
                response.request.headers,
                response.request.body,
            )

            raise InsertException(error)
        else:
            raise InsertException(error)

    def _insert_json_str_info(self, db: str, table: str, json_str: str) -> None:
        client = self.get_client()
        client.command(
            f"INSERT INTO {table} FORMAT JSONEachRow",
            data=json_str,
        )

    def insert_event_into(self, db, table, event, safe=True):
        event_str = json.dumps(event)
        try:
            self._insert_json_str_info(db, table, event_str)
        except InsertException as e:
            logging.error(
                "Exception happened during inserting data into clickhouse: %s", e
            )
            if not safe:
                raise

    def insert_events_into(self, db, table, events, safe=True):
        jsons = []
        for event in events:
            jsons.append(json.dumps(event))

        try:
            self._insert_json_str_info(db, table, ",".join(jsons))
        except InsertException as e:
            logging.error(
                "Exception happened during inserting data into clickhouse: %s", e
            )
            if not safe:
                raise

    def _select_and_get_json_each_row(self, db, query, query_params):
        params = {
            "database": db,
            "query": query,
            "default_format": "JSONEachRow",
        }
        if query_params is not None:
            for name, value in query_params.items():
                params[f"param_{name}"] = str(value)

        client = self.get_client()
        result = client.query(query, parameters=query_params)
        return result.result_rows

    def select_json_each_row(self, db, query, query_params=None):
        rows = self._select_and_get_json_each_row(db, query, query_params)
        return [dict(row) for row in rows]

    def insert_test_result(
        self,
        test_name: str,
        test_status: str,
        test_duration_ms: int,
        tenant_id: str,
        commit_sha: str,
        branch: str,
    ) -> None:
        """Insert a test result into ClickHouse."""
        event = {
            "test_name": test_name,
            "test_status": test_status,
            "test_duration_ms": test_duration_ms,
            "tenant_id": tenant_id,
            "commit_sha": commit_sha,
            "branch": branch,
            "timestamp": datetime.now(UTC).isoformat(),
        }
        self.insert_event_into("temporallayr_test_results", "test_results", event)

    def insert_metric(
        self,
        metric_name: str,
        metric_value: float,
        metric_labels: dict[str, str],
        tenant_id: str,
    ) -> None:
        """Insert a custom metric into ClickHouse."""
        event = {
            "metric_name": metric_name,
            "metric_value": metric_value,
            "metric_labels": json.dumps(metric_labels),
            "tenant_id": tenant_id,
            "timestamp": datetime.now(UTC).isoformat(),
        }
        self.insert_event_into("temporallayr_metrics", "metrics", event)


def prepare_tests_results_for_clickhouse(
    pr_info: PRInfo,
    test_results: TestResults,
    check_status: str,
    check_duration: float,
    check_start_time: str,
    report_url: str,
    check_name: str,
) -> list[dict]:
    """Prepare test results for insertion into ClickHouse."""
    base_ref = pr_info.base_ref
    base_repo = pr_info.base_name
    head_ref = pr_info.head_ref
    head_repo = pr_info.head_name
    pull_request_url = f"https://github.com/temporallayr/temporallayr/commits/{head_ref}"
    if pr_info.number != 0:
        pull_request_url = pr_info.pr_html_url

    common_properties = {
        "pull_request_number": pr_info.number,
        "commit_sha": pr_info.sha,
        "commit_url": pr_info.commit_html_url,
        "check_name": check_name,
        "check_status": check_status,
        "check_duration_ms": int(float(check_duration) * 1000),
        "check_start_time": check_start_time,
        "report_url": report_url,
        "pull_request_url": pull_request_url,
        "base_ref": base_ref,
        "base_repo": base_repo,
        "head_ref": head_ref,
        "head_repo": head_repo,
    }

    result = [common_properties]
    for test_result in test_results.results:
        current_row = common_properties.copy()
        test_name = test_result.name
        test_status = test_result.status

        test_time = test_result.time or 0
        current_row["test_duration_ms"] = int(test_time * 1000)
        current_row["test_name"] = test_name
        current_row["test_status"] = test_status
        if test_result.raw_logs:
            current_row["test_context_raw"] = test_result.raw_logs[: 32 * 1024]
        else:
            current_row["test_context_raw"] = ""
        result.append(current_row)

    return result


class CiLogsCredentials:
    def __init__(self, config_path: Path):
        self.config_path = config_path
        self._host = os.getenv("CLICKHOUSE_CI_LOGS_HOST", "")
        self._password = os.getenv("CLICKHOUSE_CI_LOGS_PASSWORD", "")

    def create_ci_logs_credentials(self) -> None:
        if not (self.host and self.password):
            logging.info(
                "Hostname or password for CI logs instance are unknown, "
                "skipping creating of credentials file, removing existing"
            )
            self.config_path.unlink(missing_ok=True)
            return
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.config_path.write_text(
            f"CLICKHOUSE_CI_LOGS_HOST={self.host}\n"
            "CLICKHOUSE_CI_LOGS_USER=ci\n"
            f"CLICKHOUSE_CI_LOGS_PASSWORD={self.password}\n",
            encoding="utf-8",
        )

    def clean_ci_logs_from_credentials(self, log_path: Path) -> None:
        if not (self.host or self.password):
            logging.info(
                "Hostname and password for CI logs instance are unknown, "
                "skipping cleaning %s",
                log_path,
            )
            return

        def process_line(line: str) -> str:
            if self.host and self.password:
                return line.replace(self.host, "CLICKHOUSE_CI_LOGS_HOST").replace(
                    self.password, "CLICKHOUSE_CI_LOGS_PASSWORD"
                )
            if self.host:
                return line.replace(self.host, "CLICKHOUSE_CI_LOGS_HOST")
            return line.replace(self.password, "CLICKHOUSE_CI_LOGS_PASSWORD")

        with fileinput.input(
            log_path, inplace=True, errors="surrogateescape"
        ) as log_fd:
            for line in log_fd:
                print(process_line(line), end="")

    @property
    def host(self) -> str:
        return self._host

    @property
    def password(self) -> str:
        return self._password
