from __future__ import annotations

import asyncio

import pytest

import temporallayr


def test_start_span_requires_trace() -> None:
    temporallayr.init(api_key="k", server_url="https://example.com")
    with pytest.raises(RuntimeError, match="start_trace"):
        temporallayr.start_span(name="x")
    asyncio.run(temporallayr.shutdown())


def test_flush_requires_init() -> None:
    with pytest.raises(RuntimeError, match="initialized"):
        asyncio.run(temporallayr.flush())
