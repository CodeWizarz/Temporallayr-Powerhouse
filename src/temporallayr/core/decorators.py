"""
Decorators for instrumenting functions with TemporalLayr.

@track        — generic span (any function)
@track_llm    — LLM call span: captures tokens, model, latency
@track_tool   — tool/function span: captures tool name, inputs, output
@track_pipeline — alias for @track, marks top-level agent pipeline
"""

from __future__ import annotations

import functools
import inspect
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any, TypeVar, cast, overload

from temporallayr.core.recorder import _current_graph, _current_parent_id
from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind
from temporallayr.models.execution import ExecutionNode

F = TypeVar("F", bound=Callable[..., Any])

# LLM provider pricing table (per 1M tokens, USD)
# Extend this as needed — used for cost_usd calculation in @track_llm
_TOKEN_COST_PER_1M: dict[str, dict[str, float]] = {
    "gpt-4o": {"prompt": 5.0, "completion": 15.0},
    "gpt-4o-mini": {"prompt": 0.15, "completion": 0.60},
    "gpt-4-turbo": {"prompt": 10.0, "completion": 30.0},
    "gpt-4": {"prompt": 30.0, "completion": 60.0},
    "gpt-3.5-turbo": {"prompt": 0.50, "completion": 1.50},
    "claude-3-5-sonnet": {"prompt": 3.0, "completion": 15.0},
    "claude-3-opus": {"prompt": 15.0, "completion": 75.0},
    "claude-3-haiku": {"prompt": 0.25, "completion": 1.25},
    "gemini-1.5-pro": {"prompt": 3.50, "completion": 10.50},
    "gemini-1.5-flash": {"prompt": 0.075, "completion": 0.30},
}


def _compute_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float | None:
    """Return estimated USD cost or None if model not in pricing table."""
    for key, costs in _TOKEN_COST_PER_1M.items():
        if key in model.lower():
            cost = (
                prompt_tokens * costs["prompt"] + completion_tokens * costs["completion"]
            ) / 1_000_000
            return round(cost, 8)
    return None


def _extract_arguments(func: Callable[..., Any], *args: Any, **kwargs: Any) -> dict[str, Any]:
    try:
        sig = inspect.signature(func)
        bound = sig.bind(*args, **kwargs)
        bound.apply_defaults()
        return dict(bound.arguments)
    except Exception:
        return {"args": list(args), "kwargs": kwargs}


def _mod_name(func: Callable[..., Any]) -> str:
    import os
    import sys

    mod = func.__module__
    if mod == "__main__":
        return os.path.splitext(os.path.basename(sys.argv[0]))[0]
    return mod


def _build_node(name: str, attributes: dict[str, Any], parent_id: str | None) -> ExecutionNode:
    return ExecutionNode(
        span_id=str(uuid.uuid4()),
        name=name,
        attributes=attributes,
        parent_span_id=parent_id,
    )


# ── @track ────────────────────────────────────────────────────────────


@overload
def track(func: F) -> F: ...


@overload
def track(*, name: str | None = None) -> Callable[[F], F]: ...


