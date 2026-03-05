"""Unit tests for PostgreSQL storage engine."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from temporallayr.core.store_postgres import PostgresStore
from temporallayr.models.execution import ExecutionGraph, Span


@pytest.fixture
def mock_pool_and_conn():
    pool = MagicMock()
    conn = AsyncMock()

    # setup `async with pool.acquire() as conn`
    acq_ctx = AsyncMock()
    acq_ctx.__aenter__.return_value = conn
    pool.acquire.return_value = acq_ctx

    return pool, conn


@pytest.fixture
def store(mock_pool_and_conn):
    pool, _ = mock_pool_and_conn
    mock_get_pool = AsyncMock(return_value=pool)
    with patch("temporallayr.core.store_postgres._get_pool", new=mock_get_pool):
        yield PostgresStore()


@pytest.mark.asyncio
async def test_postgres_store_save_execution(store, mock_pool_and_conn):
    _, conn = mock_pool_and_conn

    graph = ExecutionGraph(
        tenant_id="test_tenant",
        trace_id="trace_1",
        spans=[Span(span_id="span_1", name="test_span", attributes={"cost": 1.23})],
    )

    await store.save_execution_async(graph)
    assert conn.execute.call_count >= 1


@pytest.mark.asyncio
async def test_postgres_store_load_execution(store, mock_pool_and_conn):
    _, conn = mock_pool_and_conn

    # Mock the return values for fetching execution and spans
    mock_row = {
        "data": {
            "id": "trace_1",
            "tenant_id": "test_tenant",
            "spans": [{"id": "span_1", "name": "test_span", "attributes": {"cost": 1.23}}],
        }
    }
    conn.fetchrow.return_value = mock_row

    graph = await store.load_execution_async("trace_1", "test_tenant")

    assert graph.id == "trace_1"
    assert graph.tenant_id == "test_tenant"
    assert len(graph.spans) == 1
    assert graph.spans[0].id == "span_1"
    assert graph.spans[0].name == "test_span"


@pytest.mark.asyncio
async def test_postgres_store_load_execution_not_found(store, mock_pool_and_conn):
    _, conn = mock_pool_and_conn
    conn.fetchrow.return_value = None

    with pytest.raises(FileNotFoundError):
        await store.load_execution_async("nonexistent", "test_tenant")
