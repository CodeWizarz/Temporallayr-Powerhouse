import asyncio
import time

import pytest

import temporallayr.client as client_sdk
from temporallayr.core.decorators import track
from temporallayr.core.recorder import ExecutionRecorder, _current_graph


@pytest.fixture(autouse=True)
def setup_temporallayr():
    client_sdk.init(api_key="test", server_url="http://localhost", tenant_id="t1", batch_size=1)
    yield
    client_sdk.shutdown()
    from temporallayr.core.recorder import _current_graph, _current_parent_id

    _current_graph.set(None)
    _current_parent_id.set(None)


@pytest.mark.asyncio
async def test_track_duration():
    @track(name="test_sleep")
    def sleep_func():
        time.sleep(0.15)
        return "done"

    async with ExecutionRecorder():
        result = sleep_func()
        assert result == "done"

        graph = _current_graph.get()
        assert graph is not None

        nodes = list(graph.nodes.values())
        assert len(nodes) == 1

        node = nodes[0]
        assert node.start_time is not None
        assert node.end_time is not None
        assert "duration_ms" in node.attributes
        assert node.attributes["duration_ms"] >= 100.0


@pytest.mark.asyncio
async def test_track_duration_async():
    @track(name="test_sleep_async")
    async def sleep_func_async():
        await asyncio.sleep(0.15)
        return "done_async"

    async with ExecutionRecorder():
        result = await sleep_func_async()
        assert result == "done_async"

        graph = _current_graph.get()
        assert graph is not None

        nodes = list(graph.nodes.values())
        assert len(nodes) == 1

        node = nodes[0]
        assert node.start_time is not None
        assert node.end_time is not None
        assert "duration_ms" in node.attributes
        assert node.attributes["duration_ms"] >= 100.0
