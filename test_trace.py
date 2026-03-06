import asyncio
import temporallayr as tl

import logging

logging.basicConfig(level=logging.DEBUG)


@tl.track_llm
async def fake_llm(prompt: str) -> str:
    return f"Response to: {prompt}"


async def main():
    from temporallayr.sdk.client import init

    sdk = init(
        api_key="cuCTX6LiGtBmqP36BOenkvw_9Zot0W80henP2i0zmdw",
        server_url="https://cognitive-natalie-temporall-2ff73e17.koyeb.app",
        tenant_id="temporallayr-prod",
    )

    # Force start to avoid race conditions with the background task
    await sdk.start()

    from temporallayr.core.recorder import ExecutionRecorder

    async with ExecutionRecorder(run_id="sdk_test_trace_5"):
        result = await fake_llm("Hello TemporalLayr!")
        print(result)

    print("DEBUG TEST_TRACE: Triggering explicit shutdown")
    await sdk.shutdown()
    print("DEBUG TEST_TRACE: Shutdown fully completed")


asyncio.run(main())
