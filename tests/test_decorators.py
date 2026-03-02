import pytest
import asyncio
from typing import Any
from datetime import datetime
import temporallayr.client as client_sdk
from temporallayr.core.recorder import ExecutionRecorder, _current_graph
from temporallayr.core.decorators import track_llm, track_tool
from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind


class MockLLMResult:
    def __init__(self, prompt_tokens, completion_tokens, total_tokens, model):
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.total_tokens = total_tokens
        self.model = model


@track_llm
def run_llm_dict():
    return {"total_tokens": 42, "model": "gpt-4"}


@track_llm
def run_llm_obj():
    return MockLLMResult(10, 20, 30, "claude-v1")


@track_llm
def failing_llm():
    raise ValueError("LLM Error")


@track_tool
def fetch_weather(location: str):
    return {"temp": 72, "weather": "sunny"}


@track_tool
def failing_tool():
    raise RuntimeError("Tool broken")


@pytest.mark.asyncio
async def test_track_llm_dict():
    client_sdk.init(api_key="test", server_url="http://localhost", tenant_id="t1", batch_size=1)
    try:
        async with ExecutionRecorder():
            result = run_llm_dict()
            assert result["total_tokens"] == 42
            graph = _current_graph.get()
            nodes = list(graph.nodes.values())
            assert len(nodes) == 1
            llm_node = nodes[0]
            assert llm_node.attributes[SpanAttributes.OPENINFERENCE_SPAN_KIND] == SpanKind.LLM
            assert llm_node.attributes[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] == 42
            assert llm_node.attributes[SpanAttributes.LLM_MODEL_NAME] == "gpt-4"
            assert isinstance(llm_node.end_time, datetime)
    finally:
        client_sdk.shutdown()


@pytest.mark.asyncio
async def test_track_llm_obj():
    client_sdk.init(api_key="test", server_url="http://localhost", tenant_id="t1", batch_size=1)
    try:
        async with ExecutionRecorder():
            run_llm_obj()
            graph = _current_graph.get()
            nodes = list(graph.nodes.values())
            assert len(nodes) == 1
            llm_node = nodes[0]
            assert llm_node.attributes[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] == 10
            assert llm_node.attributes[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] == 20
            assert llm_node.attributes[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] == 30
            assert llm_node.attributes[SpanAttributes.LLM_MODEL_NAME] == "claude-v1"
    finally:
        client_sdk.shutdown()


@pytest.mark.asyncio
async def test_track_tool():
    client_sdk.init(api_key="test", server_url="http://localhost", tenant_id="t1", batch_size=1)
    try:
        async with ExecutionRecorder():
            fetch_weather("San Francisco")
            graph = _current_graph.get()
            nodes = list(graph.nodes.values())
            assert len(nodes) == 1
            tool_node = nodes[0]
            assert tool_node.attributes[SpanAttributes.OPENINFERENCE_SPAN_KIND] == SpanKind.TOOL
            assert tool_node.attributes[SpanAttributes.TOOL_NAME] == "fetch_weather"
            assert "location" in tool_node.attributes["inputs"]
            assert tool_node.attributes["inputs"]["location"] == "San Francisco"
    finally:
        client_sdk.shutdown()


@pytest.mark.asyncio
async def test_track_exceptions():
    client_sdk.init(api_key="test", server_url="http://localhost", tenant_id="t1", batch_size=1)
    try:
        async with ExecutionRecorder():
            try:
                failing_llm()
            except ValueError:
                pass

            try:
                failing_tool()
            except RuntimeError:
                pass

            graph = _current_graph.get()
            nodes = list(graph.nodes.values())
            assert len(nodes) == 2

            assert nodes[0].status == "error"
            assert "LLM Error" in nodes[0].attributes["error"]

            assert nodes[1].status == "error"
            assert "Tool broken" in nodes[1].attributes["error"]
    finally:
        client_sdk.shutdown()
