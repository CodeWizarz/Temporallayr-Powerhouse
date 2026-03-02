"""
Decorators for instrumenting functions and methods with TemporalLayr.
"""

import functools
import inspect
import uuid
from collections.abc import Callable
from typing import Any, TypeVar, cast, overload

from temporallayr.core.recorder import _current_graph, _current_parent_id
from temporallayr.models.execution import ExecutionNode
from temporallayr.core.semantic_conventions import SpanAttributes, SpanKind
from datetime import datetime, timezone

F = TypeVar("F", bound=Callable[..., Any])


def _extract_arguments(func: Callable[..., Any], *args: Any, **kwargs: Any) -> dict[str, Any]:
    """Safely extract and bind arguments to their original signature names."""
    try:
        sig = inspect.signature(func)
        bound = sig.bind(*args, **kwargs)
        bound.apply_defaults()
        return dict(bound.arguments)
    except Exception:
        return {"args": args, "kwargs": kwargs}


@overload
def track(func: F) -> F: ...


@overload
def track(*, name: str | None = None) -> Callable[[F], F]: ...


def track(
    func: F | None = None,
    *,
    name: str | None = None,
) -> Callable[[F], F] | F:
    """
    Decorator to track execution of a function or method.
    Transparently handles both async and sync targets.
    """

    def decorator(wrapped_func: F) -> F:
        node_name = name or wrapped_func.__name__

        if inspect.iscoroutinefunction(wrapped_func):

            @functools.wraps(wrapped_func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                graph = _current_graph.get()

                if not graph:
                    return await wrapped_func(*args, **kwargs)

                mod_name = wrapped_func.__module__
                if mod_name == "__main__":
                    import os
                    import sys

                    mod_name = os.path.splitext(os.path.basename(sys.argv[0]))[0]

                parent_id = _current_parent_id.get()
                node_attributes = {
                    "inputs": _extract_arguments(wrapped_func, *args, **kwargs),
                    "code": {
                        "name": wrapped_func.__name__,
                        "module": mod_name,
                    },
                }

                node = ExecutionNode(
                    id=str(uuid.uuid4()),
                    name=node_name,
                    metadata=node_attributes,  # remapped to attributes via validator
                    parent_id=parent_id,  # remapped to parent_span_id via validator
                )

                graph.add_node(node)
                token = _current_parent_id.set(node.id)

                start = datetime.now(timezone.utc)
                try:
                    result = await wrapped_func(*args, **kwargs)
                    end = datetime.now(timezone.utc)
                    new_attrs = dict(node.attributes)
                    new_attrs["output"] = result
                    new_attrs["duration_ms"] = (end - start).total_seconds() * 1000.0
                    new_node = node.model_copy(
                        update={
                            "attributes": new_attrs,
                            "start_time": start,
                            "end_time": end,
                        }
                    )
                    graph.update_node(node.id, new_node)
                    return result
                except Exception as e:
                    end = datetime.now(timezone.utc)
                    new_attrs = dict(node.attributes)
                    new_attrs["error"] = str(e)
                    new_attrs["duration_ms"] = (end - start).total_seconds() * 1000.0
                    new_node = node.model_copy(
                        update={
                            "attributes": new_attrs,
                            "start_time": start,
                            "end_time": end,
                            "status": "error",
                        }
                    )
                    graph.update_node(node.id, new_node)
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

                mod_name = wrapped_func.__module__
                if mod_name == "__main__":
                    import os
                    import sys

                    mod_name = os.path.splitext(os.path.basename(sys.argv[0]))[0]

                parent_id = _current_parent_id.get()
                node_attributes = {
                    "inputs": _extract_arguments(wrapped_func, *args, **kwargs),
                    "code": {
                        "name": wrapped_func.__name__,
                        "module": mod_name,
                    },
                }

                node = ExecutionNode(
                    id=str(uuid.uuid4()),
                    name=node_name,
                    metadata=node_attributes,
                    parent_id=parent_id,
                )

                graph.add_node(node)
                token = _current_parent_id.set(node.id)

                start = datetime.now(timezone.utc)
                try:
                    result = wrapped_func(*args, **kwargs)
                    end = datetime.now(timezone.utc)
                    new_attrs = dict(node.attributes)
                    new_attrs["output"] = result
                    new_attrs["duration_ms"] = (end - start).total_seconds() * 1000.0
                    new_node = node.model_copy(
                        update={
                            "attributes": new_attrs,
                            "start_time": start,
                            "end_time": end,
                        }
                    )
                    graph.update_node(node.id, new_node)
                    return result
                except Exception as e:
                    end = datetime.now(timezone.utc)
                    new_attrs = dict(node.attributes)
                    new_attrs["error"] = str(e)
                    new_attrs["duration_ms"] = (end - start).total_seconds() * 1000.0
                    new_node = node.model_copy(
                        update={
                            "attributes": new_attrs,
                            "start_time": start,
                            "end_time": end,
                            "status": "error",
                        }
                    )
                    graph.update_node(node.id, new_node)
                    raise
                finally:
                    _current_parent_id.reset(token)

            return cast(F, sync_wrapper)

    if func is None:
        return decorator
    return decorator(func)


@overload
def track_llm(func: F) -> F: ...


@overload
def track_llm(*, name: str | None = None) -> Callable[[F], F]: ...


def track_llm(
    func: F | None = None,
    *,
    name: str | None = None,
) -> Callable[[F], F] | F:
    """Decorator to track an LLM call with semantic conventions."""

    def decorator(wrapped_func: F) -> F:
        node_name = name or wrapped_func.__name__

        if inspect.iscoroutinefunction(wrapped_func):

            @functools.wraps(wrapped_func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                graph = _current_graph.get()
                if not graph:
                    return await wrapped_func(*args, **kwargs)

                mod_name = wrapped_func.__module__
                if mod_name == "__main__":
                    import os
                    import sys

                    mod_name = os.path.splitext(os.path.basename(sys.argv[0]))[0]

                parent_id = _current_parent_id.get()
                node_attributes = {
                    "inputs": _extract_arguments(wrapped_func, *args, **kwargs),
                    "code": {"name": wrapped_func.__name__, "module": mod_name},
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.LLM,
                }

                node = ExecutionNode(
                    id=str(uuid.uuid4()),
                    name=node_name,
                    metadata=node_attributes,
                    parent_id=parent_id,
                )

                graph.add_node(node)
                token = _current_parent_id.set(node.id)

                start = datetime.now(timezone.utc)
                try:
                    result = await wrapped_func(*args, **kwargs)
                    end = datetime.now(timezone.utc)
                    new_attrs = dict(node.attributes)

                    if isinstance(result, dict):
                        if "prompt_tokens" in result:
                            new_attrs[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] = result[
                                "prompt_tokens"
                            ]
                        if "completion_tokens" in result:
                            new_attrs[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = result[
                                "completion_tokens"
                            ]
                        if "total_tokens" in result:
                            new_attrs[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] = result["total_tokens"]
                        if "model" in result:
                            new_attrs[SpanAttributes.LLM_MODEL_NAME] = result["model"]
                    elif hasattr(result, "__dict__") or hasattr(result, "__slots__"):
                        if hasattr(result, "prompt_tokens"):
                            new_attrs[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] = result.prompt_tokens
                        if hasattr(result, "completion_tokens"):
                            new_attrs[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = (
                                result.completion_tokens
                            )
                        if hasattr(result, "total_tokens"):
                            new_attrs[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] = result.total_tokens
                        if hasattr(result, "model"):
                            new_attrs[SpanAttributes.LLM_MODEL_NAME] = result.model

                    new_attrs["output"] = result if isinstance(result, dict) else str(result)
                    new_attrs["duration_ms"] = (end - start).total_seconds() * 1000.0
                    new_node = node.model_copy(
                        update={
                            "attributes": new_attrs,
                            "start_time": start,
                            "end_time": end,
                        }
                    )
                    graph.update_node(node.id, new_node)
                    return result
                except Exception as e:
                    end = datetime.now(timezone.utc)
                    new_attrs = dict(node.attributes)
                    new_attrs["error"] = str(e)
                    new_attrs["duration_ms"] = (end - start).total_seconds() * 1000.0
                    new_node = node.model_copy(
                        update={
                            "attributes": new_attrs,
                            "start_time": start,
                            "end_time": end,
                            "status": "error",
                        }
                    )
                    graph.update_node(node.id, new_node)
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

                mod_name = wrapped_func.__module__
                if mod_name == "__main__":
                    import os
                    import sys

                    mod_name = os.path.splitext(os.path.basename(sys.argv[0]))[0]

                parent_id = _current_parent_id.get()
                node_attributes = {
                    "inputs": _extract_arguments(wrapped_func, *args, **kwargs),
                    "code": {"name": wrapped_func.__name__, "module": mod_name},
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.LLM,
                }

                node = ExecutionNode(
                    id=str(uuid.uuid4()),
                    name=node_name,
                    metadata=node_attributes,
                    parent_id=parent_id,
                )

                graph.add_node(node)
                token = _current_parent_id.set(node.id)

                start = datetime.now(timezone.utc)
                try:
                    result = wrapped_func(*args, **kwargs)
                    end = datetime.now(timezone.utc)
                    new_attrs = dict(node.attributes)

                    if isinstance(result, dict):
                        if "prompt_tokens" in result:
                            new_attrs[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] = result[
                                "prompt_tokens"
                            ]
                        if "completion_tokens" in result:
                            new_attrs[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = result[
                                "completion_tokens"
                            ]
                        if "total_tokens" in result:
                            new_attrs[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] = result["total_tokens"]
                        if "model" in result:
                            new_attrs[SpanAttributes.LLM_MODEL_NAME] = result["model"]
                    elif hasattr(result, "__dict__") or hasattr(result, "__slots__"):
                        if hasattr(result, "prompt_tokens"):
                            new_attrs[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] = result.prompt_tokens
                        if hasattr(result, "completion_tokens"):
                            new_attrs[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = (
                                result.completion_tokens
                            )
                        if hasattr(result, "total_tokens"):
                            new_attrs[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] = result.total_tokens
                        if hasattr(result, "model"):
                            new_attrs[SpanAttributes.LLM_MODEL_NAME] = result.model

                    new_attrs["output"] = result if isinstance(result, dict) else str(result)
                    new_attrs["duration_ms"] = (end - start).total_seconds() * 1000.0
                    new_node = node.model_copy(
                        update={
                            "attributes": new_attrs,
                            "start_time": start,
                            "end_time": end,
                        }
                    )
                    graph.update_node(node.id, new_node)
                    return result
                except Exception as e:
                    end = datetime.now(timezone.utc)
                    new_attrs = dict(node.attributes)
                    new_attrs["error"] = str(e)
                    new_attrs["duration_ms"] = (end - start).total_seconds() * 1000.0
                    new_node = node.model_copy(
                        update={
                            "attributes": new_attrs,
                            "start_time": start,
                            "end_time": end,
                            "status": "error",
                        }
                    )
                    graph.update_node(node.id, new_node)
                    raise
                finally:
                    _current_parent_id.reset(token)

            return cast(F, sync_wrapper)

    if func is None:
        return decorator
    return decorator(func)


@overload
def track_tool(func: F) -> F: ...


@overload
def track_tool(*, name: str | None = None) -> Callable[[F], F]: ...


def track_tool(
    func: F | None = None,
    *,
    name: str | None = None,
) -> Callable[[F], F] | F:
    """Decorator to track a tool call with semantic conventions."""

    def decorator(wrapped_func: F) -> F:
        node_name = name or wrapped_func.__name__

        if inspect.iscoroutinefunction(wrapped_func):

            @functools.wraps(wrapped_func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                graph = _current_graph.get()
                if not graph:
                    return await wrapped_func(*args, **kwargs)

                mod_name = wrapped_func.__module__
                if mod_name == "__main__":
                    import os
                    import sys

                    mod_name = os.path.splitext(os.path.basename(sys.argv[0]))[0]

                parent_id = _current_parent_id.get()
                node_attributes = {
                    "inputs": _extract_arguments(wrapped_func, *args, **kwargs),
                    "code": {"name": wrapped_func.__name__, "module": mod_name},
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.TOOL,
                    SpanAttributes.TOOL_NAME: wrapped_func.__name__,
                }

                node = ExecutionNode(
                    id=str(uuid.uuid4()),
                    name=node_name,
                    metadata=node_attributes,
                    parent_id=parent_id,
                )

                graph.add_node(node)
                token = _current_parent_id.set(node.id)

                start = datetime.now(timezone.utc)
                try:
                    result = await wrapped_func(*args, **kwargs)
                    end = datetime.now(timezone.utc)
                    new_attrs = dict(node.attributes)
                    new_attrs["output"] = result if isinstance(result, dict) else str(result)
                    new_attrs["duration_ms"] = (end - start).total_seconds() * 1000.0

                    new_node = node.model_copy(
                        update={
                            "attributes": new_attrs,
                            "start_time": start,
                            "end_time": end,
                        }
                    )
                    graph.update_node(node.id, new_node)
                    return result
                except Exception as e:
                    end = datetime.now(timezone.utc)
                    new_attrs = dict(node.attributes)
                    new_attrs["error"] = str(e)
                    new_attrs["duration_ms"] = (end - start).total_seconds() * 1000.0
                    new_node = node.model_copy(
                        update={
                            "attributes": new_attrs,
                            "start_time": start,
                            "end_time": end,
                            "status": "error",
                        }
                    )
                    graph.update_node(node.id, new_node)
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

                mod_name = wrapped_func.__module__
                if mod_name == "__main__":
                    import os
                    import sys

                    mod_name = os.path.splitext(os.path.basename(sys.argv[0]))[0]

                parent_id = _current_parent_id.get()
                node_attributes = {
                    "inputs": _extract_arguments(wrapped_func, *args, **kwargs),
                    "code": {"name": wrapped_func.__name__, "module": mod_name},
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: SpanKind.TOOL,
                    SpanAttributes.TOOL_NAME: wrapped_func.__name__,
                }

                node = ExecutionNode(
                    id=str(uuid.uuid4()),
                    name=node_name,
                    metadata=node_attributes,
                    parent_id=parent_id,
                )

                graph.add_node(node)
                token = _current_parent_id.set(node.id)

                start = datetime.now(timezone.utc)
                try:
                    result = wrapped_func(*args, **kwargs)
                    end = datetime.now(timezone.utc)
                    new_attrs = dict(node.attributes)
                    new_attrs["output"] = result if isinstance(result, dict) else str(result)
                    new_attrs["duration_ms"] = (end - start).total_seconds() * 1000.0

                    new_node = node.model_copy(
                        update={
                            "attributes": new_attrs,
                            "start_time": start,
                            "end_time": end,
                        }
                    )
                    graph.update_node(node.id, new_node)
                    return result
                except Exception as e:
                    end = datetime.now(timezone.utc)
                    new_attrs = dict(node.attributes)
                    new_attrs["error"] = str(e)
                    new_attrs["duration_ms"] = (end - start).total_seconds() * 1000.0
                    new_node = node.model_copy(
                        update={
                            "attributes": new_attrs,
                            "start_time": start,
                            "end_time": end,
                            "status": "error",
                        }
                    )
                    graph.update_node(node.id, new_node)
                    raise
                finally:
                    _current_parent_id.reset(token)

            return cast(F, sync_wrapper)

    if func is None:
        return decorator
    return decorator(func)