def track(func: F | None = None, *, name: str | None = None) -> Callable[[F], F] | F:
    """Generic span decorator. Works on sync and async functions."""

    def decorator(wrapped_func: F) -> F:
        node_name = name or wrapped_func.__name__

        if inspect.iscoroutinefunction(wrapped_func):

            @functools.wraps(wrapped_func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                graph = _current_graph.get()
                if not graph:
                    return await wrapped_func(*args, **kwargs)

                start = datetime.now(UTC)
                parent_id = _current_parent_id.get()
                attrs: dict[str, Any] = {
                    "inputs": _extract_arguments(wrapped_func, *args, **kwargs),
                    "code": {"name": wrapped_func.__name__, "module": _mod_name(wrapped_func)},
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.CHAIN,
                }
                node = _build_node(node_name, attrs, parent_id)
                graph.add_node(node)
                token = _current_parent_id.set(node.id)
                try:
                    result = await wrapped_func(*args, **kwargs)
                    end = datetime.now(UTC)
                    new_attrs = {
                        **node.attributes,
                        "output": result,
                        "duration_ms": round((end - start).total_seconds() * 1000, 3),
                    }
                    graph.update_node(
                        node.id,
                        node.model_copy(
                            update={
                                "attributes": new_attrs,
                                "start_time": start,
                                "end_time": end,
                                "status": "success",
                            }
                        ),
                    )
                    return result
                except Exception as e:
                    end = datetime.now(UTC)
                    new_attrs = {
                        **node.attributes,
                        "error": str(e),
                        "duration_ms": round((end - start).total_seconds() * 1000, 3),
                    }
                    graph.update_node(
                        node.id,
                        node.model_copy(
                            update={
                                "attributes": new_attrs,
                                "start_time": start,
                                "end_time": end,
                                "status": "error",
                                "error": str(e),
                            }
                        ),
                    )
                    raise
                finally:
                    _current_parent_id.reset(token)

            return cast(F, async_wrapper)

        else:

            @functools.wraps(wrapped_func)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                graph = _current_graph.get()
                if not graph:
                    return wrapped_func(*args, **kwargs)

                start = datetime.now(UTC)
                parent_id = _current_parent_id.get()
                attrs: dict[str, Any] = {
                    "inputs": _extract_arguments(wrapped_func, *args, **kwargs),
                    "code": {"name": wrapped_func.__name__, "module": _mod_name(wrapped_func)},
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.CHAIN,
                }
                node = _build_node(node_name, attrs, parent_id)
                graph.add_node(node)
                token = _current_parent_id.set(node.id)
                try:
                    result = wrapped_func(*args, **kwargs)
                    end = datetime.now(UTC)
                    new_attrs = {
                        **node.attributes,
                        "output": result,
                        "duration_ms": round((end - start).total_seconds() * 1000, 3),
                    }
                    graph.update_node(
                        node.id,
                        node.model_copy(
                            update={
                                "attributes": new_attrs,
                                "start_time": start,
                                "end_time": end,
                                "status": "success",
                            }
                        ),
                    )
                    return result
                except Exception as e:
                    end = datetime.now(UTC)
                    new_attrs = {
                        **node.attributes,
                        "error": str(e),
                        "duration_ms": round((end - start).total_seconds() * 1000, 3),
                    }
                    graph.update_node(
                        node.id,
                        node.model_copy(
                            update={
                                "attributes": new_attrs,
                                "start_time": start,
                                "end_time": end,
                                "status": "error",
                                "error": str(e),
                            }
                        ),
                    )
                    raise
                finally:
                    _current_parent_id.reset(token)

            return cast(F, sync_wrapper)

    if func is None:
        return decorator
    return decorator(func)


# ── @track_llm ────────────────────────────────────────────────────────


@overload
def track_llm(func: F) -> F: ...


@overload
def track_llm(*, name: str | None = None) -> Callable[[F], F]: ...


def track_llm(func: F | None = None, *, name: str | None = None) -> Callable[[F], F] | F:
    """
    LLM call decorator. Captures:
      - Prompt/completion/total token counts (from return value or attributes)
      - Model name
      - Estimated cost in USD (from built-in pricing table)
      - Latency (accurate start/end timestamps)

    The wrapped function may return:
      - A dict with keys: prompt_tokens, completion_tokens, total_tokens, model, output
      - Any object with those attributes
      - Anything else (captured as output)
    """

    def decorator(wrapped_func: F) -> F:
        node_name = name or f"llm:{wrapped_func.__name__}"

        def _extract_llm_attrs(result: Any, base_attrs: dict[str, Any]) -> dict[str, Any]:
            attrs = dict(base_attrs)
            # Extract from dict return
            if isinstance(result, dict):
                for field in ("prompt_tokens", "completion_tokens", "total_tokens"):
                    if field in result:
                        try:
                            attrs[
                                getattr(
                                    SpanAttributes,
                                    f"LLM_TOKEN_COUNT_{field.upper().replace('_TOKENS','').replace('PROMPT','PROMPT').replace('COMPLETION','COMPLETION').replace('TOTAL','TOTAL')}",
                                    field,
                                )
                            ] = int(result[field])
                        except Exception:
                            pass
                # Map to proper SpanAttributes
                if "prompt_tokens" in result:
                    attrs[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] = int(result["prompt_tokens"])
                if "completion_tokens" in result:
                    attrs[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = int(
                        result["completion_tokens"]
                    )
                if "total_tokens" in result:
                    attrs[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] = int(result["total_tokens"])
                if "model" in result:
                    attrs[SpanAttributes.LLM_MODEL_NAME] = str(result["model"])
                attrs["output"] = result.get("output", result.get("content", result))
            # Extract from object attributes
            elif hasattr(result, "usage") and result.usage is not None:
                usage = result.usage
                if hasattr(usage, "prompt_tokens"):
                    attrs[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] = usage.prompt_tokens
                if hasattr(usage, "completion_tokens"):
                    attrs[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = usage.completion_tokens
                if hasattr(usage, "total_tokens"):
                    attrs[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] = usage.total_tokens
                if hasattr(result, "model"):
                    attrs[SpanAttributes.LLM_MODEL_NAME] = str(result.model)
                attrs["output"] = str(result)
            else:
                attrs["output"] = result

            # Cost calculation
            model = attrs.get(SpanAttributes.LLM_MODEL_NAME, "")
            prompt_t = attrs.get(SpanAttributes.LLM_TOKEN_COUNT_PROMPT, 0)
            completion_t = attrs.get(SpanAttributes.LLM_TOKEN_COUNT_COMPLETION, 0)
            if model and (prompt_t or completion_t):
                cost = _compute_cost(str(model), int(prompt_t), int(completion_t))
                if cost is not None:
                    attrs["cost_usd"] = cost

            return attrs

        if inspect.iscoroutinefunction(wrapped_func):

            @functools.wraps(wrapped_func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                graph = _current_graph.get()
                if not graph:
                    return await wrapped_func(*args, **kwargs)

                start = datetime.now(UTC)
                parent_id = _current_parent_id.get()
                base_attrs: dict[str, Any] = {
                    "inputs": _extract_arguments(wrapped_func, *args, **kwargs),
                    "code": {"name": wrapped_func.__name__, "module": _mod_name(wrapped_func)},
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.LLM,
                }
                node = _build_node(node_name, base_attrs, parent_id)
                graph.add_node(node)
                token = _current_parent_id.set(node.id)
                try:
                    result = await wrapped_func(*args, **kwargs)
                    end = datetime.now(UTC)
                    new_attrs = _extract_llm_attrs(result, node.attributes)
                    new_attrs["duration_ms"] = round((end - start).total_seconds() * 1000, 3)
                    graph.update_node(
                        node.id,
                        node.model_copy(
                            update={
                                "attributes": new_attrs,
                                "start_time": start,
                                "end_time": end,
                                "status": "success",
                            }
                        ),
                    )
                    return result
                except Exception as e:
                    end = datetime.now(UTC)
                    new_attrs = {
                        **node.attributes,
                        "error": str(e),
                        "duration_ms": round((end - start).total_seconds() * 1000, 3),
                    }
                    graph.update_node(
                        node.id,
                        node.model_copy(
                            update={
                                "attributes": new_attrs,
                                "start_time": start,
                                "end_time": end,
                                "status": "error",
                                "error": str(e),
                            }
                        ),
                    )
                    raise
                finally:
                    _current_parent_id.reset(token)

            return cast(F, async_wrapper)

        else:

            @functools.wraps(wrapped_func)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                graph = _current_graph.get()
                if not graph:
                    return wrapped_func(*args, **kwargs)

                start = datetime.now(UTC)
                parent_id = _current_parent_id.get()
                base_attrs: dict[str, Any] = {
                    "inputs": _extract_arguments(wrapped_func, *args, **kwargs),
                    "code": {"name": wrapped_func.__name__, "module": _mod_name(wrapped_func)},
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.LLM,
                }
                node = _build_node(node_name, base_attrs, parent_id)
                graph.add_node(node)
                token = _current_parent_id.set(node.id)
                try:
                    result = wrapped_func(*args, **kwargs)
                    end = datetime.now(UTC)
                    new_attrs = _extract_llm_attrs(result, node.attributes)
                    new_attrs["duration_ms"] = round((end - start).total_seconds() * 1000, 3)
                    graph.update_node(
                        node.id,
                        node.model_copy(
                            update={
                                "attributes": new_attrs,
                                "start_time": start,
                                "end_time": end,
                                "status": "success",
                            }
                        ),
                    )
                    return result
                except Exception as e:
                    end = datetime.now(UTC)
                    new_attrs = {
                        **node.attributes,
                        "error": str(e),
                        "duration_ms": round((end - start).total_seconds() * 1000, 3),
                    }
                    graph.update_node(
                        node.id,
                        node.model_copy(
                            update={
                                "attributes": new_attrs,
                                "start_time": start,
                                "end_time": end,
                                "status": "error",
                                "error": str(e),
                            }
                        ),
                    )
                    raise
                finally:
                    _current_parent_id.reset(token)

            return cast(F, sync_wrapper)

    if func is None:
        return decorator
    return decorator(func)


# ── @track_tool ───────────────────────────────────────────────────────


@overload
def track_tool(func: F) -> F: ...


@overload
def track_tool(*, name: str | None = None, description: str | None = None) -> Callable[[F], F]: ...


def track_tool(
    func: F | None = None,
    *,
    name: str | None = None,
    description: str | None = None,
) -> Callable[[F], F] | F:
    """
    Tool/function call decorator. Captures:
      - Tool name (from decorator arg or function name)
      - Input arguments
      - Output value
      - Accurate latency
    """

    def decorator(wrapped_func: F) -> F:
        tool_name = name or wrapped_func.__name__
        node_name = f"tool:{tool_name}"

        if inspect.iscoroutinefunction(wrapped_func):

            @functools.wraps(wrapped_func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                graph = _current_graph.get()
                if not graph:
                    return await wrapped_func(*args, **kwargs)

                start = datetime.now(UTC)
                parent_id = _current_parent_id.get()
                attrs: dict[str, Any] = {
                    "inputs": _extract_arguments(wrapped_func, *args, **kwargs),
                    "code": {"name": wrapped_func.__name__, "module": _mod_name(wrapped_func)},
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.TOOL,
                    SpanAttributes.TOOL_NAME: tool_name,
                }
                if description:
                    attrs[SpanAttributes.TOOL_DESCRIPTION] = description
                node = _build_node(node_name, attrs, parent_id)
                graph.add_node(node)
                token = _current_parent_id.set(node.id)
                try:
                    result = await wrapped_func(*args, **kwargs)
                    end = datetime.now(UTC)
                    new_attrs = {
                        **node.attributes,
                        "output": result,
                        "duration_ms": round((end - start).total_seconds() * 1000, 3),
                    }
                    graph.update_node(
                        node.id,
                        node.model_copy(
                            update={
                                "attributes": new_attrs,
                                "start_time": start,
                                "end_time": end,
                                "status": "success",
                            }
                        ),
                    )
                    return result
                except Exception as e:
                    end = datetime.now(UTC)
                    new_attrs = {
                        **node.attributes,
                        "error": str(e),
                        "duration_ms": round((end - start).total_seconds() * 1000, 3),
                    }
                    graph.update_node(
                        node.id,
                        node.model_copy(
                            update={
                                "attributes": new_attrs,
                                "start_time": start,
                                "end_time": end,
                                "status": "error",
                                "error": str(e),
                            }
                        ),
                    )
                    raise
                finally:
                    _current_parent_id.reset(token)

            return cast(F, async_wrapper)

        else:

            @functools.wraps(wrapped_func)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                graph = _current_graph.get()
                if not graph:
                    return wrapped_func(*args, **kwargs)

                start = datetime.now(UTC)
                parent_id = _current_parent_id.get()
                attrs: dict[str, Any] = {
                    "inputs": _extract_arguments(wrapped_func, *args, **kwargs),
                    "code": {"name": wrapped_func.__name__, "module": _mod_name(wrapped_func)},
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.TOOL,
                    SpanAttributes.TOOL_NAME: tool_name,
                }
                if description:
                    attrs[SpanAttributes.TOOL_DESCRIPTION] = description
                node = _build_node(node_name, attrs, parent_id)
                graph.add_node(node)
                token = _current_parent_id.set(node.id)
                try:
                    result = wrapped_func(*args, **kwargs)
                    end = datetime.now(UTC)
                    new_attrs = {
                        **node.attributes,
                        "output": result,
                        "duration_ms": round((end - start).total_seconds() * 1000, 3),
                    }
                    graph.update_node(
                        node.id,
                        node.model_copy(
                            update={
                                "attributes": new_attrs,
                                "start_time": start,
                                "end_time": end,
                                "status": "success",
                            }
                        ),
                    )
                    return result
                except Exception as e:
                    end = datetime.now(UTC)
                    new_attrs = {
                        **node.attributes,
                        "error": str(e),
                        "duration_ms": round((end - start).total_seconds() * 1000, 3),
                    }
                    graph.update_node(
                        node.id,
                        node.model_copy(
                            update={
                                "attributes": new_attrs,
                                "start_time": start,
                                "end_time": end,
                                "status": "error",
                                "error": str(e),
                            }
                        ),
                    )
                    raise
                finally:
                    _current_parent_id.reset(token)

            return cast(F, sync_wrapper)

    if func is None:
        return decorator
    return decorator(func)


# ── @track_pipeline — alias marking top-level pipeline entry points ───
track_pipeline = track
