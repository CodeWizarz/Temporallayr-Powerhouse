import asyncio
import temporallayr as tl
from temporallayr.sdk.client import init, get_sdk

import logging

logging.basicConfig(level=logging.DEBUG)

init(
    api_key="cuCTX6LiGtBmqP36BOenkvw_9Zot0W80henP2i0zmdw",
    server_url="https://cognitive-natalie-temporall-2ff73e17.koyeb.app",
    tenant_id="temporallayr-prod",
)


@tl.track_llm
async def fake_llm(prompt: str) -> str:
    return f"Response to: {prompt}"


async def main():
    from temporallayr.core.recorder import ExecutionRecorder

    async with ExecutionRecorder(run_id="sdk_test_trace_2"):
        result = await fake_llm("Hello TemporalLayr!")
        print(result)

    # Await shutdown explicitly to ensure HTTP request completes
    sdk = get_sdk()
    if sdk:
        await sdk.shutdown()


asyncio.run(main())
