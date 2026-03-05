"""Unit tests for public tracking decorators."""

import asyncio

import pytest

from temporallayr.context import get_current_trace
from temporallayr.decorators import track, track_llm, track_pipeline, track_tool


@track
def sample_sync_function(x: int, y: int = 5) -> int:
    return x * y


@track
async def sample_async_function(x: int) -> int:
    await asyncio.sleep(0.01)
    return x + 10


def test_sync_decorator_creates_trace():
    result = sample_sync_function(3)
    assert result == 15
    # The trace should be cleaned up from the current context after the root pipeline finishes
    assert get_current_trace() is None


@pytest.mark.asyncio
async def test_async_decorator_creates_trace():
    result = await sample_async_function(5)
    assert result == 15
    assert get_current_trace() is None


@track_pipeline
def pipeline_demo() -> dict:
    return {"res": sample_sync_function(2, 4)}


def test_nested_decorators():
    res = pipeline_demo()
    assert res == {"res": 8}


@pytest.mark.asyncio
async def test_decorator_error_handling():
    @track
    def failing_func():
        raise ValueError("Intentional crash")

    with pytest.raises(ValueError):
        failing_func()

    assert get_current_trace() is None


@track_llm
def llm_func(prompt: str) -> str:
    return f"Response to {prompt}"


@track_tool
async def tool_func() -> str:
    return "Tool output"


def test_decorator_aliases():
    assert llm_func("hello") == "Response to hello"


@pytest.mark.asyncio
async def test_async_tool_decorator():
    result = await tool_func()
    assert result == "Tool output"
