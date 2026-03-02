import os

os.environ["TEMPORALLAYR_SERVER_URL"] = "https://temporallayr-server-production.up.railway.app"
os.environ["TEMPORALLAYR_API_KEY"] = "dev-test-key"
os.environ["TEMPORALLAYR_TENANT_ID"] = "dev-local"


import asyncio
from pathlib import Path

import temporallayr
from temporallayr.core.decorators import track
from temporallayr.core.recorder import ExecutionRecorder


@track()
def fake_llm_call(x):
    return x * 2


@track()
def pipeline():
    a = fake_llm_call(5)
    b = fake_llm_call(a)
    return b


async def main():
    # 1. Initialize Context
    temporallayr.init()
    os.environ["TEMPORALLAYR_TENANT_ID"] = "demo-tenant"

    # 2. Without recorder (fails safely / passthrough)
    assert pipeline() == 20
    print("Standard execution succeeded without recorder.")

    # 2. With recorder active
    async with ExecutionRecorder() as recorder:
        result = pipeline()
        assert result == 20

    graph = recorder.graph
    print(f"\nCaptured Graph ID: {graph.id}")
    print(f"Total track nodes executed: {len(graph.nodes)}")

    # Optional: Save for CLI replay testing

    payload = graph.model_dump_json(indent=2)
    await asyncio.to_thread(Path("execution.json").write_text, payload)
    print("Execution graph saved to execution.json")


if __name__ == "__main__":
    asyncio.run(main())
