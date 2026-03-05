import os
import tempfile
from datetime import UTC, datetime, timedelta

import pytest

from temporallayr.health.poller import HealthPoller
from temporallayr.health.store import HealthStore


@pytest.fixture
def temp_store():
    with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as f:
        path = f.name

    store = HealthStore(file_path=path)
    yield store

    if os.path.exists(path):
        os.remove(path)


def test_health_store_record_and_get(temp_store):
    temp_store.record_health("postgres", "up")
    temp_store.record_health("clickhouse", "down", error="connection refused")

    history = temp_store.get_history()
    assert len(history) == 2
    assert history[0]["service"] == "postgres"
    assert history[0]["status"] == "up"
    assert "error" not in history[0]

    assert history[1]["service"] == "clickhouse"
    assert history[1]["status"] == "down"
    assert history[1]["error"] == "connection refused"


def test_health_store_compaction(temp_store):
    # Add a very old record manually
    old_date = datetime.now(UTC) - timedelta(days=35)
    temp_store._cache.append(
        {"timestamp": old_date.isoformat(), "service": "postgres", "status": "up"}
    )

    # Add a recent record
    recent_date = datetime.now(UTC) - timedelta(days=5)
    temp_store._cache.append(
        {"timestamp": recent_date.isoformat(), "service": "postgres", "status": "up"}
    )

    temp_store._save()

    # Compact to 30 days
    temp_store.compact(days=30)

    history = temp_store.get_history()
    assert len(history) == 1
    assert history[0]["timestamp"] == recent_date.isoformat()


@pytest.mark.asyncio
async def test_health_poller():
    # We will just test the registration and a single poll execution manually
    poller = HealthPoller(interval_seconds=1)

    async def mock_pass():
        return True

    async def mock_fail():
        raise ValueError("Timeout")

    poller.register_check("service_a", mock_pass)
    poller.register_check("service_b", mock_fail)

    # Run the loop logic once manually for testing the effect on the store
    # We will mock the get_health_store so it uses our temp store usually,
    # but for this test, we can just use the global one and clear it, or mock it.
    from unittest.mock import patch

    with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as f:
        path = f.name
    test_store = HealthStore(file_path=path)

    with patch("temporallayr.health.poller.get_health_store", return_value=test_store):
        poller.running = True

        # We simulate the inner part of _poll_loop
        for service, check_func in poller._checks.items():
            try:
                is_healthy = await check_func()
                status = "up" if is_healthy else "down"
                test_store.record_health(service, status)
            except Exception as e:
                test_store.record_health(service, "down", error=str(e))

        history = test_store.get_history()
        assert len(history) == 2

        a_record = next(r for r in history if r["service"] == "service_a")
        b_record = next(r for r in history if r["service"] == "service_b")

        assert a_record["status"] == "up"
        assert b_record["status"] == "down"
        assert b_record["error"] == "Timeout"

    if os.path.exists(path):
        os.remove(path)
