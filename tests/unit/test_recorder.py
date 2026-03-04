from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

import pytest

from temporallayr.core.recorder import ExecutionRecorder, RecorderStateError


@dataclass
class _FakeStore:
    saved_graphs: list[Any] = field(default_factory=list)

    def save_execution(self, graph: Any) -> None:
        self.saved_graphs.append(graph)


class _FakeTransport:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    async def send_event(self, event: dict[str, Any]) -> None:
        self.events.append(event)


@pytest.fixture
def recorder_dependencies(monkeypatch: pytest.MonkeyPatch) -> tuple[_FakeStore, _FakeTransport]:
    import temporallayr.core.recorder as recorder_module
    import temporallayr.transport as transport_module

    fake_store = _FakeStore()
    fake_transport = _FakeTransport()

    monkeypatch.setattr(recorder_module, "get_default_store", lambda: fake_store)
    monkeypatch.setattr(transport_module, "get_transport", lambda: fake_transport)
    return fake_store, fake_transport


@pytest.mark.unit
@pytest.mark.asyncio
async def test_execution_recorder_captures_nested_spans(
    recorder_dependencies: tuple[_FakeStore, _FakeTransport],
) -> None:
    fake_store, fake_transport = recorder_dependencies

    async with ExecutionRecorder(run_id="run-nested") as recorder:
        async with recorder.step("parent", {"stage": "outer"}) as parent:
            async with recorder.step("child", {"stage": "inner"}) as child:
                assert child.parent_span_id == parent.span_id

    assert recorder.graph.trace_id == "run-nested"
    assert len(recorder.graph.spans) == 2
    assert fake_store.saved_graphs and fake_store.saved_graphs[0].trace_id == "run-nested"
    assert fake_transport.events and fake_transport.events[0]["type"] == "execution_graph"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_execution_recorder_supports_async_model_and_tool_calls(
    recorder_dependencies: tuple[_FakeStore, _FakeTransport],
) -> None:
    del recorder_dependencies

    async with ExecutionRecorder(run_id="run-model-tool") as recorder:
        model_node = await recorder.record_model_call("gpt", {"prompt": "hello"})
        tool_node = await recorder.record_tool_call("calculator", {"a": 1, "b": 2})

    assert model_node.name == "model_call:gpt"
    assert tool_node.name == "tool_call:calculator"
    assert len(recorder.graph.spans) == 2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_execution_recorder_context_isolated_between_tasks(
    recorder_dependencies: tuple[_FakeStore, _FakeTransport],
) -> None:
    del recorder_dependencies

    async def _run(run_id: str) -> tuple[str, str]:
        async with ExecutionRecorder(run_id=run_id) as recorder:
            async with recorder.step(f"step-{run_id}"):
                await asyncio.sleep(0)
        return recorder.graph.trace_id, recorder.graph.spans[0].name

    left, right = await asyncio.gather(_run("left"), _run("right"))

    assert left[0] == "left"
    assert right[0] == "right"
    assert left[1] == "step-left"
    assert right[1] == "step-right"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_execution_recorder_rejects_nested_contexts(
    recorder_dependencies: tuple[_FakeStore, _FakeTransport],
) -> None:
    del recorder_dependencies

    async with ExecutionRecorder(run_id="outer"):
        with pytest.raises(RecorderStateError, match="Cannot nest ExecutionRecorder contexts"):
            async with ExecutionRecorder(run_id="inner"):
                pass
