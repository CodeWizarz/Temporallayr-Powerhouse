import asyncio

import httpx

API_URL = "https://cognitive-natalie-temporall-2ff73e17.koyeb.app"
API_KEY = "cuCTX6LiGtBmqP36BOenkvw_9Zot0W80henP2i0zmdw"

payload = {
    "events": [
        {
            "id": "analytics_test_001",
            "tenant_id": "temporallayr-prod",
            "spans": [
                {
                    "span_id": "span_1",
                    "parent_span_id": None,
                    "type": "llm",
                    "name": "signal_generator",
                    "status": "success",
                    "start_time": "2026-03-07T05:00:00Z",
                    "end_time": "2026-03-07T05:00:01Z",
                    "attributes": {
                        "duration_ms": 142.5,
                        "inputs": {"prompt": "Analyze NIFTY 50 momentum"},
                        "outputs": {"signal": "BUY", "confidence": 0.78},
                    },
                    "error": None,
                }
            ],
            "edges": [],
            "created_at": "2026-03-07T05:00:00Z",
            "status": "success",
        }
    ]
}


async def main():
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{API_URL}/v1/ingest", json=payload, headers={"Authorization": f"Bearer {API_KEY}"}
        )
        print("Status:", r.status_code)
        print("Response:", r.json())


asyncio.run(main())
