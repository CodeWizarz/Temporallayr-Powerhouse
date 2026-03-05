"""
Unit tests for integrations — mock everything, no real API calls.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from temporallayr.models.execution import ExecutionGraph
from temporallayr.core.recorder import _current_graph


def _make_graph():
    g = ExecutionGraph(id="int-test-001", tenant_id="test", spans=[])
    return g


# ── LangChain handler ─────────────────────────────────────────────────


def test_langchain_handler_import():
    try:
        from temporallayr.integrations.langchain import TemporalLayrCallbackHandler

        handler = TemporalLayrCallbackHandler()
        assert handler is not None
    except ImportError:
        pytest.skip("langchain-core not installed")


def test_langchain_llm_end_adds_span():
    try:
        from temporallayr.integrations.langchain import TemporalLayrCallbackHandler
        from langchain_core.outputs import LLMResult, Generation
    except ImportError:
        pytest.skip("langchain-core not installed")

    graph = _make_graph()
    token = _current_graph.set(graph)
    try:
        handler = TemporalLayrCallbackHandler()
        import uuid

        run_id = uuid.uuid4()

        # Simulate LLM start
        handler.on_llm_start(
            {"kwargs": {"model_name": "gpt-4o"}},
            ["What is 2+2?"],
            run_id=run_id,
        )

        # Simulate LLM end
        result = LLMResult(
            generations=[[Generation(text="4")]],
            llm_output={
                "token_usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
            },
        )
        handler.on_llm_end(result, run_id=run_id)

        assert len(graph.spans) == 1
        span = graph.spans[0]
        assert "gpt-4o" in span.name
        assert span.status == "success"
        assert span.attributes.get("llm.token_count.total") == 15
        assert span.attributes.get("cost_usd") is not None
    finally:
        _current_graph.reset(token)


# ── OpenAI wrapper ────────────────────────────────────────────────────


def test_openai_wrapper_tracks_span():
    try:
        import openai
    except ImportError:
        pytest.skip("openai not installed")

    from temporallayr.integrations.openai_wrapper import OpenAI

    # Mock the underlying openai client
    mock_usage = MagicMock()
    mock_usage.prompt_tokens = 20
    mock_usage.completion_tokens = 10
    mock_response = MagicMock()
    mock_response.usage = mock_usage

    graph = _make_graph()
    token = _current_graph.set(graph)
    try:
        with patch("openai.OpenAI") as MockOpenAI:
            mock_client = MagicMock()
            mock_client.chat.completions.create.return_value = mock_response
            MockOpenAI.return_value = mock_client

            client = OpenAI(api_key="test")
            client._client = mock_client
            client.chat.completions._original = mock_client.chat.completions

            client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": "Hello"}],
            )

        assert len(graph.spans) == 1
        span = graph.spans[0]
        assert span.status == "success"
        assert span.attributes.get("llm.token_count.prompt") == 20
    finally:
        _current_graph.reset(token)


# ── Anthropic wrapper ─────────────────────────────────────────────────


def test_anthropic_wrapper_cost_calc():
    from temporallayr.integrations.anthropic_wrapper import _compute_anthropic_cost

    cost = _compute_anthropic_cost("claude-sonnet-4-6", 1000, 500)
    assert cost is not None
    assert cost > 0
    # $3/M input + $15/M output = (1000*3 + 500*15)/1M = 0.0105
    assert abs(cost - 0.0105) < 0.001


def test_anthropic_wrapper_unknown_model_no_cost():
    from temporallayr.integrations.anthropic_wrapper import _compute_anthropic_cost

    cost = _compute_anthropic_cost("some-future-model-xyz", 1000, 500)
    assert cost is None
