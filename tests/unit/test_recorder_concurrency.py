from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

import pytest

from temporallayr.core.recorder import ExecutionRecorder


@dataclass
class _StoreSpy:
    graphs: list[Any] = field(default_factory=list)

    def save_execution(self, graph: Any) -> None:
        self.graphs.append(graph)


class _TransportSpy:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    async def send_event(self, event: dict[str, Any]) -> None:
        self.events.append(event)


@pytest.fixture
def recorder_runtime(monkeypatch: pytest.MonkeyPatch) -> tuple[_StoreSpy, _TransportSpy]:
    import temporallayr.core.recorder as recorder_module
    import temporallayr.transport as transport_module

    store = _StoreSpy()
    transport = _TransportSpy()

    monkeypatch.setattr(recorder_module, "get_default_store", lambda: store)
    monkeypatch.setattr(transport_module, "get_transport", lambda: transport)
    return store, transport


@pytest.mark.unit
@pytest.mark.asyncio
async def test_concurrent_recorders_are_isolated(
    recorder_runtime: tuple[_StoreSpy, _TransportSpy],
) -> None:
    store, transport = recorder_runtime

    async def _run(index: int) -> tuple[str, str, int]:
        run_id = f"concurrency-run-{index}"
        async with ExecutionRecorder(run_id=run_id) as recorder:
            async with recorder.step(f"step-{index}", {"index": index}):
                await asyncio.sleep(0)

        span = recorder.graph.spans[0]
        return recorder.graph.trace_id, span.name, int(span.attributes["index"])

    results = await asyncio.gather(*[_run(i) for i in range(20)])

    assert len({trace_id for trace_id, _, _ in results}) == 20
    assert {name for _, name, _ in results} == {f"step-{i}" for i in range(20)}
    assert {index for _, _, index in results} == set(range(20))

    assert len(store.graphs) == 20
    assert len(transport.events) == 20


@pytest.mark.unit
@pytest.mark.asyncio
async def test_child_task_recorder_does_not_inherit_parent_recorder_state(
    recorder_runtime: tuple[_StoreSpy, _TransportSpy],
) -> None:
    del recorder_runtime

    async def _child() -> tuple[str, int]:
        async with ExecutionRecorder(run_id="child-run") as recorder:
            async with recorder.step("child-step"):
                await asyncio.sleep(0)
        return recorder.graph.trace_id, len(recorder.graph.spans)

    async with ExecutionRecorder(run_id="parent-run") as parent:
        async with parent.step("parent-step"):
            child_trace_id, child_span_count = await asyncio.create_task(_child())

    assert parent.graph.trace_id == "parent-run"
    assert [span.name for span in parent.graph.spans] == ["parent-step"]
    assert child_trace_id == "child-run"
    assert child_span_count == 1
