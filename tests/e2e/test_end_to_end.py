from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path
from uuid import uuid4

import httpx
import pytest

pytestmark = [
    pytest.mark.e2e,
    pytest.mark.external,
    pytest.mark.postgres,
    pytest.mark.clickhouse,
]


def _compose(*args: str, env: dict[str, str]) -> None:
    command = ["docker", "compose", "-f", "docker-compose.yml", *args]
    subprocess.run(command, check=True, env=env, cwd=Path(__file__).resolve().parents[2])


def _wait_for_health(base_url: str, timeout_seconds: int = 180) -> None:
    deadline = time.time() + timeout_seconds
    last_error = ""
    while time.time() < deadline:
        try:
            response = httpx.get(f"{base_url}/health", timeout=5.0)
            if response.status_code == 200:
                return
            last_error = f"status={response.status_code} body={response.text}"
        except Exception as exc:
            last_error = str(exc)
        time.sleep(2)
    raise AssertionError(f"Server health did not become ready: {last_error}")


@pytest.mark.skipif(
    (
        os.getenv("TEMPORALLAYR_RUN_EXTERNAL_TESTS") != "1"
        or os.getenv("TEMPORALLAYR_RUN_E2E_DOCKER") != "1"
        or shutil.which("docker") is None
    ),
    reason="Set TEMPORALLAYR_RUN_EXTERNAL_TESTS=1 and TEMPORALLAYR_RUN_E2E_DOCKER=1 with Docker installed.",
)
def test_end_to_end_docker_compose_replay_is_deterministic() -> None:
    env = os.environ.copy()
    env.update(
        {
            "TEMPORALLAYR_API_KEY": "e2e-key",
            "TEMPORALLAYR_ADMIN_KEY": "e2e-admin",
            "TEMPORALLAYR_TENANT_ID": "e2e-tenant",
            "TEMPORALLAYR_API_KEYS": "e2e-key=e2e-tenant",
            "TEMPORALLAYR_POSTGRES_DSN": "postgresql://temporallayr:temporallayr@postgres:5432/temporallayr",
            "TEMPORALLAYR_CLICKHOUSE_HOST": "clickhouse",
            "TEMPORALLAYR_CLICKHOUSE_PORT": "8123",
            "TEMPORALLAYR_CLICKHOUSE_SECURE": "false",
        }
    )

    base_url = "http://127.0.0.1:8000"

    try:
        _compose(
            "--profile",
            "local-clickhouse",
            "--profile",
            "local-postgres",
            "up",
            "-d",
            "--build",
            "postgres",
            "clickhouse",
            "temporallayr",
            env=env,
        )
        _wait_for_health(base_url)

        trace_id = f"e2e-trace-{uuid4()}"
        ingest_payload = {
            "events": [
                {
                    "trace_id": trace_id,
                    "tenant_id": "e2e-tenant",
                    "spans": [
                        {
                            "span_id": "e2e-span-1",
                            "name": "tool:urlencode",
                            "attributes": {
                                "code": {"module": "urllib.parse", "name": "urlencode"},
                                "inputs": {"query": {"a": "1"}},
                                "output": "a=1",
                            },
                        }
                    ],
                }
            ]
        }

        headers = {"Authorization": "Bearer e2e-key", "Content-Type": "application/json"}

        ingest_response = httpx.post(
            f"{base_url}/v1/ingest",
            json=ingest_payload,
            headers=headers,
            timeout=20.0,
        )
        assert ingest_response.status_code == 202, ingest_response.text

        replay_response = None
        for _ in range(40):
            replay_response = httpx.post(
                f"{base_url}/executions/{trace_id}/replay",
                headers=headers,
                timeout=20.0,
            )
            if replay_response.status_code == 200:
                break
            time.sleep(1)

        assert replay_response is not None
        assert replay_response.status_code == 200, replay_response.text
        body = replay_response.json()
        assert body["is_deterministic"] is True
        assert body["divergences_found"] == 0
    finally:
        _compose(
            "--profile",
            "local-clickhouse",
            "--profile",
            "local-postgres",
            "down",
            "-v",
            env=env,
        )
