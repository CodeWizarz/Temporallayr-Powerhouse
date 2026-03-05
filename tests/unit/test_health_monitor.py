"""Unit tests for the HealthMonitor service."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from temporallayr.services.health_monitor import HealthMonitor


class TestHealthMonitorCheckApi:
    @pytest.mark.asyncio
    async def test_check_api_returns_ok(self):
        monitor = HealthMonitor()
        result = await monitor.check_api()
        assert result["status"] == "ok"
        assert result["latency_ms"] >= 0


class TestHealthMonitorCheckRedis:
    @pytest.mark.asyncio
    async def test_redis_unconfigured_when_no_client(self):
        monitor = HealthMonitor()
        with patch("temporallayr.services.health_monitor.get_redis_client", return_value=None):
            result = await monitor.check_redis()
        assert result["status"] == "unconfigured"
        assert result["latency_ms"] == 0

    @pytest.mark.asyncio
    async def test_redis_ok_when_ping_succeeds(self):
        monitor = HealthMonitor()
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(return_value=True)
        mock_client.aclose = AsyncMock()
        with patch(
            "temporallayr.services.health_monitor.get_redis_client", return_value=mock_client
        ):
            result = await monitor.check_redis()
        assert result["status"] == "ok"
        assert result["latency_ms"] >= 0

    @pytest.mark.asyncio
    async def test_redis_down_when_ping_raises(self):
        monitor = HealthMonitor()
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(side_effect=ConnectionError("refused"))
        mock_client.aclose = AsyncMock()
        with patch(
            "temporallayr.services.health_monitor.get_redis_client", return_value=mock_client
        ):
            result = await monitor.check_redis()
        assert result["status"] == "down"
        assert "error" in result


class TestHealthMonitorCheckClickHouse:
    @pytest.mark.asyncio
    async def test_clickhouse_unconfigured_when_no_store(self):
        monitor = HealthMonitor()
        with patch("temporallayr.services.health_monitor.get_clickhouse_store", return_value=None):
            result = await monitor.check_clickhouse()
        assert result["status"] == "unconfigured"

    @pytest.mark.asyncio
    async def test_clickhouse_ok_when_command_succeeds(self):
        monitor = HealthMonitor()
        mock_store = MagicMock()
        mock_client = MagicMock()
        mock_client.command = MagicMock(return_value=1)
        mock_store._get_client = MagicMock(return_value=mock_client)
        with (
            patch(
                "temporallayr.services.health_monitor.get_clickhouse_store", return_value=mock_store
            ),
            patch("asyncio.to_thread", new=AsyncMock(return_value=1)),
        ):
            result = await monitor.check_clickhouse()
        assert result["status"] == "ok"

    @pytest.mark.asyncio
    async def test_clickhouse_degraded_when_command_fails(self):
        monitor = HealthMonitor()
        mock_store = MagicMock()
        mock_store._get_client = MagicMock(side_effect=RuntimeError("connection failed"))
        with patch(
            "temporallayr.services.health_monitor.get_clickhouse_store", return_value=mock_store
        ):
            result = await monitor.check_clickhouse()
        assert result["status"] == "degraded"
        assert "error" in result


class TestHealthMonitorCheckWorkerQueue:
    @pytest.mark.asyncio
    async def test_worker_queue_unconfigured_when_no_client(self):
        monitor = HealthMonitor()
        with patch("temporallayr.services.health_monitor.get_redis_client", return_value=None):
            result = await monitor.check_worker_queue()
        assert result["status"] == "unconfigured"

    @pytest.mark.asyncio
    async def test_worker_queue_ok_when_small(self):
        monitor = HealthMonitor()
        mock_client = AsyncMock()
        mock_client.llen = AsyncMock(return_value=42)
        mock_client.aclose = AsyncMock()
        with patch(
            "temporallayr.services.health_monitor.get_redis_client", return_value=mock_client
        ):
            result = await monitor.check_worker_queue()
        assert result["status"] == "ok"
        assert result["queue_size"] == 42

    @pytest.mark.asyncio
    async def test_worker_queue_backlogged_when_large(self):
        monitor = HealthMonitor()
        mock_client = AsyncMock()
        mock_client.llen = AsyncMock(return_value=99999)
        mock_client.aclose = AsyncMock()
        with patch(
            "temporallayr.services.health_monitor.get_redis_client", return_value=mock_client
        ):
            result = await monitor.check_worker_queue()
        assert result["status"] == "backlogged"
        assert result["queue_size"] == 99999


class TestHealthMonitorCheckAll:
    @pytest.mark.asyncio
    async def test_check_all_returns_all_services(self):
        monitor = HealthMonitor()
        with (
            patch.object(
                monitor,
                "check_api",
                new=AsyncMock(return_value={"status": "ok", "latency_ms": 1.0}),
            ),
            patch.object(
                monitor,
                "check_redis",
                new=AsyncMock(return_value={"status": "ok", "latency_ms": 2.0}),
            ),
            patch.object(
                monitor,
                "check_clickhouse",
                new=AsyncMock(return_value={"status": "ok", "latency_ms": 3.0}),
            ),
            patch.object(
                monitor,
                "check_worker_queue",
                new=AsyncMock(return_value={"status": "ok", "queue_size": 0, "latency_ms": 2.0}),
            ),
        ):
            result = await monitor.check_all()
        assert "api" in result
        assert "redis" in result
        assert "clickhouse" in result
        assert "worker_queue" in result
        assert "timestamp" in result

    @pytest.mark.asyncio
    async def test_check_all_updates_last_results(self):
        monitor = HealthMonitor()
        expected = {"status": "ok", "latency_ms": 1.0}
        with (
            patch.object(monitor, "check_api", new=AsyncMock(return_value=expected)),
            patch.object(monitor, "check_redis", new=AsyncMock(return_value=expected)),
            patch.object(monitor, "check_clickhouse", new=AsyncMock(return_value=expected)),
            patch.object(monitor, "check_worker_queue", new=AsyncMock(return_value=expected)),
        ):
            await monitor.check_all()
        latest = monitor.get_latest()
        assert latest["api"]["status"] == "ok"
